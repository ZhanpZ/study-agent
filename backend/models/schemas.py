from pydantic import BaseModel, Field, field_validator
from datetime import datetime


class SessionStart(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    difficulty: str = "medium"  # "easy", "medium", or "hard"

    @field_validator("topic")
    @classmethod
    def validate_topic(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("topic must not be empty")
        return v

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, v):
        if v not in ("easy", "medium", "hard"):
            raise ValueError("difficulty must be 'easy', 'medium', or 'hard'")
        return v


class SessionResponse(BaseModel):
    id: int
    concept_id: int | None
    phase: str
    mode: str
    started_at: datetime

    model_config = {"from_attributes": True}


class SkillResponse(BaseModel):
    concept_id: int
    concept_name: str
    score: float
    confidence: float
    misconceptions: list[str]

    model_config = {"from_attributes": True}


class ReviewDue(BaseModel):
    concept_id: int
    concept_name: str
    next_review: datetime
    interval_days: float
    repetitions: int

    model_config = {"from_attributes": True}


class TesterEvaluation(BaseModel):
    score: float
    gaps: list[str]
    mastered: bool
    feedback: str


class WSMessage(BaseModel):
    type: str  # "message", "phase_change", "score_update", "start_session"
    content: str | None = None
    agent: str | None = None
    phase: str | None = None
    score: float | None = None
    gaps: list[str] | None = None
    topic: str | None = None


class StatsResponse(BaseModel):
    total_sessions: int
    total_concepts: int
    concepts_mastered: int
    avg_score: float


class ConceptMerge(BaseModel):
    source_id: int
    target_id: int


