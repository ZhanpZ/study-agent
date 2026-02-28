"""Tests for the session orchestrator state machine."""

from unittest.mock import patch, MagicMock
import pytest
from backend.agents.orchestrator import Orchestrator, SessionState, Phase
from backend.models.schemas import TesterEvaluation


@pytest.fixture
def orchestrator():
    """Create an Orchestrator with mocked agent creation."""
    with patch("backend.agents.orchestrator.create_professor_agent", return_value=MagicMock()), \
         patch("backend.agents.orchestrator.create_student_agent", return_value=MagicMock()), \
         patch("backend.agents.orchestrator.create_tester_agent", return_value=MagicMock()):
        return Orchestrator()


class TestStartSession:
    def test_initial_state(self, orchestrator):
        state = orchestrator.start_session("binary search", skill_level=50, mode="concept")
        assert state.topic == "binary search"
        assert state.phase == Phase.EXPLAIN
        assert state.skill_level == 50
        assert state.mode == "concept"
        assert state.teach_rounds == 0

    def test_leetcode_mode(self, orchestrator):
        state = orchestrator.start_session("dp", mode="leetcode")
        assert state.mode == "leetcode"


class TestExplainPhase:
    @patch("backend.agents.orchestrator.explain_concept", return_value="Here is the explanation.")
    def test_explain_transitions_to_explain_done(self, mock_explain, orchestrator):
        state = orchestrator.start_session("binary search")
        response, agent, state = orchestrator.process_message(state)
        assert agent == "professor"
        assert state.phase == Phase.EXPLAIN_DONE
        assert "explanation" in response.lower()

    @patch("backend.agents.orchestrator.answer_followup", return_value="Good question! Here's the answer.")
    @patch("backend.agents.orchestrator.explain_concept", return_value="Explanation.")
    def test_explain_done_handles_followup(self, mock_explain, mock_followup, orchestrator):
        state = orchestrator.start_session("binary search")
        orchestrator.process_message(state)  # EXPLAIN → EXPLAIN_DONE

        response, agent, state = orchestrator.process_message(state, "What about edge cases?")
        assert agent == "professor"
        assert state.phase == Phase.EXPLAIN_DONE  # stays in explain_done

    @patch("backend.agents.orchestrator.explain_concept", return_value="Explanation.")
    def test_explain_done_no_message_prompt(self, mock_explain, orchestrator):
        state = orchestrator.start_session("binary search")
        orchestrator.process_message(state)  # → EXPLAIN_DONE

        response, agent, state = orchestrator.process_message(state, None)
        assert "ask" in response.lower() or "ready" in response.lower()


class TestTransitions:
    @patch("backend.agents.orchestrator.explain_concept", return_value="Explanation.")
    def test_transition_to_teach(self, mock_explain, orchestrator):
        state = orchestrator.start_session("binary search")
        orchestrator.process_message(state)  # → EXPLAIN_DONE

        state = orchestrator.transition_to_teach(state)
        assert state.phase == Phase.TEACH

    def test_teach_no_message_returns_prompt(self, orchestrator):
        state = SessionState(topic="binary search", mode="concept", phase=Phase.TEACH)
        response, agent, state = orchestrator.process_message(state)
        assert "your turn" in response.lower()
        assert agent == "student"

    def test_teach_prompt_industrial_mode(self, orchestrator):
        state = SessionState(topic="binary search", mode="industrial", phase=Phase.TEACH)
        response, _, _ = orchestrator.process_message(state)
        assert "production" in response.lower() or "design" in response.lower()

    def test_teach_prompt_leetcode_mode(self, orchestrator):
        state = SessionState(topic="binary search", mode="leetcode", phase=Phase.TEACH)
        response, _, _ = orchestrator.process_message(state)
        assert "algorithm" in response.lower()


