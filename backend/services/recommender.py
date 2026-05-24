"""
Recommendation engine for "What to study next".
Ranks concepts by: SM-2 due items, low skill score, prerequisite graph traversal.
"""
from __future__ import annotations

import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.tables import Concept, SkillScore, ReviewSchedule, Session

# Hardcoded prerequisite graph: topic keywords → their prerequisites
# Keys are lowercase substrings matched against concept names.
_PREREQ_GRAPH: dict[str, list[str]] = {
    "two pointers": ["arrays"],
    "sliding window": ["arrays", "two pointers"],
    "binary search": ["arrays", "sorting"],
    "linked list": ["arrays", "pointers"],
    "stack": ["arrays"],
    "queue": ["arrays", "stack"],
    "bfs": ["queue", "graphs"],
    "dfs": ["stack", "graphs", "recursion"],
    "dynamic programming": ["recursion", "memoization"],
    "dp": ["recursion", "memoization"],
    "memoization": ["recursion"],
    "backtracking": ["recursion", "dfs"],
    "heap": ["trees", "arrays"],
    "trie": ["trees", "strings"],
    "segment tree": ["trees", "arrays"],
    "union find": ["arrays", "graphs"],
    "topological sort": ["graphs", "dfs"],
    "shortest path": ["graphs", "bfs"],
    "dijkstra": ["shortest path", "heap"],
    "gradient descent": ["calculus", "linear algebra"],
    "neural network": ["linear algebra", "gradient descent"],
    "backpropagation": ["neural network", "calculus"],
    "transformer": ["attention", "neural network"],
    "attention": ["neural network", "linear algebra"],
    "cnn": ["neural network"],
    "rnn": ["neural network"],
    "lstm": ["rnn"],
    "regularization": ["gradient descent"],
    "batch normalization": ["neural network"],
    "system design": ["networking", "databases"],
    "consistent hashing": ["distributed systems", "hashing"],
    "distributed systems": ["networking", "databases"],
    "load balancing": ["networking", "distributed systems"],
    "caching": ["databases", "distributed systems"],
    "sharding": ["databases", "distributed systems"],
}


def _matches(concept_name: str, key: str) -> bool:
    return key in concept_name.lower()


def _get_prerequisites(concept_name: str) -> list[str]:
    name_lower = concept_name.lower()
    for key, prereqs in _PREREQ_GRAPH.items():
        if key in name_lower:
            return prereqs
    return []


def _assign_tags(concept_name: str) -> list[str]:
    name_lower = concept_name.lower()
    tags = []
    algo_keywords = [
        "sort", "search", "tree", "graph", "dp", "dynamic", "array",
        "string", "hash", "heap", "trie", "pointer", "window", "bfs", "dfs",
        "backtrack", "greedy", "divide", "conquer", "recursion",
    ]
    ml_keywords = [
        "neural", "gradient", "loss", "model", "training", "transformer",
        "attention", "cnn", "rnn", "lstm", "classification", "regression",
        "embedding", "feature", "backprop", "regularization",
    ]
    system_keywords = [
        "system", "design", "distributed", "cache", "database", "sql",
        "nosql", "load", "shard", "replica", "consistent", "cap theorem",
        "microservice", "api",
    ]
    if any(k in name_lower for k in algo_keywords):
        tags.append("algorithms")
    if any(k in name_lower for k in ml_keywords):
        tags.append("ml")
    if any(k in name_lower for k in system_keywords):
        tags.append("system-design")
    return tags or ["general"]


async def get_recommendations(db: AsyncSession, limit: int = 5) -> list[dict]:
    """
    Return ranked study recommendations.
    Priority: (1) SM-2 due items, (2) low-skill concepts, (3) prerequisite gaps.
    """
    now = datetime.datetime.utcnow()

    # Fetch all non-deleted concepts with their skill scores and review schedules
    result = await db.execute(
        select(Concept).where(Concept.deleted_at.is_(None))
    )
    concepts = result.scalars().all()
    if not concepts:
        return []

    concept_ids = [c.id for c in concepts]
    concept_map = {c.id: c for c in concepts}

    # Fetch skill scores
    skill_result = await db.execute(
        select(SkillScore).where(SkillScore.concept_id.in_(concept_ids))
    )
    skills = {s.concept_id: s for s in skill_result.scalars().all()}

    # Fetch review schedules
    review_result = await db.execute(
        select(ReviewSchedule).where(ReviewSchedule.concept_id.in_(concept_ids))
    )
    reviews = {r.concept_id: r for r in review_result.scalars().all()}

    # Fetch recently studied concepts (last 3 sessions)
    session_result = await db.execute(
        select(Session)
        .where(Session.concept_id.in_(concept_ids))
        .order_by(Session.started_at.desc())
        .limit(3)
    )
    recent_sessions = session_result.scalars().all()
    recently_studied_ids = {s.concept_id for s in recent_sessions}
    recently_studied_names = [
        concept_map[sid].name for sid in recently_studied_ids if sid in concept_map
    ]

    scored: list[tuple[float, dict]] = []

    for concept in concepts:
        cid = concept.id
        skill = skills.get(cid)
        review = reviews.get(cid)
        score = skill.score if skill else 0.0

        priority = 0.0
        reason = ""

        # (1) SM-2 due: highest priority
        if review and review.next_review and review.next_review <= now:
            days_overdue = (now - review.next_review).days
            priority += 100 + min(days_overdue * 5, 50)
            reason = f"Due for review (rep #{review.repetitions})"

        # (2) Low skill score: boost weak concepts
        if score < 50:
            priority += (50 - score) * 0.8
            if not reason:
                reason = f"Low mastery ({int(score)}/100)"

        # (3) Prerequisite gap: if a recently studied concept has this as a prereq
        prereqs_of_recent = []
        for recent_name in recently_studied_names:
            prereqs_of_recent.extend(_get_prerequisites(recent_name))

        if any(p in concept.name.lower() for p in prereqs_of_recent):
            priority += 30
            if not reason:
                reason = "Prerequisite for recent study"

        # Skip if just studied (unless overdue)
        if cid in recently_studied_ids and priority < 100:
            continue

        if priority > 0:
            # Ensure tags are populated
            if not concept.tags:
                concept.tags = _assign_tags(concept.name)
                await db.commit()

            scored.append((priority, {
                "concept_id": cid,
                "concept_name": concept.name,
                "score": score,
                "reason": reason,
                "tags": concept.tags or _assign_tags(concept.name),
            }))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item for _, item in scored[:limit]]
