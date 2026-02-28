"""Tests for Pydantic schema validation."""

import pytest
from pydantic import ValidationError
from backend.models.schemas import SessionStart, QuizHistorySave


class TestSessionStart:
    def test_valid(self):
        s = SessionStart(topic="binary search", mode="concept")
        assert s.topic == "binary search"
        assert s.mode == "concept"

    def test_empty_topic_raises(self):
        with pytest.raises(ValidationError):
            SessionStart(topic="", mode="concept")

    def test_whitespace_only_topic_raises(self):
        with pytest.raises(ValidationError):
            SessionStart(topic="   ", mode="concept")

    def test_whitespace_topic_stripped(self):
        s = SessionStart(topic="  binary search  ", mode="concept")
        assert s.topic == "binary search"

    def test_invalid_mode_raises(self):
        with pytest.raises(ValidationError):
            SessionStart(topic="binary search", mode="quiz")

    def test_valid_mode_concept(self):
        s = SessionStart(topic="x", mode="concept")
        assert s.mode == "concept"

    def test_valid_mode_industrial(self):
        s = SessionStart(topic="x", mode="industrial")
        assert s.mode == "industrial"

    def test_valid_mode_leetcode(self):
        s = SessionStart(topic="x", mode="leetcode")
        assert s.mode == "leetcode"


class TestQuizHistorySave:
    def test_valid_algorithm(self):
        q = QuizHistorySave(quiz_type="algorithm", questions=[{"q": 1}])
        assert q.quiz_type == "algorithm"

    def test_valid_constraint(self):
        q = QuizHistorySave(quiz_type="constraint")
        assert q.quiz_type == "constraint"

    def test_valid_ml_math(self):
        q = QuizHistorySave(quiz_type="ml_math")
        assert q.quiz_type == "ml_math"

    def test_invalid_type_raises(self):
        with pytest.raises(ValidationError):
            QuizHistorySave(quiz_type="invalid")
