"""Fuzzy and semantic concept name matching to avoid duplicate concepts."""

import math
import re
from difflib import SequenceMatcher
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.tables import Concept, SkillScore, ReviewSchedule, Session
from backend.config import CONCEPT_SIMILARITY_THRESHOLD, SEMANTIC_SIMILARITY_THRESHOLD, OPENAI_API_KEY


def normalize(text: str) -> str:
    """Lowercase, strip, and remove common instructional phrases to extract the core topic."""
    text = text.lower().strip()
    # Remove common instructional prefixes
    noise_prefixes = [
        r"^(i\s+want\s+to\s+learn\s+about|help\s+me\s+understand|let'?s\s+study|can\s+you\s+explain|walk\s+me\s+through|how\s+does|how\s+do)\s+",
        r"^(give me|teach me|explain|show me|tell me about|what (is|are))\s+",
        r"^(a\s+review\s+on\s+|review\s+of\s+|review\s+on\s+)",
        r"^(an?\s+overview\s+(of|on)\s+(the\s+)?)",
        r"^(the\s+(core|important|key|main|basic|fundamental)s?\s+)",
        r"^(core|important|key|main|basic|fundamental)s?\s+",
    ]
    for pattern in noise_prefixes:
        text = re.sub(pattern, "", text)
    # Remove leftover articles/prepositions at the start
    text = re.sub(r"^(the|a|an|of|about|on|in|for|to)\s+", "", text)
    # Remove trailing generic words
    text = re.sub(r"\s+(concepts?|topics?|fundamentals?|basics?|overview|principles?|ideas?)$", "", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def similarity(a: str, b: str) -> float:
    """Compute similarity between two concept strings after normalization."""
    na, nb = normalize(a), normalize(b)
    if na == nb:
        return 1.0
    # Substring containment: only apply if the shorter name covers most of the longer
    # (avoids merging "Sorting" into "Sorting Algorithms" — distinct topics)
    if na and nb and (na in nb or nb in na):
        shorter, longer = (na, nb) if len(na) <= len(nb) else (nb, na)
        coverage = len(shorter) / len(longer)
        if coverage >= 0.75:
            return coverage
    return SequenceMatcher(None, na, nb).ratio()


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


async def _fetch_embeddings(texts: list[str]) -> list[list[float]] | None:
    """Batch-fetch embeddings for a list of texts. Returns None on failure."""
    try:
        import openai
        client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=texts,
        )
        return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
    except Exception:
        return None


async def find_matching_concept(
    db: AsyncSession, topic: str, threshold: float = CONCEPT_SIMILARITY_THRESHOLD
) -> Concept | None:
    """Find an existing concept that matches the given topic above threshold."""
    normalized_topic = normalize(topic)

    # Fast path: exact match (on original name)
    result = await db.execute(
        select(Concept).where(Concept.name == topic, Concept.deleted_at.is_(None))
    )
    exact = result.scalar_one_or_none()
    if exact:
        return exact

    # Fuzzy match against non-deleted concepts only
    result = await db.execute(
        select(Concept).where(Concept.deleted_at.is_(None))
    )
    concepts = result.scalars().all()

    best_match = None
    best_score = 0.0

    for concept in concepts:
        # Quick pre-filter: skip if normalized names differ in length by too much
        normalized_name = normalize(concept.name)
        len_ratio = len(normalized_topic) / max(len(normalized_name), 1)
        if len_ratio < 0.3 or len_ratio > 3.0:
            continue

        score = similarity(topic, concept.name)
        if score > best_score:
            best_score = score
            best_match = concept

    if best_match and best_score >= threshold:
        return best_match

    return None


async def deduplicate_concepts(
    db: AsyncSession,
    threshold: float = CONCEPT_SIMILARITY_THRESHOLD,
    semantic: bool = True,
) -> int:
    """Scan all concepts and merge duplicates. Returns number of merges performed.

    When semantic=True, uses OpenAI embeddings as a secondary check for concepts
    that don't match syntactically but are semantically similar (e.g. 'SOLID principals'
    and 'L in SOLID principal').
    """
    result = await db.execute(select(Concept).where(Concept.deleted_at.is_(None)).order_by(Concept.id))
    concepts = list(result.scalars().all())
    merged_count = 0
    removed_ids: set[int] = set()

    # Pre-compute embeddings for all concepts in one batch API call
    embeddings: dict[int, list[float]] = {}
    if semantic and concepts:
        normalized_names = [normalize(c.name) for c in concepts]
        raw_embeddings = await _fetch_embeddings(normalized_names)
        if raw_embeddings:
            for concept, emb in zip(concepts, raw_embeddings):
                embeddings[concept.id] = emb

    for i, target in enumerate(concepts):
        if target.id in removed_ids:
            continue
        for source in concepts[i + 1:]:
            if source.id in removed_ids:
                continue

            should_merge = similarity(target.name, source.name) >= threshold

            # Semantic fallback: if syntactic similarity is too low, check embeddings
            if not should_merge and target.id in embeddings and source.id in embeddings:
                sem_score = _cosine_similarity(embeddings[target.id], embeddings[source.id])
                should_merge = sem_score >= SEMANTIC_SIMILARITY_THRESHOLD

            if not should_merge:
                continue

            # Merge source into target — move sessions
            sess_result = await db.execute(
                select(Session).where(Session.concept_id == source.id)
            )
            for session in sess_result.scalars().all():
                session.concept_id = target.id

            # Merge skill scores (keep highest)
            target_skill_r = await db.execute(
                select(SkillScore).where(SkillScore.concept_id == target.id)
            )
            target_skill = target_skill_r.scalar_one_or_none()
            source_skill_r = await db.execute(
                select(SkillScore).where(SkillScore.concept_id == source.id)
            )
            source_skill = source_skill_r.scalar_one_or_none()

            if source_skill:
                if target_skill and source_skill.score > target_skill.score:
                    target_skill.score = source_skill.score
                await db.delete(source_skill)

            # Delete source review schedule
            source_rev_r = await db.execute(
                select(ReviewSchedule).where(ReviewSchedule.concept_id == source.id)
            )
            source_rev = source_rev_r.scalar_one_or_none()
            if source_rev:
                await db.delete(source_rev)

            # Flush session moves to DB before deleting the concept so SQLAlchemy's
            # relationship cleanup doesn't orphan sessions by issuing SET NULL first.
            await db.flush()
            await db.delete(source)
            removed_ids.add(source.id)
            merged_count += 1

    if merged_count > 0:
        await db.commit()

    return merged_count
