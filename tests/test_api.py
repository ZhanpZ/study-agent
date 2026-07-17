"""End-to-end tests for the REST API surface in backend/main.py.

Uses an httpx.AsyncClient talking to the FastAPI app in-process (ASGI
transport) with the DB dependency overridden to an isolated in-memory
SQLite database (see the `api_client` fixture in conftest.py). Endpoints
that call out to LLMs (algorithm quiz, ml-math, dsa-template eval, note
cleanup) are exercised via unit tests elsewhere or left to manual/E2E
testing since they require network access.
"""

import pytest


# ── Session lifecycle ──────────────────────────────────────────────

class TestSessionStart:
    @pytest.mark.asyncio
    async def test_start_creates_session(self, api_client):
        resp = await api_client.post("/api/session/start", json={"topic": "binary search"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["phase"] == "explain"
        assert body["mode"] == "concept"
        assert body["id"] > 0
        assert body["concept_id"] > 0

    @pytest.mark.asyncio
    async def test_start_defaults_mode_to_concept(self, api_client):
        resp = await api_client.post("/api/session/start", json={"topic": "recursion"})
        assert resp.json()["mode"] == "concept"

    @pytest.mark.asyncio
    async def test_start_accepts_leetcode_mode(self, api_client):
        resp = await api_client.post(
            "/api/session/start", json={"topic": "two sum", "mode": "leetcode"}
        )
        assert resp.status_code == 200
        assert resp.json()["mode"] == "leetcode"

    @pytest.mark.asyncio
    async def test_start_rejects_empty_topic(self, api_client):
        resp = await api_client.post("/api/session/start", json={"topic": "   "})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_start_rejects_invalid_mode(self, api_client):
        resp = await api_client.post(
            "/api/session/start", json={"topic": "arrays", "mode": "bogus"}
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_start_reuses_matching_concept(self, api_client):
        first = await api_client.post("/api/session/start", json={"topic": "binary search"})
        second = await api_client.post(
            "/api/session/start", json={"topic": "explain binary search"}
        )
        assert first.json()["concept_id"] == second.json()["concept_id"]


class TestGetSession:
    @pytest.mark.asyncio
    async def test_get_existing_session(self, api_client):
        start = await api_client.post("/api/session/start", json={"topic": "hash maps"})
        session_id = start.json()["id"]

        resp = await api_client.get(f"/api/session/{session_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == session_id
        assert body["phase"] == "explain"
        assert body["messages"] == []

    @pytest.mark.asyncio
    async def test_get_missing_session_404(self, api_client):
        resp = await api_client.get("/api/session/999999")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_session_summary_missing_404(self, api_client):
        resp = await api_client.get("/api/session/999999/summary")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_session_summary_defaults_none(self, api_client):
        start = await api_client.post("/api/session/start", json={"topic": "tries"})
        session_id = start.json()["id"]
        resp = await api_client.get(f"/api/session/{session_id}/summary")
        assert resp.status_code == 200
        assert resp.json()["summary"] is None


class TestConceptSessions:
    @pytest.mark.asyncio
    async def test_lists_sessions_for_concept(self, api_client):
        start = await api_client.post("/api/session/start", json={"topic": "graphs"})
        concept_id = start.json()["concept_id"]

        resp = await api_client.get(f"/api/concepts/{concept_id}/sessions")
        assert resp.status_code == 200
        sessions = resp.json()
        assert len(sessions) == 1
        assert sessions[0]["mode"] == "concept"

    @pytest.mark.asyncio
    async def test_empty_for_unknown_concept(self, api_client):
        resp = await api_client.get("/api/concepts/999999/sessions")
        assert resp.status_code == 200
        assert resp.json() == []


# ── Dashboard / reviews / recommendations ──────────────────────────

class TestDashboard:
    @pytest.mark.asyncio
    async def test_stats_empty_db(self, api_client):
        resp = await api_client.get("/api/dashboard/stats")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_sessions"] == 0
        assert body["total_concepts"] == 0

    @pytest.mark.asyncio
    async def test_skills_empty_db(self, api_client):
        resp = await api_client.get("/api/dashboard/skills")
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.asyncio
    async def test_reviews_due_new_concept(self, api_client):
        await api_client.post("/api/session/start", json={"topic": "dynamic programming"})
        resp = await api_client.get("/api/reviews/due")
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 1
        assert items[0]["status"] == "new"

    @pytest.mark.asyncio
    async def test_recommendations_empty_db(self, api_client):
        resp = await api_client.get("/api/recommendations")
        assert resp.status_code == 200
        assert resp.json() == {"recommendations": []}

    @pytest.mark.asyncio
    async def test_recommendations_limit_capped(self, api_client):
        resp = await api_client.get("/api/recommendations?limit=999")
        assert resp.status_code == 200


class TestGoalsToday:
    @pytest.mark.asyncio
    async def test_no_sessions_zero_minutes(self, api_client):
        resp = await api_client.get("/api/goals/today")
        assert resp.status_code == 200
        body = resp.json()
        assert body["actual_minutes"] == 0.0
        assert body["streak_days"] == 0
        assert body["active_session"] is False

    @pytest.mark.asyncio
    async def test_active_session_detected(self, api_client):
        await api_client.post("/api/session/start", json={"topic": "sorting"})
        resp = await api_client.get("/api/goals/today")
        assert resp.json()["active_session"] is True


# ── Concept merge / dedupe / delete ────────────────────────────────

class TestConceptMerge:
    @pytest.mark.asyncio
    async def test_merge_moves_sessions_and_404s(self, api_client):
        a = await api_client.post("/api/session/start", json={"topic": "quick sort"})
        b = await api_client.post("/api/session/start", json={"topic": "merge sort"})
        source_id = a.json()["concept_id"]
        target_id = b.json()["concept_id"]
        assert source_id != target_id

        resp = await api_client.post(
            "/api/concepts/merge", json={"source_id": source_id, "target_id": target_id}
        )
        assert resp.status_code == 200
        assert resp.json() == {"status": "merged", "target_id": target_id}

        sessions = await api_client.get(f"/api/concepts/{target_id}/sessions")
        assert len(sessions.json()) == 2

    @pytest.mark.asyncio
    async def test_merge_missing_concept_404(self, api_client):
        resp = await api_client.post(
            "/api/concepts/merge", json={"source_id": 1, "target_id": 999999}
        )
        assert resp.status_code == 404


class TestDeleteConcept:
    @pytest.mark.asyncio
    async def test_soft_delete(self, api_client):
        start = await api_client.post("/api/session/start", json={"topic": "heaps"})
        concept_id = start.json()["concept_id"]

        resp = await api_client.delete(f"/api/concepts/{concept_id}")
        assert resp.status_code == 200
        assert resp.json() == {"status": "deleted", "id": concept_id}

    @pytest.mark.asyncio
    async def test_delete_missing_concept_404(self, api_client):
        resp = await api_client.delete("/api/concepts/999999")
        assert resp.status_code == 404


# ── Quiz history ────────────────────────────────────────────────────

class TestQuizHistory:
    @pytest.mark.asyncio
    async def test_save_and_fetch(self, api_client):
        save = await api_client.post(
            "/api/quiz-history",
            json={
                "quiz_type": "algorithm",
                "topic": "arrays",
                "questions": [{"q": "?", "options": ["A", "B"], "correct": "A"}],
                "answers": {"0": "A"},
                "score": 100.0,
            },
        )
        assert save.status_code == 200
        entry_id = save.json()["id"]

        listing = await api_client.get("/api/quiz-history")
        assert listing.status_code == 200
        assert len(listing.json()) == 1
        assert listing.json()[0]["id"] == entry_id

    @pytest.mark.asyncio
    async def test_save_rejects_unknown_quiz_type(self, api_client):
        resp = await api_client.post(
            "/api/quiz-history",
            json={"quiz_type": "not_a_real_type", "questions": [], "answers": {}},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_filter_by_quiz_type(self, api_client):
        await api_client.post(
            "/api/quiz-history",
            json={"quiz_type": "algorithm", "questions": [], "answers": {}},
        )
        await api_client.post(
            "/api/quiz-history",
            json={"quiz_type": "ml_math", "questions": [], "answers": {}},
        )
        resp = await api_client.get("/api/quiz-history?quiz_type=ml_math")
        entries = resp.json()
        assert len(entries) == 1
        assert entries[0]["quiz_type"] == "ml_math"

    @pytest.mark.asyncio
    async def test_delete_single_entry(self, api_client):
        save = await api_client.post(
            "/api/quiz-history",
            json={"quiz_type": "constraint", "questions": [], "answers": {}},
        )
        entry_id = save.json()["id"]

        resp = await api_client.delete(f"/api/quiz-history/{entry_id}")
        assert resp.status_code == 200

        listing = await api_client.get("/api/quiz-history")
        assert listing.json() == []

    @pytest.mark.asyncio
    async def test_delete_missing_entry_404(self, api_client):
        resp = await api_client.delete("/api/quiz-history/999999")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_bulk_delete_by_type(self, api_client):
        await api_client.post(
            "/api/quiz-history",
            json={"quiz_type": "algorithm", "questions": [], "answers": {}},
        )
        await api_client.post(
            "/api/quiz-history",
            json={"quiz_type": "ml_math", "questions": [], "answers": {}},
        )
        resp = await api_client.delete("/api/quiz-history?quiz_type=algorithm")
        assert resp.status_code == 200

        remaining = await api_client.get("/api/quiz-history")
        assert len(remaining.json()) == 1
        assert remaining.json()[0]["quiz_type"] == "ml_math"

    @pytest.mark.asyncio
    async def test_weaknesses_empty_db(self, api_client):
        resp = await api_client.get("/api/quiz-history/weaknesses")
        assert resp.status_code == 200
        assert resp.json() == {"weaknesses": []}

    @pytest.mark.asyncio
    async def test_weaknesses_counts_misses(self, api_client):
        await api_client.post(
            "/api/quiz-history",
            json={
                "quiz_type": "algorithm",
                "questions": [
                    {"options": ["A) Binary Search — logn", "B) Linear Scan — n"], "correct": "A"}
                ],
                "answers": {"0": "B"},
                "score": 0.0,
            },
        )
        resp = await api_client.get("/api/quiz-history/weaknesses")
        weaknesses = resp.json()["weaknesses"]
        assert len(weaknesses) == 1
        assert weaknesses[0]["algorithm"] == "Binary Search"
        assert weaknesses[0]["miss_count"] == 1


# ── Quiz feedback ───────────────────────────────────────────────────

class TestQuizFeedback:
    @pytest.mark.asyncio
    async def test_save_and_fetch(self, api_client):
        save = await api_client.post(
            "/api/quiz-feedback",
            json={
                "quiz_type": "algorithm",
                "question_data": {"q": "broken question"},
                "reported_issue": "answer key is wrong",
            },
        )
        assert save.status_code == 200
        entry_id = save.json()["id"]

        listing = await api_client.get("/api/quiz-feedback")
        assert len(listing.json()) == 1
        assert listing.json()[0]["id"] == entry_id

    @pytest.mark.asyncio
    async def test_save_rejects_unknown_quiz_type(self, api_client):
        resp = await api_client.post(
            "/api/quiz-feedback", json={"quiz_type": "not_real"}
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_entry(self, api_client):
        save = await api_client.post(
            "/api/quiz-feedback", json={"quiz_type": "ml_math"}
        )
        entry_id = save.json()["id"]
        resp = await api_client.delete(f"/api/quiz-feedback/{entry_id}")
        assert resp.status_code == 200

        listing = await api_client.get("/api/quiz-feedback")
        assert listing.json() == []

    @pytest.mark.asyncio
    async def test_delete_missing_entry_404(self, api_client):
        resp = await api_client.delete("/api/quiz-feedback/999999")
        assert resp.status_code == 404