class TestTeachPhase:
    @patch("backend.agents.orchestrator.ask_questions", return_value="Why does this work?")
    def test_teach_increments_rounds(self, mock_ask, orchestrator):
        state = SessionState(topic="binary search", mode="concept", phase=Phase.TEACH)
        _, _, state = orchestrator.process_message(state, "Here is my explanation")
        assert state.teach_rounds == 1

    @patch("backend.agents.orchestrator.generate_mcq", return_value=[{"question": "Q?", "options": [], "correct": "A"}])
    @patch("backend.agents.orchestrator.ask_questions", return_value="Follow up?")
    def test_teach_triggers_evaluation_at_round_3(self, mock_ask, mock_mcq, orchestrator):
        state = SessionState(topic="binary search", mode="concept", phase=Phase.TEACH, teach_rounds=2)
        # Round 3 (2+1=3), 3>=3 and 3%2==1 → triggers evaluation
        response, agent, state = orchestrator.process_message(state, "My explanation")
        assert state.phase == Phase.QUIZ  # concept mode → MCQ → QUIZ

    @patch("backend.agents.orchestrator.ask_questions", return_value="Tell me more.")
    def test_teach_continues_at_round_2(self, mock_ask, orchestrator):
        state = SessionState(topic="binary search", mode="concept", phase=Phase.TEACH, teach_rounds=1)
        _, agent, state = orchestrator.process_message(state, "My explanation")
        assert state.teach_rounds == 2
        assert state.phase == Phase.TEACH  # not enough rounds yet
        assert agent == "student"


class TestEvaluatePhase:
    @patch("backend.agents.orchestrator.generate_mcq", return_value=[{"question": "Q?", "options": [], "correct": "A"}])
    def test_concept_mode_generates_mcq(self, mock_mcq, orchestrator):
        state = SessionState(topic="binary search", mode="concept", phase=Phase.EVALUATE)
        response, agent, state = orchestrator.process_message(state)
        assert response == "__MCQ__"
        assert state.phase == Phase.QUIZ

    @patch("backend.agents.orchestrator.generate_code_challenge", return_value={"problem": "Write code", "hints": []})
    def test_code_mode_generates_challenge(self, mock_gen, orchestrator):
        state = SessionState(topic="binary search", mode="industrial", phase=Phase.EVALUATE)
        response, agent, state = orchestrator.process_message(state)
        assert response == "__CODE_CHALLENGE__"


class TestFinalizeEvaluation:
    def test_mastered_completes(self, orchestrator):
        state = SessionState(topic="binary search", mode="concept", phase=Phase.QUIZ)
        evaluation = TesterEvaluation(score=90, gaps=[], mastered=True, feedback="Great!")
        response, agent, state = orchestrator._finalize_evaluation(state, evaluation)
        assert state.phase == Phase.COMPLETE
        assert "mastered" in response.lower()

    def test_not_mastered_concept_returns_to_teach(self, orchestrator):
        state = SessionState(topic="binary search", mode="concept", phase=Phase.QUIZ)
        evaluation = TesterEvaluation(score=50, gaps=["gap1", "gap2"], mastered=False, feedback="Needs work")
        _, _, state = orchestrator._finalize_evaluation(state, evaluation)
        assert state.phase == Phase.TEACH

    def test_leetcode_always_completes(self, orchestrator):
        state = SessionState(topic="binary search", mode="leetcode", phase=Phase.EVALUATE)
        evaluation = TesterEvaluation(score=50, gaps=["gap1"], mastered=False, feedback="Needs work")
        _, _, state = orchestrator._finalize_evaluation(state, evaluation)
        assert state.phase == Phase.COMPLETE

    def test_evaluation_updates_skill_level(self, orchestrator):
        state = SessionState(topic="binary search", mode="concept", phase=Phase.QUIZ, skill_level=30)
        evaluation = TesterEvaluation(score=85, gaps=[], mastered=True, feedback="Great!")
        _, _, state = orchestrator._finalize_evaluation(state, evaluation)
        assert state.skill_level == 85
