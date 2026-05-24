# Development Diary

## 2026-05-23 (hotfix)
**Task:** Fixed 500 error on session start caused by missing `tags` and `prerequisites` columns in the `concepts` table.

**Files Changed:**
- `study.db` — Added `tags` (JSON) and `prerequisites` (JSON) columns via `ALTER TABLE`.

**Context:** The ORM model was updated to include these columns but the existing database was never migrated. SQLite doesn't support `CREATE TABLE IF NOT EXISTS` schema evolution, so an explicit `ALTER TABLE` was needed.

---

## 2026-05-23
**Task:** Implemented 6 creative improvement initiatives across the full stack — teach-back integrity gate, token streaming, real code editor, adaptive algorithm quiz, time tracking, and a recommendation engine.

**Files Changed:**
- `backend/agents/tester.py` — Added `detect_critical_errors()` for lightweight factual-error detection during teach-back; `evaluate_code()` now accepts a `language` param.
- `backend/agents/student.py` — `ask_questions()` injects detected errors as Socratic redirects and targets `pending_gaps` from last evaluation.
- `backend/agents/orchestrator.py` — `SessionState` gains `pending_gaps`; `_handle_teach()` calls error detector and passes errors+gaps; `_finalize_evaluation()` stores gaps for next round.
- `backend/agents/quiz_generator.py` — `generate_algorithm_quiz()` accepts `bias_toward` to skew question generation toward weak patterns.
- `backend/services/streaming.py` — **Created.** `stream_to_ws()` streams OpenAI tokens over WebSocket (`stream_start`/`stream_chunk`/`stream_end`), bypassing CrewAI's blocking `execute_task()`. Includes all prompt-builder helpers.
- `backend/services/recommender.py` — **Created.** Recommendation engine ranking concepts by SM-2 due date, skill score, and a hardcoded prerequisite graph.
- `backend/models/tables.py` — `Session` gains `phase_timestamps` JSON column; new `StudyGoal` table (date, target_minutes, actual_minutes, streak_days); `Concept` gains `tags` and `prerequisites` JSON columns.
- `backend/main.py` — EXPLAIN/TEACH/EXPLAIN_DONE phases stream via `stream_to_ws()`; new `_stamp_phase()` helper records phase timestamps to DB; new `GET /api/goals/today` endpoint (daily minutes + streak); new `GET /api/recommendations` endpoint; `GET /api/algorithm-quiz` accepts `?focus=` bias param; `GET /api/quiz-history/weaknesses` added.
- `frontend/src/components/CodeEditor.jsx` — **Created.** Shared CodeMirror 6 editor with vscodeDark theme and `LanguageSelector` for Python/JS/Java/C++.
- `frontend/src/components/CodeChallengePanel.jsx` — Replaced textarea with `CodeEditor`; passes selected language on submit.
- `frontend/src/components/MessageBubble.jsx` — Accepts `streaming` prop; disables word-by-word animation during real streaming; shows blinking teal cursor while streaming.
- `frontend/src/components/Chat.jsx` — Passes `streaming` prop to `MessageBubble`; live session timer (`mm:ss`); teach-phase code input upgraded to `CodeEditor`.
- `frontend/src/hooks/useWebSocket.js` — `STREAM_START`/`STREAM_CHUNK`/`STREAM_END` reducer actions; token-by-token message building; `sendCodeAnswer()` sends `language`.
- `frontend/src/pages/AlgorithmQuiz.jsx` — Fetches `/api/quiz-history/weaknesses`; biases `generateQuiz()` with top 3 weak patterns; per-algorithm mastery bars.
- `frontend/src/pages/Dashboard.jsx` — "Today" widget (minutes studied + goal progress bar + streak); "Study Next" card with ranked recommendations and one-click navigation.
- `frontend/src/pages/Study.jsx` — Reads `?topic=` query param to pre-fill topic input (used by Dashboard "Study Next" card).
- `frontend/src/pages/DSATemplateDrill.jsx` — Upgraded code textarea to `CodeEditor`.

**Context:** Six improvements in one session. Streaming (Initiative 2) required bypassing CrewAI entirely for professor/student agents — the system prompt is reconstructed from role/goal/backstory in `streaming.py`. Tester agent is NOT streamed (JSON must be parsed atomically). The `phase_timestamps` column is nullable to avoid requiring a DB migration on existing databases — SQLAlchemy `create_all` adds new columns only on fresh DBs; existing DBs need an `ALTER TABLE` if they predate this change.

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

## 2026-03-05
**Task:** Comprehensive performance and code quality optimization pass across backend and frontend — no new features added.

**Files Changed:**
- `backend/models/tables.py` — Added 4 missing database indexes: `ix_concepts_name`, `ix_concepts_deleted_at`, `ix_sessions_started_at`, `ix_sessions_phase`.
- `backend/services/concept_matcher.py` — Optimized fuzzy matching: filters out deleted concepts, adds length-ratio pre-filter to skip obviously dissimilar names.
- `backend/main.py` — Removed O(n^2) `deduplicate_concepts()` from server startup (moved to manual `POST /api/concepts/deduplicate` endpoint). Added `logging` module and replaced silent `except Exception: pass` with proper error logging on WebSocket disconnect. Removed unused import.
- `backend/services/leetcode_fetcher.py` — Moved `httpx.Client` creation outside the retry loop so the same client is reused across retry attempts.
- `backend/agents/tester.py` — Removed unused `generate_review_questions()` function (dead code).
- `frontend/src/components/Chat.jsx` — Wrapped `handleInputFocus`, `handleSubmit`, `handleCodeSubmit`, `handleTabKey` in `useCallback`. Extracted inline `CodeChallengePanel` to its own file.
- `frontend/src/components/CodeChallengePanel.jsx` — **Created.** Extracted from Chat.jsx for isolated re-renders and better code organization.
- `frontend/src/components/CodeBlock.jsx` — Lazy-loads `react-syntax-highlighter` (~200KB) via dynamic import with a plain `<pre>` fallback while loading. Preloads on module import so it's ready by the time user sees code blocks.
- `frontend/src/pages/Dashboard.jsx` — Replaced inline IIFEs (top gaps, topic breakdown) with `useMemo` hooks to avoid recalculation on every render.
- `frontend/src/hooks/useWebSocket.js` — Refactored from 12 individual `useState` calls to a single `useReducer`, batching related state updates (e.g., score+gaps, phase+thinking) into single dispatches. Removed redundant `connected` state (now derived from `connectionStatus`).

**Context:** Pure optimization pass — no new functionality. Key improvements: faster startup (no O(n^2) dedup), faster concept matching (pre-filtering + deleted exclusion), fewer React re-renders per WebSocket message (useReducer batching, useCallback memoization), smaller initial bundle (lazy-loaded syntax highlighter), and better code organization (extracted CodeChallengePanel).
