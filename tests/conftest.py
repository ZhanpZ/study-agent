"""Shared test fixtures for backend tests."""

import os

# Set env vars before any backend imports to avoid real API/DB access
os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite://")

import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from backend.models.database import Base
from backend.models.tables import Concept, SkillScore


@pytest_asyncio.fixture
async def db_session():
    """Provide an async session backed by an in-memory SQLite database."""
    engine = create_async_engine("sqlite+aiosqlite://", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def sample_concept(db_session):
    """Insert and return a sample Concept."""
    concept = Concept(name="binary search", description="A search algorithm")
    db_session.add(concept)
    await db_session.commit()
    await db_session.refresh(concept)
    return concept


@pytest_asyncio.fixture
async def sample_skill(db_session, sample_concept):
    """Insert and return a SkillScore for the sample concept."""
    skill = SkillScore(concept_id=sample_concept.id, score=50.0, confidence=30.0, misconceptions=["gap1"])
    db_session.add(skill)
    await db_session.commit()
    await db_session.refresh(skill)
    return skill
