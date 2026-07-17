from enum import Enum
from dataclasses import dataclass, field
from backend.agents.professor import create_professor_agent, explain_concept, answer_followup
from backend.agents.student import create_student_agent, ask_questions
from backend.agents.tester import (
    create_tester_agent, evaluate_understanding, generate_mcq, score_mcq,
    generate_code_challenge, evaluate_code, detect_critical_errors,
)
from backend.models.schemas import TesterEvaluation
from backend.config import MAX_TEACH_ROUNDS, MASTERY_SCORE_THRESHOLD, MIN_TEACH_BEFORE_EVAL, EVAL_EVERY_N_ROUNDS

class Phase(str, Enum):
    EXPLAIN = "explain"
    EXPLAIN_DONE = "explain_done"  # Professor explained; user can ask follow-ups
    TEACH = "teach"
    EVALUATE = "evaluate"
    QUIZ = "quiz"  # MCQ phase for concept mode
    COMPLETE = "complete"
    REVIEW = "review"

@dataclass
class SessionState:
    topic: str
    mode: str = "concept"  # "concept", "industrial", or "leetcode"
    phase: Phase = Phase.EXPLAIN
    skill_level: float = 0.0
    conversation_history: list[dict] = field(default_factory=list)
    teach_rounds: int = 0
    max_teach_rounds: int = MAX_TEACH_ROUNDS
    last_evaluation: TesterEvaluation | None = None
    mcq_questions: list[dict] | None = None  # stored MCQs for scoring
    code_challenge: dict | None = None  # stored code challenge for evaluation
    pending_gaps: list[str] = field(default_factory=list)  # gaps from last eval to target next teach round


def should_force_evaluate(state: SessionState) -> bool:
    """True once teach_rounds hits the hard cap, or the normal periodic-eval cadence is due.

    Shared by orchestrator._handle_teach and main.py's WebSocket loop (which re-implements
    the teach-round-counting logic inline to support streaming) so the two copies can't
    drift on this specific check.
    """
    if state.teach_rounds >= state.max_teach_rounds:
        return True
    return (state.teach_rounds >= MIN_TEACH_BEFORE_EVAL
            and (state.teach_rounds - MIN_TEACH_BEFORE_EVAL) % EVAL_EVERY_N_ROUNDS == 0)


def should_force_complete(state: SessionState) -> bool:
    """True when the session has exhausted its teach-round budget and still isn't mastered —
    prevents an unbounded TEACH<->EVALUATE cycle for a user whose score never crosses threshold."""
    return state.teach_rounds >= state.max_teach_rounds


_professor_agent: "Agent | None" = None
_student_agent: "Agent | None" = None
_tester_agent: "Agent | None" = None


def _get_professor():
    global _professor_agent
    if _professor_agent is None:
        _professor_agent = create_professor_agent()
    return _professor_agent


def _get_student():
    global _student_agent
    if _student_agent is None:
        _student_agent = create_student_agent()
    return _student_agent


def _get_tester():
    global _tester_agent
    if _tester_agent is None:
        _tester_agent = create_tester_agent()
    return _tester_agent


