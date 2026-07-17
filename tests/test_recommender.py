"""Tests for the 'what to study next' recommendation engine."""

import datetime
import pytest
from backend.services.recommender import get_recommendations, _assign_tags, _get_prerequisites
from backend.models.tables import Concept, SkillScore, ReviewSchedule, Session


# ── _get_prerequisites / _assign_tags (pure functions) ─────────────

class TestGetPrerequisites:
    def test_known_topic(self):
        assert _get_prerequisites("Sliding Window") == ["arrays", "two pointers"]

    def test_unknown_topic(self):
        assert _get_prerequisites("quantum computing") == []

    def test_matches_substring_case_insensitively(self):
        assert _get_prerequisites("Intro to Dynamic Programming") == ["recursion", "memoization"]


class TestAssignTags:
    def test_algorithm_keyword(self):
        assert "algorithms" in _assign_tags("binary search tree")

    def test_ml_keyword(self):
        assert "ml" in _assign_tags("gradient descent")

    def test_system_design_keyword(self):
        assert "system-design" in _assign_tags("distributed caching")

    def test_falls_back_to_general(self):
        assert _assign_tags("unrelated topic xyz") == ["general"]


# ── get_recommendations (DB-backed) ─────────────────────────────────

class TestGetRecommendations:
    @pytest.mark.asyncio
    async def test_empty_db_returns_empty(self, db_session):
        recs = await get_recommendations(db_session)
        assert recs == []

    @pytest.mark.asyncio
    async def test_overdue_review_ranked_first(self, db_session):
        weak = Concept(name="weak topic", description="")
        overdue = Concept(name="overdue topic", description="")
        db_session.add_all([weak, overdue])
        await db_session.commit()
        await db_session.refresh(weak)
        await db_session.refresh(overdue)

        db_session.add(SkillScore(concept_id=weak.id, score=10.0))
        db_session.add(ReviewSchedule(
            concept_id=overdue.id,
            next_review=datetime.datetime.utcnow() - datetime.timedelta(days=3),
            last_review=datetime.datetime.utcnow() - datetime.timedelta(days=10),
            repetitions=2,
        ))
        await db_session.commit()

        recs = await get_recommendations(db_session)
        assert recs[0]["concept_name"] == "overdue topic"
        assert "Due for review" in recs[0]["reason"]

    @pytest.mark.asyncio
    async def test_low_skill_boosts_priority(self, db_session):
        concept = Concept(name="weak concept", description="")
        db_session.add(concept)
        await db_session.commit()
        await db_session.refresh(concept)
        db_session.add(SkillScore(concept_id=concept.id, score=5.0))
        await db_session.commit()

        recs = await get_recommendations(db_session)
        assert len(recs) == 1
        assert "Low mastery" in recs[0]["reason"]

    @pytest.mark.asyncio
    async def test_high_skill_no_review_excluded(self, db_session):
        concept = Concept(name="mastered concept", description="")
        db_session.add(concept)
        await db_session.commit()
        await db_session.refresh(concept)
        db_session.add(SkillScore(concept_id=concept.id, score=95.0))
        await db_session.commit()

        recs = await get_recommendations(db_session)
        assert recs == []

    @pytest.mark.asyncio
    async def test_deleted_concepts_excluded(self, db_session):
        concept = Concept(
            name="deleted weak concept", description="",
            deleted_at=datetime.datetime.utcnow(),
        )
        db_session.add(concept)
        await db_session.commit()
        await db_session.refresh(concept)
        db_session.add(SkillScore(concept_id=concept.id, score=5.0))
        await db_session.commit()

        recs = await get_recommendations(db_session)
        assert recs == []

    @pytest.mark.asyncio
    async def test_limit_is_respected(self, db_session):
        for i in range(5):
            concept = Concept(name=f"weak concept {i}", description="")
            db_session.add(concept)
            await db_session.commit()
            await db_session.refresh(concept)
            db_session.add(SkillScore(concept_id=concept.id, score=1.0))
        await db_session.commit()

        recs = await get_recommendations(db_session, limit=2)
        assert len(recs) == 2

    @pytest.mark.asyncio
    async def test_recently_studied_excluded_unless_overdue(self, db_session):
        concept = Concept(name="just studied concept", description="")
        db_session.add(concept)
        await db_session.commit()
        await db_session.refresh(concept)
        db_session.add(SkillScore(concept_id=concept.id, score=5.0))
        db_session.add(Session(concept_id=concept.id, phase="complete", mode="concept"))
        await db_session.commit()

        recs = await get_recommendations(db_session)
        assert recs == []
