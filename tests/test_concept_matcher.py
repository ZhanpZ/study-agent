"""Tests for fuzzy concept name matching."""

import pytest
from backend.services.concept_matcher import normalize, similarity, find_matching_concept, deduplicate_concepts
from backend.models.tables import Concept, SkillScore, Session


# ── normalize ─────────────────────────────────────────────────────

class TestNormalize:
    def test_lowercase_and_strip(self):
        assert normalize("  Binary Search  ") == "binary search"

    def test_removes_instructional_prefix_learn(self):
        assert normalize("I want to learn about binary search") == "binary search"

    def test_removes_instructional_prefix_explain(self):
        assert normalize("explain dynamic programming") == "dynamic programming"

    def test_removes_instructional_prefix_what_is(self):
        assert normalize("what is a hash table") == "hash table"

    def test_removes_trailing_concepts(self):
        assert normalize("binary search concepts") == "binary search"

    def test_removes_trailing_fundamentals(self):
        assert normalize("sorting fundamentals") == "sorting"

    def test_collapses_whitespace(self):
        assert normalize("binary   search    trees") == "binary search trees"

    def test_removes_leading_article_after_prefix(self):
        assert normalize("the basics of graph theory") == "graph theory"

    def test_preserves_symbols(self):
        result = normalize("tcp/ip")
        assert "tcp/ip" in result


# ── similarity ────────────────────────────────────────────────────

class TestSimilarity:
    def test_identical_strings(self):
        assert similarity("binary search", "binary search") == 1.0

    def test_instructional_prefix_ignored(self):
        assert similarity("binary search", "explain binary search") == 1.0

    def test_substring_containment_bonus(self):
        score = similarity("binary search", "binary search tree")
        assert score >= 0.85

    def test_unrelated_topics_low_score(self):
        score = similarity("binary search", "neural networks")
        assert score < 0.5

    def test_case_insensitive(self):
        assert similarity("Binary Search", "BINARY SEARCH") == 1.0

    def test_empty_after_normalize(self):
        # Both normalize to empty or very short — should not crash
        score = similarity("the", "a")
        assert 0 <= score <= 1.0


# ── DB: find_matching_concept ─────────────────────────────────────

class TestFindMatchingConcept:
    @pytest.mark.asyncio
    async def test_exact_match(self, db_session, sample_concept):
        match = await find_matching_concept(db_session, "binary search")
        assert match is not None
        assert match.id == sample_concept.id

    @pytest.mark.asyncio
    async def test_fuzzy_match_above_threshold(self, db_session, sample_concept):
        match = await find_matching_concept(db_session, "explain binary search")
        assert match is not None
        assert match.id == sample_concept.id

    @pytest.mark.asyncio
    async def test_no_match_below_threshold(self, db_session, sample_concept):
        match = await find_matching_concept(db_session, "quantum computing")
        assert match is None


# ── DB: deduplicate_concepts ──────────────────────────────────────

class TestDeduplicateConcepts:
    @pytest.mark.asyncio
    async def test_merges_similar_concepts(self, db_session):
        c1 = Concept(name="binary search")
        c2 = Concept(name="binary search algorithm")
        db_session.add_all([c1, c2])
        await db_session.commit()

        merged = await deduplicate_concepts(db_session, threshold=0.7)
        assert merged >= 1

    @pytest.mark.asyncio
    async def test_keeps_highest_skill(self, db_session):
        c1 = Concept(name="dynamic programming")
        c2 = Concept(name="dynamic programming concepts")
        db_session.add_all([c1, c2])
        await db_session.commit()
        await db_session.refresh(c1)
        await db_session.refresh(c2)

        s1 = SkillScore(concept_id=c1.id, score=40.0, confidence=20.0, misconceptions=[])
        s2 = SkillScore(concept_id=c2.id, score=80.0, confidence=50.0, misconceptions=[])
        db_session.add_all([s1, s2])
        await db_session.commit()

        await deduplicate_concepts(db_session, threshold=0.7)
        await db_session.refresh(s1)
        # Target skill should have the higher score after merge
        assert s1.score == 80.0

    @pytest.mark.asyncio
    async def test_no_merge_for_unrelated(self, db_session):
        c1 = Concept(name="binary search")
        c2 = Concept(name="neural networks")
        db_session.add_all([c1, c2])
        await db_session.commit()

        merged = await deduplicate_concepts(db_session, threshold=0.7)
        assert merged == 0
