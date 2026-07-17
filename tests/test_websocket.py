"""Tests for the /ws/session/{id} WebSocket endpoint in backend/main.py.

Uses starlette's TestClient (sync, runs the ASGI app on its own event loop
in a background thread via a blocking portal). A temp-file-backed SQLite
DB is used instead of `:memory:` so connections opened on that portal's
event loop see the same data as the setup step, which runs beforehand on
the main thread's loop — an in-memory DB would be a fresh empty database
per connection/loop, so a shared file avoids threading pitfalls entirely.

LLM calls (streaming professor/student responses, comprehension MCQ
generation) are monkeypatched out — this suite exercises the orchestration
and persistence logic, not the OpenAI integration.
"""

import os
import tempfile
import asyncio

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from backend.models.database import Base, get_db


@pytest.fixture
def ws_client(monkeypatch):
    from backend.main import app, active_sessions
    import backend.main as main_module

    async def _fake_stream_to_ws(websocket, system_prompt, user_prompt, agent_name, model="gpt-4o-mini"):
        return f"[stub response for {agent_name}]"

    def _fake_generate_comprehension_mcqs(agent, topic, explanation):
        return []

    monkeypatch.setattr(main_module, "stream_to_ws", _fake_stream_to_ws)
    monkeypatch.setattr(main_module, "generate_comprehension_mcqs", _fake_generate_comprehension_mcqs)

    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    db_url = f"sqlite+aiosqlite:///{db_path}"

    setup_engine = create_async_engine(db_url)
    asyncio.run(_create_tables(setup_engine))
    asyncio.run(setup_engine.dispose())

    request_engine = create_async_engine(db_url)
    session_factory = async_sessionmaker(request_engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    active_sessions.clear()

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.pop(get_db, None)
    active_sessions.clear()
    asyncio.run(request_engine.dispose())
    os.remove(db_path)


async def _create_tables(engine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def _start_session(client, topic="binary search", mode="concept"):
    resp = client.post("/api/session/start", json={"topic": topic, "mode": mode})
    assert resp.status_code == 200
    return resp.json()


class TestWebSocketSession:
    def test_unknown_session_sends_error_and_closes(self, ws_client):
        with ws_client.websocket_connect("/ws/session/999999") as ws:
            msg = ws.receive_json()
            assert msg == {"type": "error", "content": "Session not found"}

    def test_explain_phase_kickoff_and_ping(self, ws_client):
        session = _start_session(ws_client)
        with ws_client.websocket_connect(f"/ws/session/{session['id']}") as ws:
            assert ws.receive_json() == {"type": "phase_change", "phase": "explain"}
            assert ws.receive_json() == {"type": "phase_change", "phase": "explain_done"}

            ws.send_json({"type": "ping"})
            assert ws.receive_json() == {"type": "pong"}

    def test_followup_message_during_explain_done(self, ws_client):
        session = _start_session(ws_client)
        with ws_client.websocket_connect(f"/ws/session/{session['id']}") as ws:
            ws.receive_json()  # phase_change: explain
            ws.receive_json()  # phase_change: explain_done

            ws.send_json({"type": "message", "content": "why does this scale?"})
            assert ws.receive_json() == {"type": "phase_change", "phase": "explain_done"}

    def test_leetcode_mode_ready_to_teach_sends_code_challenge(self, ws_client, monkeypatch):
        import backend.agents.orchestrator as orchestrator_module

        fake_challenge = {"problem": "Reverse a linked list", "hints": ["use two pointers"]}
        monkeypatch.setattr(
            orchestrator_module, "generate_code_challenge",
            lambda agent, topic, history, mode="leetcode": fake_challenge,
        )

        session = _start_session(ws_client, topic="reverse linked list", mode="leetcode")
        with ws_client.websocket_connect(f"/ws/session/{session['id']}") as ws:
            ws.receive_json()  # phase_change: explain
            ws.receive_json()  # phase_change: explain_done

            ws.send_json({"type": "ready_to_teach"})
            challenge_msg = ws.receive_json()
            assert challenge_msg["type"] == "code_challenge"
            assert "problem" in challenge_msg
            assert ws.receive_json() == {"type": "phase_change", "phase": "evaluate"}
