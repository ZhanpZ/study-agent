"""Tests for MCQ scoring and evaluation parsing."""

from backend.agents.tester import score_mcq, _parse_evaluation
from backend.models.schemas import TesterEvaluation


# ── score_mcq ─────────────────────────────────────────────────────

class TestScoreMCQ:
    def _make_questions(self, correct_answers):
        """Helper to build question list with given correct answers."""
        return [
            {"question": f"Q{i+1}?", "options": ["A) a", "B) b", "C) c", "D) d"], "correct": ans}
            for i, ans in enumerate(correct_answers)
        ]

    def test_all_correct(self):
        questions = self._make_questions(["A", "B", "C", "D"])
        result = score_mcq(questions, ["A", "B", "C", "D"])
        assert result.score == 100
        assert result.mastered is True
        assert len(result.gaps) == 0

    def test_three_of_four(self):
        questions = self._make_questions(["A", "B", "C", "D"])
        result = score_mcq(questions, ["A", "B", "C", "A"])  # last one wrong
        assert result.score == 75
        assert result.mastered is False
        assert len(result.gaps) == 1

    def test_one_of_four(self):
        questions = self._make_questions(["A", "B", "C", "D"])
        result = score_mcq(questions, ["A", "A", "A", "A"])
        assert result.score == 25
        assert result.mastered is False
        assert "Revisit" in result.feedback

    def test_case_insensitive(self):
        questions = self._make_questions(["A", "B"])
        result = score_mcq(questions, ["a", "b"])
        assert result.score == 100

    def test_whitespace_tolerance(self):
        questions = self._make_questions(["A", "B"])
        result = score_mcq(questions, [" A ", " B "])
        assert result.score == 100

    def test_empty_questions(self):
        result = score_mcq([], [])
        assert result.score == 0
        assert result.mastered is False
        assert "No questions" in result.gaps[0]

    def test_fewer_answers_than_questions(self):
        questions = self._make_questions(["A", "B", "C", "D"])
        result = score_mcq(questions, ["A", "B"])  # only 2 answers for 4 questions
        assert result.score == 50
        assert len(result.gaps) == 2

    def test_mastery_boundary_80_percent_one_gap(self):
        # 4/5 = 80%, 1 gap -> mastered=True (score>=80 AND gaps<=1)
        questions = self._make_questions(["A", "B", "C", "D", "A"])
        result = score_mcq(questions, ["A", "B", "C", "D", "B"])
        assert result.score == 80
        assert len(result.gaps) == 1
        assert result.mastered is True

    def test_mastery_80_percent_two_gaps_not_mastered(self):
        # Even high score, if gaps > 1 -> not mastered
        # 8/10 = 80%, 2 gaps
        questions = self._make_questions(["A"] * 10)
        answers = ["A"] * 8 + ["B", "B"]
        result = score_mcq(questions, answers)
        assert result.score == 80
        assert len(result.gaps) == 2
        assert result.mastered is False


# ── _parse_evaluation ─────────────────────────────────────────────

class TestParseEvaluation:
    def test_valid_json(self):
        raw = '{"score": 85, "gaps": ["gap1"], "mastered": true, "feedback": "Good job"}'
        result = _parse_evaluation(raw, fallback_score=50)
        assert result.score == 85
        assert result.mastered is True
        assert result.gaps == ["gap1"]

    def test_score_clamped_above_100(self):
        raw = '{"score": 150, "gaps": [], "mastered": true, "feedback": "ok"}'
        result = _parse_evaluation(raw, fallback_score=0)
        assert result.score == 100

    def test_score_clamped_below_0(self):
        raw = '{"score": -10, "gaps": [], "mastered": false, "feedback": "ok"}'
        result = _parse_evaluation(raw, fallback_score=0)
        assert result.score == 0

    def test_json_with_preamble_text(self):
        raw = 'Here is my evaluation:\n{"score": 70, "gaps": ["x"], "mastered": false, "feedback": "ok"}'
        result = _parse_evaluation(raw, fallback_score=0)
        assert result.score == 70

    def test_invalid_json_returns_fallback(self):
        raw = "This is not valid JSON at all"
        result = _parse_evaluation(raw, fallback_score=42)
        assert result.score == 42
        assert result.mastered is False
        assert len(result.gaps) > 0
