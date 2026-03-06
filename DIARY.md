# Development Diary

## 2026-03-01
**Task:** Added micro-interactions across the frontend to improve attention span and engagement.

**Files Changed:**
- `frontend/src/index.css` — Added 10 new CSS keyframe animations (message-enter, phase-pulse, phase-shimmer, btn-interactive, btn-ripple, score-glow, option-select, shake, bounce-correct)
- `frontend/src/components/MessageBubble.jsx` — Word-by-word typewriter reveal for new agent messages + slide-up entrance animation
- `frontend/src/components/Chat.jsx` — Score count-up animation + glow pulse, improved smooth scroll, button press/ripple effects, phase transition shimmer
- `frontend/src/components/PhaseIndicator.jsx` — Pulse/glow animation on phase circle during transitions
- `frontend/src/components/MCQPanel.jsx` — Option selection bounce animation, submit button press effect, panel entrance animation
- `frontend/src/components/ComprehensionPanel.jsx` — Bounce animation on correct answers, shake on wrong answers
- `frontend/src/hooks/useWebSocket.js` — Added `isNew` flag to WebSocket messages to distinguish live vs restored messages

**Context:** The app displayed content instantly with minimal motion. Adding micro-interactions (typewriter streaming, button feedback, phase pulse, score animations, MCQ selection/reveal effects) keeps the user's attention engaged during study sessions. All animations are pure CSS + minimal React state — no external libraries added.

## 2026-03-02
**Task:** Fixed startup crash caused by missing `deleted_at` column in existing SQLite database.

**Files Changed:**
- `study.db` — Added `deleted_at DATETIME` column to `concepts` table via ALTER TABLE.

**Context:** A previous edit added `deleted_at` to the `Concept` SQLAlchemy model (soft-delete support) but the existing `study.db` was never migrated. The app crashed on startup because SQLAlchemy queried for a column that didn't exist in the database.

## 2026-03-04
**Task:** Added DSA Template Drill feature — a standalone mode for practicing implementation of classic data structures and algorithms from memory.

**Files Changed:**
- `backend/agents/template_drill.py` — **Created.** Static catalog of 18 DSA templates (Trie, Union-Find, Segment Tree, BIT, Min Heap, LRU Cache, Monotonic Stack/Deque, Binary Search variants, Sliding Window, Two Pointers, BFS, DFS, Topological Sort, Dijkstra, KMP) with curated reference implementations, singleton CrewAI evaluation agent, and 5-axis scoring (structural, algorithmic, complexity, edge cases, quality).
- `backend/main.py` — Added 3 REST endpoints: `GET /api/dsa-templates` (list catalog), `GET /api/dsa-templates/{id}` (single template), `POST /api/dsa-templates/evaluate` (LLM-powered code evaluation).
- `backend/models/schemas.py` — Added `"dsa_template"` to allowed `quiz_type` in both `QuizHistorySave` and `QuizFeedbackCreate` validators.
- `frontend/src/pages/DSATemplateDrill.jsx` — **Created.** Full standalone page with 3 phases: template selector grid (grouped by category), code editor (matching existing CodeChallengePanel pattern), and evaluation results display (score breakdown bars, missing methods, bugs, feedback, collapsible reference implementation).
- `frontend/src/App.jsx` — Added lazy import, nav item, and route for `/dsa-templates`.

**Context:** The user wanted a way to practice typing out canonical DSA template implementations from memory, similar to how competitive programmers maintain a template library. The feature uses static template definitions (not LLM-generated) for determinism and accuracy, with LLM used only for evaluating user submissions. Follows the existing standalone quiz page pattern (REST API, sessionStorage persistence, auto-save to QuizHistory).
