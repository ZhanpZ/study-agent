# Study Agent

An AI-powered study companion that uses the **Feynman Technique** to help you deeply learn concepts. A Professor agent explains topics, a Student agent challenges you to teach back what you learned, and an Evaluator scores your understanding — all with spaced repetition to maximize retention.

## Architecture

```
study-agent/
  backend/                  # FastAPI + SQLAlchemy + CrewAI
    agents/
      orchestrator.py       # Session state machine (Explain → Teach → Evaluate → Complete)
      professor.py          # Explains concepts, adapts to skill level
      student.py            # Asks follow-up questions during teach-back
      tester.py             # Evaluates understanding, scores 0-100
    models/
      database.py           # Async SQLAlchemy engine + session factory
      tables.py             # ORM models (Concept, SkillScore, ReviewSchedule, Session, Message)
      schemas.py            # Pydantic request/response schemas
    services/
      skill_tracker.py      # Weighted skill score updates + stats
      scheduler.py          # SM-2 spaced repetition algorithm
      concept_matcher.py    # Fuzzy concept matching to avoid duplicates
    config.py               # Environment config (API keys, model selection)
    main.py                 # REST + WebSocket endpoints
  frontend/                 # React 19 + Vite + Tailwind CSS
    src/
      components/
        Chat.jsx            # Chat interface with auto-scroll
        MessageBubble.jsx   # Markdown-rendered message bubbles
        PhaseIndicator.jsx  # Visual phase progress bar
      context/
        SessionContext.jsx  # Session persistence across navigation
      hooks/
        useWebSocket.js     # Real-time WebSocket communication
      pages/
        Study.jsx           # Main study session page
        Dashboard.jsx       # Skill scores, stats, progress tracking
        Review.jsx          # Spaced repetition review queue
      App.jsx               # Router + navigation
  .env                      # Environment variables (API key, DB URL)
  study.db                  # SQLite database (auto-created on first run)
```

## How It Works

1. **Enter a topic** on the Study page (e.g., "Binary Search Trees")
2. **Professor explains** the concept, adapted to your current skill level
3. **Teach it back** — the Student agent asks you to explain what you learned as if teaching someone else
4. **Follow-up questions** — the Student probes your understanding with targeted questions
5. **Evaluation** — after several rounds, the Evaluator scores your understanding (0-100) and identifies knowledge gaps
6. **Spaced repetition** — mastered concepts are scheduled for future review using the SM-2 algorithm
7. **Dashboard** — track all your concept scores, confidence levels, and areas for improvement

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | React 19, React Router 7, Tailwind CSS 3, Vite 6 |
| Backend   | FastAPI, SQLAlchemy 2 (async), aiosqlite        |
| AI Agents | CrewAI, OpenAI GPT-4o / GPT-4o-mini             |
| Database  | SQLite                                          |
| Realtime  | WebSockets                                      |

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- OpenAI API key with billing enabled

### 1. Clone and configure environment

```bash
git clone <repository-url>
cd study-agent
```

Create a `.env` file in the project root:

```
OPENAI_API_KEY=sk-your-key-here
DATABASE_URL=sqlite+aiosqlite:///./study.db
```

### 2. Backend setup

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r backend/requirements.txt
```

### 3. Frontend setup

```bash
cd frontend
npm install
```

### 4. Run the application

Start the backend (from project root):

```bash
uvicorn backend.main:app --reload
```

Start the frontend (in a separate terminal):

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

## Usage

1. Navigate to the **Study** tab and enter any topic you want to learn
2. Read the Professor's explanation carefully
3. When prompted, **teach the concept back** in your own words — pretend you're explaining to someone who knows nothing about it
4. Answer the Student's follow-up questions to deepen your understanding
5. Review your **evaluation score** and identified knowledge gaps
6. Visit the **Dashboard** to see all your concepts and progress
7. Check the **Review** tab for concepts due for spaced repetition review

## API Endpoints

| Method | Path                     | Description                    |
|--------|--------------------------|--------------------------------|
| POST   | `/api/session/start`     | Start a new study session      |
| GET    | `/api/session/{id}`      | Get session details + messages |
| GET    | `/api/reviews/due`       | Get concepts due for review    |
| GET    | `/api/dashboard/skills`  | Get all concept skill scores   |
| GET    | `/api/dashboard/stats`   | Get aggregate statistics       |
| POST   | `/api/concepts/merge`    | Merge duplicate concepts       |
| WS     | `/ws/session/{id}`       | Real-time session WebSocket    |

## Database Schema

| Table             | Purpose                                    |
|-------------------|--------------------------------------------|
| `concepts`        | Learning topics with names and descriptions |
| `skill_scores`    | Per-concept score, confidence, misconceptions |
| `review_schedule` | SM-2 spaced repetition scheduling data     |
| `sessions`        | Study session records with phase tracking  |
| `messages`        | Full conversation history per session      |

The database is automatically created on first server startup — no manual migration needed.
