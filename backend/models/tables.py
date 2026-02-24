import datetime
from sqlalchemy import Integer, String, Float, JSON, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.models.database import Base


class Concept(Base):
    __tablename__ = "concepts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )

    skill_score: Mapped["SkillScore"] = relationship(back_populates="concept", uselist=False)
    review_schedule: Mapped["ReviewSchedule"] = relationship(back_populates="concept", uselist=False)
    sessions: Mapped[list["Session"]] = relationship(back_populates="concept")


class SkillScore(Base):
    __tablename__ = "skill_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"), unique=True)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    misconceptions: Mapped[dict] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )

    concept: Mapped["Concept"] = relationship(back_populates="skill_score")


class ReviewSchedule(Base):
    __tablename__ = "review_schedule"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"), unique=True)
    easiness_factor: Mapped[float] = mapped_column(Float, default=2.5)
    interval_days: Mapped[float] = mapped_column(Float, default=1.0)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    next_review: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)
    last_review: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)

    concept: Mapped["Concept"] = relationship(back_populates="review_schedule")

    __table_args__ = (
        Index("ix_review_schedule_next_review", "next_review"),
    )


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id"), nullable=True)
    phase: Mapped[str] = mapped_column(String(50), default="explain")
    mode: Mapped[str] = mapped_column(String(20), default="concept")
    summary: Mapped[str] = mapped_column(Text, nullable=True, default=None)
    started_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )
    ended_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=True)

    concept: Mapped["Concept"] = relationship(back_populates="sessions")
    messages: Mapped[list["Message"]] = relationship(back_populates="session")

    __table_args__ = (
        Index("ix_sessions_concept_id", "concept_id"),
    )


class QuizHistory(Base):
    __tablename__ = "quiz_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    quiz_type: Mapped[str] = mapped_column(String(30))  # "algorithm", "constraint", "ml_math"
    topic: Mapped[str] = mapped_column(String(255), default="all")
    questions: Mapped[dict] = mapped_column(JSON)  # full question data
    answers: Mapped[dict] = mapped_column(JSON, nullable=True)  # user answers
    score: Mapped[float] = mapped_column(Float, nullable=True)  # percentage correct
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )

    __table_args__ = (
        Index("ix_quiz_history_quiz_type", "quiz_type"),
        Index("ix_quiz_history_created_at", "created_at"),
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"))
    role: Mapped[str] = mapped_column(String(50))  # "user" or "assistant"
    agent: Mapped[str] = mapped_column(String(50), nullable=True)  # "professor", "student", "tester"
    content: Mapped[str] = mapped_column(Text)
    timestamp: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow
    )

    session: Mapped["Session"] = relationship(back_populates="messages")

    __table_args__ = (
        Index("ix_messages_session_id_timestamp", "session_id", "timestamp"),
    )
