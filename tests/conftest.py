"""Shared test fixtures for backend tests."""

import os

# Set env vars before any backend imports to avoid real API/DB access
os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite://")

import pytest_asyncio
import httpx
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
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


@pytest_asyncio.fixture
async def api_client():
    """Provide an httpx AsyncClient wired to the FastAPI app, backed by an
    isolated in-memory DB (shared across requests via StaticPool) and with
    active_sessions cleared so tests don't leak in-process session state."""
    from backend.main import app, active_sessions
    from backend.models.database import get_db

    engine = create_async_engine(
        "sqlite+aiosqlite://",
        echo=False,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    active_sessions.clear()

    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
    finally:
        app.dependency_overrides.pop(get_db, None)
        active_sessions.clear()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()
