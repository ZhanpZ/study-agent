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

## Setup

**Prerequisites:** Python 3.11+, Node.js 18+, OpenAI API key

```bash
# Clone and configure
git clone <repository-url>
cd study-agent
```

Create `.env` in project root:
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