class Orchestrator:
    def __init__(self):
        self.professor = _get_professor()
        self.student = _get_student()
        self.tester = _get_tester()

    def start_session(
        self, topic: str, skill_level: float = 0.0, mode: str = "concept"
    ) -> SessionState:
        return SessionState(topic=topic, skill_level=skill_level, mode=mode)

    def process_message(
        self, state: SessionState, user_message: str | None = None
    ) -> tuple[str, str, SessionState]:
        """
        Process a message and return (response_text, agent_name, updated_state).
        """
        if state.phase == Phase.EXPLAIN:
            return self._handle_explain(state)

        elif state.phase == Phase.EXPLAIN_DONE:
            return self._handle_explain_followup(state, user_message)

        elif state.phase == Phase.TEACH:
            if user_message is None:
                if state.mode == "industrial":
                    return (
                        "Now it's your turn! Explain the production code I just showed you about "
                        f"'{state.topic}' — walk me through the design decisions, "
                        "why it's structured this way, and what patterns are being used.",
                        "student",
                        state,
                    )
                if state.mode == "leetcode":
                    return (
                        "Now it's your turn! Explain the algorithm I just showed you for "
                        f"'{state.topic}' — walk me through the approach, "
                        "why it works, and what the time/space complexity is.",
                        "student",
                        state,
                    )
                return (
                    "Now it's your turn! Teach me what you just learned about "
                    f"'{state.topic}' as if I'm a fellow engineer who knows nothing about it.",
                    "student",
                    state,
                )
            return self._handle_teach(state, user_message)

        elif state.phase == Phase.EVALUATE:
            return self._handle_evaluate(state)

        elif state.phase == Phase.COMPLETE:
            return self._handle_complete(state)

        return ("Session is in an unknown state.", "system", state)

    def _handle_explain(self, state: SessionState) -> tuple[str, str, SessionState]:
        response = explain_concept(
            self.professor,
            state.topic,
            state.skill_level,
            mode=state.mode,
        )
        state.conversation_history.append({
            "role": "assistant",
            "agent": "professor",
            "content": response,
        })
        state.phase = Phase.EXPLAIN_DONE
        return (response, "professor", state)

    def _handle_explain_followup(
        self, state: SessionState, user_message: str | None
    ) -> tuple[str, str, SessionState]:
        """Handle follow-up questions during the explain phase."""
        if not user_message:
            return ("Feel free to ask any questions, or click 'Ready to Teach' when you're ready!", "system", state)

        state.conversation_history.append({
            "role": "user",
            "agent": "user",
            "content": user_message,
        })

        response = answer_followup(
            self.professor,
            state.topic,
            user_message,
            state.conversation_history,
            state.skill_level,
            mode=state.mode,
        )
        state.conversation_history.append({
            "role": "assistant",
            "agent": "professor",
            "content": response,
        })
        # Stay in EXPLAIN_DONE — user can keep asking or click Ready to Teach
        return (response, "professor", state)

    def transition_to_teach(self, state: SessionState) -> SessionState:
        """Transition from EXPLAIN_DONE to TEACH phase."""
        state.phase = Phase.TEACH
        return state

    def transition_to_evaluate(self, state: SessionState) -> tuple[str, str, SessionState]:
        """Skip TEACH and go directly to EVALUATE (used for leetcode mode)."""
        state.phase = Phase.EVALUATE
        return self._handle_evaluate(state)

    def _handle_teach(
        self, state: SessionState, user_message: str
    ) -> tuple[str, str, SessionState]:
        state.conversation_history.append({
            "role": "user",
            "agent": "user",
            "content": user_message,
        })
        state.teach_rounds += 1

        # After enough teaching rounds (or the hard round cap), move to evaluation
        if should_force_evaluate(state):
            state.phase = Phase.EVALUATE
            return self._handle_evaluate(state)

        # Detect factual errors in the user's explanation (lightweight check)
        critical_errors = detect_critical_errors(state.topic, user_message)

        # Student asks follow-up questions, injecting detected errors + pending gaps
        response = ask_questions(
            self.student,
            state.topic,
            user_message,
            state.conversation_history,
            state.skill_level,
            mode=state.mode,
            critical_errors=critical_errors,
            pending_gaps=state.pending_gaps,
        )
        # Clear pending gaps after first use (they've been addressed)
        state.pending_gaps = []
        state.conversation_history.append({
            "role": "assistant",
            "agent": "student",
            "content": response,
        })
        return (response, "student", state)

    def _handle_evaluate(self, state: SessionState) -> tuple[str, str, SessionState]:
        if state.mode == "concept":
            return self._handle_evaluate_concept(state)
        else:  # industrial and leetcode both use code evaluation
            return self._handle_evaluate_code(state)

    def _handle_evaluate_concept(self, state: SessionState) -> tuple[str, str, SessionState]:
        # Generate MCQs for concept mode
        mcq_data = generate_mcq(
            self.tester,
            state.topic,
            state.conversation_history,
        )
        state.mcq_questions = mcq_data
        state.phase = Phase.QUIZ
        return ("__MCQ__", "tester", state)

    def _handle_evaluate_code(self, state: SessionState) -> tuple[str, str, SessionState]:
        # Generate a coding challenge
        challenge = generate_code_challenge(
            self.tester,
            state.topic,
            state.conversation_history,
            mode=state.mode,
        )
        state.code_challenge = challenge
        return ("__CODE_CHALLENGE__", "tester", state)

    def process_mcq_answers(
        self, state: SessionState, answers: list[str]
    ) -> tuple[str, str, SessionState]:
        """Score MCQ answers and return evaluation."""
        evaluation = score_mcq(state.mcq_questions, answers)
        return self._finalize_evaluation(state, evaluation)

    def process_code_answer(
        self, state: SessionState, code: str, language: str = "python"
    ) -> tuple[str, str, SessionState]:
        """Evaluate user's code submission."""
        evaluation = evaluate_code(
            self.tester,
            state.topic,
            state.code_challenge,
            code,
            state.conversation_history,
            mode=state.mode,
            language=language,
        )
        return self._finalize_evaluation(state, evaluation)

    def _finalize_evaluation(
        self, state: SessionState, evaluation: TesterEvaluation
    ) -> tuple[str, str, SessionState]:
        state.last_evaluation = evaluation
        state.skill_level = evaluation.score

        feedback = (
            f"**Evaluation Results**\n\n"
            f"Score: {evaluation.score}/100\n\n"
            f"Feedback: {evaluation.feedback}\n\n"
        )

        if evaluation.gaps:
            feedback += "Gaps identified:\n"
            for gap in evaluation.gaps:
                feedback += f"- {gap}\n"
            feedback += "\n"

        if evaluation.mastered:
            state.phase = Phase.COMPLETE
            feedback += "You've demonstrated strong understanding! This concept is now mastered."
        elif state.mode == "leetcode":
            # Leetcode has no teach phase — complete after evaluation
            state.phase = Phase.COMPLETE
            feedback += (
                "Session complete! Review the gaps above and practice similar problems "
                "to strengthen your understanding."
            )
        elif should_force_complete(state):
            # Hit the teach-round cap without mastering it — stop cycling and hand off
            # to spaced repetition instead of looping TEACH<->EVALUATE indefinitely.
            state.phase = Phase.COMPLETE
            feedback += (
                "Max practice rounds reached for this session. This concept has been "
                "added to your review queue — you'll revisit it via spaced repetition."
            )
        else:
            state.phase = Phase.TEACH
            # Store gaps so the next teach round specifically targets them
            state.pending_gaps = evaluation.gaps[:]
            if evaluation.gaps:
                gap_list = "\n".join(f"- {g}" for g in evaluation.gaps)
                feedback += (
                    f"Let's continue practicing. In your next explanation, specifically address:\n"
                    f"{gap_list}\n\nFocus on the 'why' behind these areas."
                )
            else:
                feedback += (
                    "Let's continue practicing. Try explaining the areas I identified "
                    "as gaps. Focus especially on the 'why' behind these concepts."
                )

        state.conversation_history.append({
            "role": "assistant",
            "agent": "tester",
            "content": feedback,
        })
        return (feedback, "tester", state)

    def _handle_complete(self, state: SessionState) -> tuple[str, str, SessionState]:
        return (
            f"Session complete! Your final score for '{state.topic}' is "
            f"{state.skill_level}/100. This concept has been added to your review queue.",
            "system",
            state,
        )
