# Development Diary

## 2026-04-22
**Task:** Full codebase refactor and simplification pass — eliminated duplication, centralized constants, fixed two bugs, removed dead code.
**Files Changed:**
- `backend/utils.py` — added `format_history()` and `skill_level_label()` shared utilities
- `backend/config.py` — added `SKILL_SCORE_ALPHA/BETA`, `SKILL_CONFIDENCE_INCREMENT`, `SKILL_MAX_MISCONCEPTIONS`, `HISTORY_CONTEXT_WINDOW`, `MCQ_CACHE_TTL/MAX_SIZE`
- `backend/main.py` — extracted `_save_message()`, `_maybe_send_comprehension_mcqs()`, local `_cache()` helper; inlined `transition_to_teach()`
- `backend/agents/professor.py` — uses `format_history/skill_level_label`; removed unused `mode` params
- `backend/agents/student.py` — uses `format_history/skill_level_label`
- `backend/agents/tester.py` — uses `format_history`; uses config constants for MCQ cache
- `backend/agents/orchestrator.py` — removed trivial `transition_to_teach()` method
- `backend/services/skill_tracker.py` — uses config constants instead of magic numbers
- `frontend/src/pages/Study.jsx` — fixed `mode` undefined bug (line 79)
- `frontend/src/components/Chat.jsx` — fixed `isCodeMode = true` hardcode; uses SpinnerIcon, PROSE_BASE
- `frontend/src/utils/proseClass.js` — new shared prose Tailwind constant
- `frontend/src/components/SpinnerIcon.jsx` — new shared spinner SVG component
- `frontend/src/hooks/useWebSocket.js` — named WS timing constants
- `frontend/src/pages/Review.jsx` — single-pass reduce instead of triple filter; uses SpinnerIcon
- `frontend/src/components/MessageBubble.jsx`, `CodeChallengePanel.jsx`, `ConceptDetail.jsx` — use SpinnerIcon, PROSE_BASE
- `frontend/src/hooks/usePersistedState.js` — deleted (unused)
- `frontend/src/components/ReportButton.jsx` — deleted (unused)
**Context:** Pure cleanup pass — no behavior changes. Reduces duplication ~15-20%, fixes two latent bugs, makes magic numbers configurable from a single location.

## 2026-04-21
**Task:** Pivoted project to a focused LeetCode-grounded Feynman learning loop, stripping all features beaten by NotebookLM.

**Files Changed:**
- `backend/agents/quiz_generator.py` — deleted (algorithm quiz, constraint quiz, ML math)
- `backend/agents/template_drill.py` — deleted (DSA template drill)
- `backend/agents/note_cleaner.py` — deleted (note cleanup agent)
- `frontend/src/pages/AlgorithmQuiz.jsx` — deleted
- `frontend/src/pages/MLMathDrill.jsx` — deleted
- `frontend/src/pages/DSATemplateDrill.jsx` — deleted
- `frontend/src/pages/Notes.jsx` — deleted
- `backend/main.py` — removed all cut endpoints; hardcoded mode to "leetcode"; added `difficulty` field to session start
- `backend/models/schemas.py` — replaced `mode` field with `difficulty` in `SessionStart`; removed `QuizHistorySave`, `QuizFeedbackCreate`, `NoteCleanRequest`
- `backend/agents/orchestrator.py` — re-enabled TEACH phase for LeetCode (was previously skipped); removed concept/industrial/MCQ branches; `SessionState` now has `difficulty` instead of `mode` variants
- `backend/agents/professor.py` — updated explanation prompt to always enumerate canonical solutions with complexity (grounds the tester evaluation)
- `backend/agents/tester.py` — removed `generate_mcq` and `score_mcq`; updated `evaluate_code` to reference canonical solutions from conversation history; updated `generate_code_challenge` to use `difficulty` parameter
- `frontend/src/App.jsx` — removed routes/nav for AlgorithmQuiz, DSATemplateDrill, Notes; kept Study, Review, Dashboard
- `frontend/src/pages/Study.jsx` — replaced 3-mode selector with Easy/Medium/Hard difficulty selector; hardcoded mode as "leetcode"
- `frontend/src/pages/Dashboard.jsx` — removed quiz history section and all related state; simplified to Study Progress + Spaced Review cards
- `frontend/src/components/Chat.jsx` — removed MCQPanel import and quiz phase rendering
- `frontend/src/components/ConceptDetail.jsx` — replaced dynamic MODE_CONFIG badge with hardcoded LeetCode badge

**Context:** The project was over-scoped relative to what NotebookLM already handles. The remaining core is: explain a real LeetCode problem (with canonical solutions stated by the professor) → teach it back (Feynman loop) → solve the real problem → get evaluated against known correct approaches → SM-2 schedules review. This is defensible and distinct from NotebookLM.

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
