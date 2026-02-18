"""Tracks and updates user skill levels per concept."""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.tables import SkillScore, Concept, Session


async def get_or_create_skill(db: AsyncSession, concept_id: int) -> SkillScore:
    """Get existing skill score or create a new one for a concept."""
    result = await db.execute(
        select(SkillScore).where(SkillScore.concept_id == concept_id)
    )
    skill = result.scalar_one_or_none()

    if skill is None:
        skill = SkillScore(concept_id=concept_id, score=0.0, confidence=0.0, misconceptions=[])
        db.add(skill)
        await db.commit()
        await db.refresh(skill)

    return skill


async def update_skill(
    db: AsyncSession,
    concept_id: int,
    new_score: float,
    gaps: list[str],
) -> SkillScore:
    """Update skill score after a tester evaluation."""
    skill = await get_or_create_skill(db, concept_id)

    # Blend old and new score (weighted moving average)
    if skill.score == 0:
        skill.score = new_score
    else:
        skill.score = skill.score * 0.3 + new_score * 0.7

    # Confidence increases with each evaluation
    skill.confidence = min(100.0, skill.confidence + 10)

    # Track misconceptions (keep unique, most recent)
    existing = skill.misconceptions or []
    all_gaps = list(dict.fromkeys(gaps + existing))[:10]  # keep last 10 unique gaps
    skill.misconceptions = all_gaps

    await db.commit()
    await db.refresh(skill)
    return skill


async def get_all_skills(db: AsyncSession) -> list[dict]:
    """Get all skill scores with concept names."""
    result = await db.execute(
        select(SkillScore, Concept)
        .join(Concept, SkillScore.concept_id == Concept.id)
        .order_by(SkillScore.score.desc())
    )
    rows = result.all()
    return [
        {
            "concept_id": skill.concept_id,
            "concept_name": concept.name,
            "score": skill.score,
            "confidence": skill.confidence,
            "misconceptions": skill.misconceptions or [],
        }
        for skill, concept in rows
    ]


async def get_stats(db: AsyncSession) -> dict:
    """Get overall study statistics."""
    total_concepts = await db.scalar(select(func.count(Concept.id)))
    total_sessions = await db.scalar(select(func.count(Session.id)))
    avg_score = await db.scalar(select(func.avg(SkillScore.score)))
    mastered = await db.scalar(
        select(func.count(SkillScore.id)).where(SkillScore.score >= 80)
    )

    return {
        "total_sessions": total_sessions or 0,
        "total_concepts": total_concepts or 0,
        "concepts_mastered": mastered or 0,
        "avg_score": round(avg_score or 0, 1),
    }
