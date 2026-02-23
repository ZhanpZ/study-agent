# Study Agent

An AI-powered study companion that uses the **Feynman Technique** to help you deeply learn concepts. A Professor agent explains topics, a Student agent challenges you to teach back what you learned, and an Evaluator scores your understanding — all with spaced repetition to maximize retention. Also includes standalone **Algorithm Quiz** and **ML Math Drill** modes for targeted practice.

## Study Modes

### Concept Mode
Focuses on building deep conceptual understanding through analogies and real-world examples. The Professor explains ideas intuitively, the Student asks "why" questions, and the Evaluator tests with **multiple-choice questions**.

### Code Mode
Focuses on practical implementation. The Professor provides clean code templates with common variations and complexity analysis. The Student asks about edge cases and alternative approaches. The Evaluator presents a **coding challenge** that requires applying the patterns discussed.

### Leetcode Mode
Skips the teach-back phase entirely. The Professor explains the algorithmic approach, then immediately transitions to a **coding challenge** — designed for fast, focused problem-solving practice.

### Algorithm Quiz (Standalone)
Two quiz types for drilling algorithm/data structure pattern recognition:
- **Algorithm Selection** — given a problem description, pick the correct algorithm or approach. Filterable by topic (graphs, DP, trees, greedy, etc.).
- **Constraint Matching** — given keywords and constraints, select all algorithms that apply.

Quiz history is saved and viewable on the Dashboard.

### ML Math Drill (Standalone)
A multi-step math drill connecting pure math to machine learning applications:
1. **Learn** — concept explanation with LaTeX-rendered formulas
2. **Math** — solve a math multiple-choice question
3. **Proof** — answer a proof-based multiple-choice question
4. **ML Application** — connect the math to a real ML use case

Topics: Linear Algebra, Probability & Stats, Calculus, Optimization, Information Theory.

## Architecture

```
study-agent/
  backend/                  # FastAPI + SQLAlchemy + CrewAI
    agents/
      orchestrator.py       # Session state machine with mode-aware routing
      professor.py          # Explains concepts or code, generates session summaries
      student.py            # Asks follow-up questions (conceptual or code-focused)
      tester.py             # MCQ generation, code challenges, evaluation scoring
      quiz_generator.py     # Algorithm quiz + constraint quiz + ML math agents
    models/
      database.py           # Async SQLAlchemy engine + session factory
      tables.py             # ORM models (Concept, SkillScore, ReviewSchedule, Session, Message, QuizHistory)
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
        Chat.jsx            # Chat interface with MCQ panel, code input, ready button
        MessageBubble.jsx   # Markdown-rendered message bubbles
        PhaseIndicator.jsx  # Visual phase progress bar
        MCQPanel.jsx        # Multiple-choice question interface
        ComprehensionPanel.jsx  # Inline comprehension checks after explanations
        ConceptDetail.jsx   # Modal showing session notes per concept
        PomodoroTimer.jsx   # 25/5 Pomodoro timer in the header
      context/
        SessionContext.jsx  # Session + mode persistence across navigation
      hooks/
        useWebSocket.js     # Real-time WebSocket with MCQ/code/summary handling
      pages/
        Study.jsx           # Mode selection + topic input + active session
        AlgorithmQuiz.jsx   # Algorithm selection & constraint matching quizzes
        MLMathDrill.jsx     # Multi-step ML math drill (learn → math → proof → application)
        Dashboard.jsx       # Skill scores, stats, quiz history, clickable concept cards
        Review.jsx          # Spaced repetition review queue
      App.jsx               # Router + navigation
  .env                      # Environment variables (API key, DB URL)
  study.db                  # SQLite database (auto-created on first run)
```

## Session Flow (Study Mode)

