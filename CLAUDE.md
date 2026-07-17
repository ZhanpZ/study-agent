# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Study Agent is an AI-powered learning platform using the Feynman Technique. It has three study modes (Concept, Code, LeetCode) plus standalone Algorithm Quiz and ML Math Drill modes. Built with FastAPI + React, using CrewAI agents backed by OpenAI GPT-4o/4o-mini.

## Development Commands

### Backend
```bash
# Activate venv (Windows)
venv\Scripts\activate

# Run backend server (from project root)
uvicorn backend.main:app --reload
```

### Frontend
```bash
cd frontend
npm install        # Install dependencies
npm run dev        # Dev server at http://localhost:5173
npm run build      # Production build to frontend/dist/
```

### Tests
```bash
# Backend (pytest + pytest-asyncio, in-memory SQLite, no real OpenAI calls)
pip install -r requirements-dev.txt
pytest tests/ -v --cov=backend --cov-report=term-missing

# Frontend (Vitest + Testing Library + jsdom)
cd frontend
npm run test         # single run
npm run test:watch   # watch mode
```

`pytest.ini` sets `asyncio_mode = auto`; `tests/conftest.py` sets dummy `OPENAI_API_KEY`/`DATABASE_URL` before backend modules import and provides shared fixtures (`db_session`, `sample_concept`, `sample_skill`, `api_client`). `.github/workflows/test.yml` runs both suites plus a frontend production build on every push/PR to `main`/`dev`. No linting is configured.

## Architecture

**Backend** (FastAPI + SQLAlchemy async + CrewAI):
- `backend/main.py` — REST endpoints and WebSocket handler. All API routes under `/api/`, WebSocket at `/ws/session/{id}`
- `backend/agents/orchestrator.py` — Session state machine managing phases: `explain → explain_done → teach → evaluate → complete`. LeetCode mode skips teach phase
- `backend/agents/professor.py`, `student.py`, `tester.py` — CrewAI agents for explanation, questioning, and evaluation
- `backend/agents/quiz_generator.py` — Standalone quiz/drill agents (algorithm quiz, constraint quiz, ML math)
- `backend/services/` — Skill scoring (weighted moving average), SM-2 spaced repetition scheduling, fuzzy concept deduplication, LeetCode problem fetching, LLM call guarding
- `backend/services/llm_guard.py` — Centralized timeout, retry-with-backoff, and circuit-breaker wrapper around every CrewAI `agent.execute_task()` call; call sites use `call_agent_task()` instead of calling `execute_task()` directly
- `backend/config.py` — LLM model selection and tuning constants (temperature, thresholds, scoring weights)
- `backend/models/` — SQLAlchemy ORM tables, Pydantic schemas, async database setup (aiosqlite)

**Frontend** (React 19 + Vite + Tailwind):
- `frontend/src/hooks/useWebSocket.js` — WebSocket lifecycle, reconnection, and session state persistence (sessionStorage)
- `frontend/src/context/SessionContext.jsx` — Global session state (ID, topic, mode) persisted in sessionStorage
- `frontend/src/components/Chat.jsx` — Main chat interface handling messages, MCQ panels, code challenges
- `frontend/src/pages/` — Study, Review, Dashboard, AlgorithmQuiz, MLMathDrill pages
- Vite dev proxy forwards `/api` and `/ws` to `http://localhost:8000`

## Key Patterns

- **Agent pattern**: CrewAI `Agent` + `Task`, executed via `backend/services/llm_guard.call_agent_task()` (timeout + retry + circuit breaker) rather than calling `agent.execute_task()` directly. Agents return JSON parsed into domain models
- **All database operations are async** (SQLAlchemy 2 + aiosqlite). Use `async with get_db()` / FastAPI `Depends(get_db)`
- **WebSocket message types**: `message`, `phase_change`, `mcq`, `code_challenge`, `score_update`, `summary`, `comprehension_mcqs` (server→client); `ready_to_teach`, `mcq_answers`, `code_answer` (client→server)
- **Skill scoring**: `new_score = old_score * 0.3 + eval_score * 0.7`, confidence increments by 10 per evaluation (max 100)
- **Mode-aware content**: Agents adapt output based on mode (concept/code/leetcode) and skill level (<30 beginner, <70 intermediate, else advanced)
- **Markdown rendering**: react-markdown with remark-gfm + remark-math + rehype-katex for LaTeX support
- **"Deep Focus" theme**: Custom Tailwind dark theme (navy-charcoal base #0f1419, teal accents)

## Environment

Requires `.env` in `backend/` with `OPENAI_API_KEY` and `DATABASE_URL` (defaults to `sqlite+aiosqlite:///./study.db`). Database auto-creates on first startup.

## Change Log & Diary
- After completing any significant task or code change, you MUST append a brief entry to `DIARY.md`.
- Each entry should include:
  - **Date:** (Current date)
  - **Task:** A one-sentence summary of what was accomplished.
  - **Files Changed:** A list of impacted files.
  - **Context:** Why the change was made or any "gotchas" discovered.
- If `DIARY.md` does not exist, create it.
- Do not ask for permission to update the diary; it is a mandatory part of your workflow.