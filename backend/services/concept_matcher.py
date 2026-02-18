"""Fuzzy concept name matching to avoid duplicate concepts."""

import re
from difflib import SequenceMatcher
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.tables import Concept


def normalize(text: str) -> str:
    """Lowercase, strip, and remove common instructional phrases to extract the core topic."""
    text = text.lower().strip()
    # Remove common instructional prefixes
    noise_prefixes = [
        r"^(give me|teach me|explain|show me|tell me about|what (is|are))\s+",
        r"^(an?\s+overview\s+(of|on)\s+(the\s+)?)",
        r"^(the\s+(core|important|key|main|basic|fundamental)s?\s+)",
        r"^(core|important|key|main|basic|fundamental)s?\s+",
    ]
    for pattern in noise_prefixes:
        text = re.sub(pattern, "", text)
    # Remove trailing generic words
    text = re.sub(r"\s+(concepts?|topics?|fundamentals?|basics?|overview)$", "", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def similarity(a: str, b: str) -> float:
    """Compute similarity between two concept strings after normalization."""
    na, nb = normalize(a), normalize(b)
    if na == nb:
        return 1.0
    return SequenceMatcher(None, na, nb).ratio()


async def find_matching_concept(
    db: AsyncSession, topic: str, threshold: float = 0.7
) -> Concept | None:
    """Find an existing concept that matches the given topic above threshold."""
    # Fast path: exact match
    result = await db.execute(select(Concept).where(Concept.name == topic))
    exact = result.scalar_one_or_none()
    if exact:
        return exact

    # Fuzzy match against all concepts
    result = await db.execute(select(Concept))
    concepts = result.scalars().all()

    best_match = None
    best_score = 0.0

    for concept in concepts:
        score = similarity(topic, concept.name)
        if score > best_score:
            best_score = score
            best_match = concept

    if best_match and best_score >= threshold:
        return best_match

    return None