```
1. Choose Mode (Concept / Code / Leetcode)
2. Enter Topic
3. Professor Explains (concept analogies or code templates)
4. Comprehension MCQs appear (inline self-check)
5. Click "I'm Ready to Teach" (user-controlled transition)
   - Leetcode Mode skips to step 7
6. Teach Back (explain to the Student agent)
7. Evaluation:
   - Concept Mode → Multiple Choice Quiz
   - Code / Leetcode Mode → Coding Challenge
8. Score + Feedback (0-100 with identified gaps)
9. Session Summary auto-generated and saved
10. Spaced Repetition scheduling (SM-2 algorithm)
```

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | React 19, React Router 7, Tailwind CSS 3, Vite 6 |
| Backend   | FastAPI, SQLAlchemy 2 (async), aiosqlite        |
| AI Agents | CrewAI, OpenAI GPT-4o / GPT-4o-mini             |
| Database  | SQLite                                          |
| Realtime  | WebSockets                                      |
| Math      | KaTeX (via remark-math + rehype-katex)          |

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

1. **Study** — Select Concept, Code, or Leetcode mode, enter a topic, and work through the Feynman Technique session
2. **Algo Quiz** — Practice algorithm pattern recognition with timed quizzes (algorithm selection or constraint matching)
3. **ML Math** — Drill math fundamentals tied to ML applications (linear algebra, probability, calculus, optimization, information theory)
4. **Review** — Revisit concepts due for spaced repetition
5. **Dashboard** — View skill scores, quiz history, and session notes; delete concepts or quiz entries
6. **Pomodoro Timer** — 25/5 timer accessible from the header on any page

## API Endpoints

| Method | Path                              | Description                           |
|--------|-----------------------------------|---------------------------------------|
| POST   | `/api/session/start`              | Start a new study session             |
| GET    | `/api/session/{id}`               | Get session details + messages        |
| GET    | `/api/session/{id}/summary`       | Get session study notes               |
| GET    | `/api/concepts/{id}/sessions`     | Get all sessions for a concept        |
| DELETE | `/api/concepts/{id}`              | Delete a concept and all its data     |
| GET    | `/api/reviews/due`                | Get concepts due for review           |
| GET    | `/api/dashboard/skills`           | Get all concept skill scores          |
| GET    | `/api/dashboard/stats`            | Get aggregate statistics              |
| POST   | `/api/concepts/merge`             | Merge duplicate concepts              |
| GET    | `/api/algorithm-quiz`             | Generate algorithm selection quiz     |
| GET    | `/api/constraint-quiz`            | Generate constraint matching quiz     |
| GET    | `/api/ml-math`                    | Generate ML math drill question       |
| POST   | `/api/quiz-history`               | Save a completed quiz attempt         |
| GET    | `/api/quiz-history`               | Get quiz history (filterable by type) |
| DELETE | `/api/quiz-history/{id}`          | Delete a quiz history entry           |
| WS     | `/ws/session/{id}`                | Real-time session WebSocket           |

## WebSocket Message Types

| Type                  | Direction | Description                              |
|-----------------------|-----------|------------------------------------------|
| `message`             | Both      | Chat messages between user and agents    |
| `phase_change`        | Server    | Phase transitions (explain_done, teach, quiz, etc.) |
| `ready_to_teach`      | Client    | User signals readiness to start teaching |
| `comprehension_mcqs`  | Server    | Inline comprehension checks after explanation |
| `mcq`                 | Server    | Multiple-choice questions for evaluation |
| `mcq_answers`         | Client    | User's MCQ answer selections            |
| `code_challenge`      | Server    | Coding problem for evaluation           |
| `code_answer`         | Client    | User's code submission                  |
| `score_update`        | Server    | Evaluation score and gaps               |
| `summary`             | Server    | Auto-generated session study notes      |

## Database Schema

| Table             | Purpose                                        |
|-------------------|------------------------------------------------|
| `concepts`        | Learning topics with names and descriptions    |
| `skill_scores`    | Per-concept score, confidence, misconceptions  |
| `review_schedule` | SM-2 spaced repetition scheduling data         |
| `sessions`        | Study sessions with phase, mode, and summary   |
| `messages`        | Full conversation history per session          |
| `quiz_history`    | Algorithm quiz and ML math drill attempts      |

The database is automatically created on first server startup — no manual migration needed.
