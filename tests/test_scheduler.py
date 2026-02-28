"""Tests for SM-2 spaced repetition algorithm."""

import datetime
import pytest
from backend.services.scheduler import score_to_quality, calculate_sm2, update_review_schedule, get_due_reviews
from backend.models.tables import Concept, ReviewSchedule


# ── score_to_quality ──────────────────────────────────────────────

class TestScoreToQuality:
    def test_zero(self):
        assert score_to_quality(0) == 0

    def test_just_below_20(self):
        assert score_to_quality(19) == 0

    def test_at_20(self):
        assert score_to_quality(20) == 1

    def test_just_below_40(self):
        assert score_to_quality(39) == 1

    def test_at_40(self):
        assert score_to_quality(40) == 2

    def test_just_below_55(self):
        assert score_to_quality(54) == 2

    def test_at_55(self):
        assert score_to_quality(55) == 3

    def test_just_below_70(self):
        assert score_to_quality(69) == 3

    def test_at_70(self):
        assert score_to_quality(70) == 4

    def test_just_below_85(self):
        assert score_to_quality(84) == 4

    def test_at_85(self):
        assert score_to_quality(85) == 5

    def test_at_100(self):
        assert score_to_quality(100) == 5


# ── calculate_sm2 ────────────────────────────────────────────────

class TestCalculateSM2:
    def test_failed_recall_resets(self):
        reps, ef, interval = calculate_sm2(quality=0, repetitions=5, easiness_factor=2.5, interval_days=10)
        assert reps == 0
        assert interval == 1.0

    def test_quality_2_still_resets(self):
        reps, ef, interval = calculate_sm2(quality=2, repetitions=3, easiness_factor=2.5, interval_days=6)
        assert reps == 0
        assert interval == 1.0

    def test_first_success_interval(self):
        reps, ef, interval = calculate_sm2(quality=3, repetitions=0, easiness_factor=2.5, interval_days=1)
        assert reps == 1
        assert interval == 1.0

    def test_second_success_interval(self):
        reps, ef, interval = calculate_sm2(quality=4, repetitions=1, easiness_factor=2.5, interval_days=1)
        assert reps == 2
        assert interval == 3.0

    def test_third_success_uses_ef(self):
        reps, ef, interval = calculate_sm2(quality=5, repetitions=2, easiness_factor=2.5, interval_days=3)
        assert reps == 3
        # interval = 3 * new_ef; new_ef = 2.5 + 0.1 = 2.6
        assert interval == pytest.approx(3 * 2.6, rel=1e-6)

    def test_ef_floor_at_1_3(self):
        # quality=0 severely penalizes EF
        _, ef, _ = calculate_sm2(quality=0, repetitions=0, easiness_factor=1.3, interval_days=1)
        assert ef >= 1.3

    def test_ef_increases_with_quality_5(self):
        _, ef, _ = calculate_sm2(quality=5, repetitions=2, easiness_factor=2.5, interval_days=3)
        assert ef == pytest.approx(2.6, rel=1e-6)

    def test_ef_decreases_with_quality_3(self):
        _, ef, _ = calculate_sm2(quality=3, repetitions=2, easiness_factor=2.5, interval_days=3)
        # EF' = 2.5 + (0.1 - 2*(0.08 + 2*0.02)) = 2.5 + 0.1 - 0.24 = 2.36
        assert ef == pytest.approx(2.36, rel=1e-6)


# ── DB-dependent tests ───────────────────────────────────────────

class TestUpdateReviewSchedule:
    @pytest.mark.asyncio
    async def test_creates_new_schedule(self, db_session, sample_concept):
        schedule = await update_review_schedule(db_session, sample_concept.id, score=85)
        assert schedule.concept_id == sample_concept.id
        assert schedule.repetitions >= 0
        assert schedule.next_review > datetime.datetime.utcnow() - datetime.timedelta(seconds=5)

    @pytest.mark.asyncio
    async def test_updates_existing_schedule(self, db_session, sample_concept):
        s1 = await update_review_schedule(db_session, sample_concept.id, score=85)
        old_reps = s1.repetitions
        s2 = await update_review_schedule(db_session, sample_concept.id, score=90)
        assert s2.repetitions == old_reps + 1


class TestGetDueReviews:
    @pytest.mark.asyncio
    async def test_returns_overdue(self, db_session, sample_concept):
        schedule = ReviewSchedule(
            concept_id=sample_concept.id,
            easiness_factor=2.5,
            interval_days=1.0,
            repetitions=1,
            next_review=datetime.datetime.utcnow() - datetime.timedelta(hours=1),
            last_review=datetime.datetime.utcnow() - datetime.timedelta(days=1),
        )
        db_session.add(schedule)
        await db_session.commit()

        due = await get_due_reviews(db_session)
        assert len(due) == 1
        assert due[0]["concept_name"] == "binary search"

    @pytest.mark.asyncio
    async def test_excludes_future(self, db_session, sample_concept):
        schedule = ReviewSchedule(
            concept_id=sample_concept.id,
            easiness_factor=2.5,
            interval_days=1.0,
            repetitions=1,
            next_review=datetime.datetime.utcnow() + datetime.timedelta(days=7),
            last_review=datetime.datetime.utcnow(),
        )
        db_session.add(schedule)
        await db_session.commit()

        due = await get_due_reviews(db_session)
        assert len(due) == 0
