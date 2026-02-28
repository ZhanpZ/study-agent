"""Tests for skill score tracking service."""

import pytest
from backend.services.skill_tracker import get_or_create_skill, update_skill, get_all_skills, get_stats
from backend.models.tables import SkillScore


class TestGetOrCreateSkill:
    @pytest.mark.asyncio
    async def test_creates_new(self, db_session, sample_concept):
        skill = await get_or_create_skill(db_session, sample_concept.id)
        assert skill.score == 0.0
        assert skill.confidence == 0.0
        assert skill.misconceptions == []

    @pytest.mark.asyncio
    async def test_returns_existing(self, db_session, sample_concept, sample_skill):
        skill = await get_or_create_skill(db_session, sample_concept.id)
        assert skill.id == sample_skill.id
        assert skill.score == 50.0


class TestUpdateSkill:
    @pytest.mark.asyncio
    async def test_first_evaluation_no_blend(self, db_session, sample_concept):
        """When score is 0, new_score is used directly (no blending)."""
        skill = await update_skill(db_session, sample_concept.id, new_score=70, gaps=["gap1"])
        assert skill.score == 70.0

    @pytest.mark.asyncio
    async def test_blending_formula(self, db_session, sample_concept, sample_skill):
        """score = old*0.3 + new*0.7 = 50*0.3 + 80*0.7 = 15+56 = 71"""
        skill = await update_skill(db_session, sample_concept.id, new_score=80, gaps=[])
        assert skill.score == pytest.approx(71.0, rel=1e-6)

    @pytest.mark.asyncio
    async def test_confidence_increments(self, db_session, sample_concept, sample_skill):
        """Confidence starts at 30, should go to 40 after one update."""
        skill = await update_skill(db_session, sample_concept.id, new_score=80, gaps=[])
        assert skill.confidence == 40.0

    @pytest.mark.asyncio
    async def test_confidence_caps_at_100(self, db_session, sample_concept):
        # Create a skill with confidence near max
        skill = SkillScore(concept_id=sample_concept.id, score=80.0, confidence=95.0, misconceptions=[])
        db_session.add(skill)
        await db_session.commit()

        updated = await update_skill(db_session, sample_concept.id, new_score=90, gaps=[])
        assert updated.confidence == 100.0

    @pytest.mark.asyncio
    async def test_misconceptions_dedup(self, db_session, sample_concept, sample_skill):
        """New gaps go first, duplicates removed, max 10 kept."""
        # sample_skill has misconceptions=["gap1"]
        skill = await update_skill(db_session, sample_concept.id, new_score=60, gaps=["gap2", "gap1"])
        # new gaps first: ["gap2", "gap1"] + existing ["gap1"] -> deduped: ["gap2", "gap1"]
        assert skill.misconceptions == ["gap2", "gap1"]

    @pytest.mark.asyncio
    async def test_misconceptions_max_10(self, db_session, sample_concept):
        lots_of_gaps = [f"gap{i}" for i in range(15)]
        skill = await update_skill(db_session, sample_concept.id, new_score=30, gaps=lots_of_gaps)
        assert len(skill.misconceptions) == 10


class TestGetAllSkills:
    @pytest.mark.asyncio
    async def test_returns_skills(self, db_session, sample_concept, sample_skill):
        skills = await get_all_skills(db_session)
        assert len(skills) == 1
        assert skills[0]["concept_name"] == "binary search"
        assert skills[0]["score"] == 50.0


class TestGetStats:
    @pytest.mark.asyncio
    async def test_empty_db(self, db_session):
        stats = await get_stats(db_session)
        assert stats["total_sessions"] == 0
        assert stats["total_concepts"] == 0
        assert stats["concepts_mastered"] == 0
        assert stats["avg_score"] == 0

    @pytest.mark.asyncio
    async def test_with_data(self, db_session, sample_concept, sample_skill):
        stats = await get_stats(db_session)
        assert stats["total_concepts"] == 1
        assert stats["avg_score"] == 50.0
        assert stats["concepts_mastered"] == 0  # 50 < 80
