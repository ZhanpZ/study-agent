from enum import Enum
from dataclasses import dataclass, field
from backend.agents.professor import create_professor_agent, explain_concept
from backend.agents.student import create_student_agent, ask_questions
from backend.agents.tester import create_tester_agent, evaluate_understanding
from backend.models.schemas import TesterEvaluation


class Phase(str, Enum):
    EXPLAIN = "explain"
    TEACH = "teach"
    EVALUATE = "evaluate"
    COMPLETE = "complete"
    REVIEW = "review"


@dataclass
class SessionState:
    topic: str
    phase: Phase = Phase.EXPLAIN
    skill_level: float = 0.0
    conversation_history: list[dict] = field(default_factory=list)
    teach_rounds: int = 0
    max_teach_rounds: int = 5
    last_evaluation: TesterEvaluation | None = None


class Orchestrator:
    def __init__(self):
        self.professor = create_professor_agent()
        self.student = create_student_agent()
        self.tester = create_tester_agent()

    def start_session(self, topic: str, skill_level: float = 0.0) -> SessionState:
        return SessionState(topic=topic, skill_level=skill_level)

    def process_message(
        self, state: SessionState, user_message: str | None = None
    ) -> tuple[str, str, SessionState]:
        """
        Process a message and return (response_text, agent_name, updated_state).
        """
        if state.phase == Phase.EXPLAIN:
            return self._handle_explain(state)

        elif state.phase == Phase.TEACH:
            if user_message is None:
                return (
                    "Now it's your turn! Teach me what you just learned about "
                    f"'{state.topic}' as if I'm a fellow student who knows nothing about it.",
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
        )
        state.conversation_history.append({
            "role": "assistant",
            "agent": "professor",
            "content": response,
        })
        state.phase = Phase.TEACH
        return (response, "professor", state)

    def _handle_teach(
        self, state: SessionState, user_message: str
    ) -> tuple[str, str, SessionState]:
        state.conversation_history.append({
            "role": "user",
            "agent": "user",
            "content": user_message,
        })
        state.teach_rounds += 1

        # After enough teaching rounds, move to evaluation
        if state.teach_rounds >= 3 and state.teach_rounds % 2 == 1:
            state.phase = Phase.EVALUATE
            return self._handle_evaluate(state)

        # Student asks follow-up questions
        response = ask_questions(
            self.student,
            state.topic,
            user_message,
            state.conversation_history,
            state.skill_level,
        )
        state.conversation_history.append({
            "role": "assistant",
            "agent": "student",
            "content": response,
        })
        return (response, "student", state)

    def _handle_evaluate(self, state: SessionState) -> tuple[str, str, SessionState]:
        evaluation = evaluate_understanding(
            self.tester,
            state.topic,
            state.conversation_history,
            state.skill_level,
        )
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
        else:
            state.phase = Phase.TEACH
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
