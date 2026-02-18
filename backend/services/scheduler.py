"""
SM-2 Spaced Repetition Algorithm

Based on the SuperMemo SM-2 algorithm:
- Quality 0-2: Reset repetitions (failed recall)
- Quality 3-5: Increase interval
- Easiness factor adjusts based on response quality
"""

import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.tables import ReviewSchedule, Concept


def score_to_quality(score: float) -> int:
    """Map a 0-100 skill score to SM-2 quality rating (0-5)."""
    if score < 20:
        return 0
    elif score < 40:
        return 1
    elif score < 55:
        return 2
    elif score < 70:
        return 3
    elif score < 85:
        return 4
    else:
        return 5


def calculate_sm2(
    quality: int,
    repetitions: int,
    easiness_factor: float,
    interval_days: float,
) -> tuple[int, float, float]:
    """
    Run one iteration of SM-2.

    Returns (new_repetitions, new_easiness_factor, new_interval_days).
    """
    # Update easiness factor
    new_ef = easiness_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)  # EF must not go below 1.3

    if quality < 3:
        # Failed recall — reset
        new_repetitions = 0
        new_interval = 1.0
    else:
        new_repetitions = repetitions + 1
        if new_repetitions == 1:
            new_interval = 1.0
        elif new_repetitions == 2:
            new_interval = 3.0
        else:
            new_interval = interval_days * new_ef

    return new_repetitions, new_ef, new_interval


async def update_review_schedule(
    db: AsyncSession,
    concept_id: int,
    score: float,
) -> ReviewSchedule:
    """Update the review schedule for a concept after an evaluation."""
    result = await db.execute(
        select(ReviewSchedule).where(ReviewSchedule.concept_id == concept_id)
    )
    schedule = result.scalar_one_or_none()

    quality = score_to_quality(score)
    now = datetime.datetime.utcnow()

    if schedule is None:
        # First time — create schedule
        reps, ef, interval = calculate_sm2(quality, 0, 2.5, 1.0)
        schedule = ReviewSchedule(
            concept_id=concept_id,
            easiness_factor=ef,
            interval_days=interval,
            repetitions=reps,
            next_review=now + datetime.timedelta(days=interval),
            last_review=now,
        )
        db.add(schedule)
    else:
        reps, ef, interval = calculate_sm2(
            quality, schedule.repetitions, schedule.easiness_factor, schedule.interval_days
        )
        schedule.repetitions = reps
        schedule.easiness_factor = ef
        schedule.interval_days = interval
        schedule.next_review = now + datetime.timedelta(days=interval)
        schedule.last_review = now

    await db.commit()
    await db.refresh(schedule)
    return schedule


async def get_due_reviews(db: AsyncSession) -> list[dict]:
    """Get all concepts due for review."""
    now = datetime.datetime.utcnow()
    result = await db.execute(
        select(ReviewSchedule, Concept)
        .join(Concept, ReviewSchedule.concept_id == Concept.id)
        .where(ReviewSchedule.next_review <= now)
        .order_by(ReviewSchedule.next_review)
    )
    rows = result.all()
    return [
        {
            "concept_id": schedule.concept_id,
            "concept_name": concept.name,
            "next_review": schedule.next_review,
            "interval_days": schedule.interval_days,
            "repetitions": schedule.repetitions,
        }
        for schedule, concept in rows
    ]
