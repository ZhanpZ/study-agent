# Study Agent

AI-powered learning platform using the **Feynman Technique** — a Professor explains, you teach back, and an Evaluator scores your understanding. Includes spaced repetition, algorithm quizzes, and ML math drills.

## Modes

- **Concept** — Deep conceptual learning with analogies, teach-back, and MCQ evaluation
- **Code** — Implementation-focused with code templates, edge case discussion, and coding challenges
- **LeetCode** — Fast problem-solving: explanation → coding challenge (no teach-back)
- **Algorithm Quiz** — Pattern recognition drills (algorithm selection + constraint matching)
- **ML Math Drill** — Multi-step math → ML application drills (linear algebra, probability, calculus, optimization, information theory)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy 2 (async), aiosqlite |
| AI | CrewAI, OpenAI GPT-4o / GPT-4o-mini |
| Realtime | WebSockets |
| Math | KaTeX (remark-math + rehype-katex) |
| Testing | pytest + pytest-asyncio (backend), Vitest + Testing Library (frontend) |
| CI | GitHub Actions (`.github/workflows/test.yml`) |

## Architecture

**Backend** (FastAPI + SQLAlchemy async + CrewAI):
- `backend/main.py` — REST endpoints and WebSocket handler. All API routes under `/api/`, WebSocket at `/ws/session/{id}`
- `backend/agents/orchestrator.py` — Session state machine managing phases: `explain → explain_done → teach → evaluate → complete`. LeetCode mode skips the teach phase
- `backend/agents/professor.py`, `student.py`, `tester.py` — CrewAI agents for explanation, questioning, and evaluation
- `backend/agents/quiz_generator.py` — Standalone quiz/drill agents (algorithm quiz, constraint quiz, ML math)
- `backend/services/` — Skill scoring (weighted moving average), SM-2 spaced repetition scheduling, fuzzy concept deduplication, LeetCode problem fetching, LLM call guarding
- `backend/services/llm_guard.py` — Centralized timeout, retry-with-backoff, and circuit-breaker wrapper around every CrewAI `agent.execute_task()` call, so a hung or failing OpenAI call can't block a session indefinitely
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

## Setup

**Prerequisites:** Python 3.11+, Node.js 18+, OpenAI API key

```bash
# Clone
git clone <repository-url>
cd study-agent
```

Create `.env` in `backend/`:
```
OPENAI_API_KEY=sk-your-key-here
DATABASE_URL=sqlite+aiosqlite:///./study.db
```

```bash
# Backend
python -m venv venv
venv\Scripts\activate          # Windows (source venv/bin/activate on macOS/Linux)
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The database auto-creates on first startup.

## Testing

**Backend** (pytest + pytest-asyncio, in-memory SQLite, no real OpenAI calls):

```bash
pip install -r requirements-dev.txt
pytest tests/ -v --cov=backend --cov-report=term-missing
```

Test config lives in `pytest.ini` (`asyncio_mode = auto`). `tests/conftest.py` sets dummy `OPENAI_API_KEY`/`DATABASE_URL` env vars before backend modules are imported and provides shared fixtures (`db_session`, `sample_concept`, `sample_skill`, `api_client` — a `httpx.AsyncClient` wired to the FastAPI app with an isolated in-memory DB via `StaticPool`).

**Frontend** (Vitest + Testing Library + jsdom):

```bash
cd frontend
npm run test         # single run
npm run test:watch   # watch mode
```

Config lives in `frontend/vitest.config.js`; setup file at `frontend/src/test-setup.js`. Test files live alongside source in `__tests__/` (e.g. `frontend/src/__tests__/MCQPanel.test.jsx`).

**CI**: `.github/workflows/test.yml` runs both suites (plus a frontend production build) on every push/PR to `main` and `dev`.

## Session Flow

1. Choose mode → Enter topic → Professor explains
2. Comprehension check → "Ready to Teach" (LeetCode skips to evaluation)
3. Teach back → Evaluation (MCQ or coding challenge) → Score + feedback
4. Session summary saved → SM-2 spaced repetition scheduling

## Usage

| Page | Description |
|---|---|
| **Study** | Feynman Technique sessions (concept/code/leetcode) |
| **Algo Quiz** | Algorithm pattern recognition quizzes |
| **ML Math** | Math drills tied to ML applications |
| **Review** | Spaced repetition review queue |
| **Dashboard** | Skill scores, quiz history, session notes |
