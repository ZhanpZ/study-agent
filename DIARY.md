# Development Diary

## 2026-07-16 (4)
**Task:** Updated `CLAUDE.md` to match the README rewrite — replaced the stale "no automated tests configured" line with real test commands and documented `llm_guard.py`.
**Files Changed:** `CLAUDE.md`
**Context:** Follow-up to the README rewrite in the previous entry; `CLAUDE.md` had drifted the same way. Added a Tests subsection under Development Commands (pytest + vitest commands, `pytest.ini`/`conftest.py` fixture notes, CI workflow reference), and added `llm_guard.py` to the Architecture and Key Patterns (Agent pattern) sections so both docs describe `call_agent_task()` as the required call path instead of raw `agent.execute_task()`.

## 2026-07-16 (3)
**Task:** Rewrote `README.md` to reflect the project's current architecture, testing setup, and CI, which had drifted since tests/CI were added.
**Files Changed:** `README.md`
**Context:** README previously said "no automated tests or linting are configured" (copied from `CLAUDE.md`, itself now stale) and had no Architecture/Key Patterns sections, even though `tests/`, `frontend/src/__tests__/`, `pytest.ini`, `requirements-dev.txt`, and `.github/workflows/test.yml` already existed on this branch. Added a Testing section (backend `pytest`/`pytest-asyncio` via `requirements-dev.txt`, frontend `vitest` via `npm run test`/`test:watch`, CI workflow), folded in `CLAUDE.md`'s Architecture/Key Patterns sections so the README stands alone for a new contributor, and documented `backend/services/llm_guard.py` (the timeout/retry/circuit-breaker wrapper added earlier today) since it's now the required call path for LLM calls. Did not touch `CLAUDE.md`'s stale "no tests configured" line — out of scope for this task, flagged to the user separately.

## 2026-07-16 (2)
**Task:** Added guardrails and a circuit breaker around every LLM call, and fixed a pre-existing bug where the WebSocket handler blocked the whole event loop during LLM calls.
**Files Changed:** `backend/services/llm_guard.py` (new — timeout + tenacity retry + hand-rolled circuit breaker wrapper), `backend/requirements.txt` (documented `tenacity`, already present transitively), `backend/agents/{professor,student,tester,quiz_generator,template_drill,note_cleaner}.py` (all `agent.execute_task()` call sites now go through `call_agent_task`; raw calls in `tester.py::detect_critical_errors` and `services/streaming.py::stream_to_ws` share the same breaker via `check_circuit`/`record_success`/`record_failure`), `backend/main.py` (7 previously-synchronous LLM calls in the WS handler + 2 REST endpoints now wrapped in `asyncio.to_thread`; WS loop hardened with JSON/schema validation, a catch-all `except Exception` + `finally` so `active_sessions` can't leak and phase is always persisted on exit), `backend/models/schemas.py` (`WSMessage` extended with `answers`/`code`/`language` + length caps; new `MCQResponse`, `CodeChallengeResponse`, `NoteCleanResult`, `DsaTemplateEvaluateRequest` models), `backend/utils.py` (new `parse_and_validate` helper wiring the extract-JSON-then-validate pattern into `tester.py`, `quiz_generator.py`, `template_drill.py`, `note_cleaner.py` — previously-unused Pydantic models like `AlgorithmQuizResponse`/`ConstraintQuizResponse`/`MLMathResponse` now actually validate LLM output), `backend/agents/orchestrator.py` (new `should_force_evaluate`/`should_force_complete` functions enforce the previously-unwired `MAX_TEACH_ROUNDS`, shared between `_handle_teach`/`_finalize_evaluation` and `main.py`'s duplicate inline teach-round logic so they can't drift).
**Context:** Investigation (see conversation) found every LLM call in the codebase had no timeout, no retry, and no shared failure isolation — a hung OpenAI call would block indefinitely. Separately, `main.py`'s WS handler called several LLM-backed orchestrator methods synchronously inside `async def`, meaning one session's slow LLM call blocked the event loop for *all* concurrent sessions; two REST endpoints (`/api/dsa-templates/evaluate`, `/api/notes/clean-and-save`) had the same bug. `MAX_TEACH_ROUNDS=5` existed in `config.py` and on `SessionState` but was never read, so a user who never crossed the mastery threshold could cycle TEACH↔EVALUATE forever. Verified with a standalone script (mock agents raising retryable/non-retryable/timeout exceptions) that retry-then-succeed, fail-fast-on-non-retryable, breaker-opens-after-5-failures, and timeout-classified-as-retryable all behave as designed; also verified `WSMessage`/`DsaTemplateEvaluateRequest` reject oversized/malformed input and `should_force_evaluate`/`should_force_complete` fire at the right round counts. Full `pytest tests/` suite (183 tests) still passes with no changes needed.

## 2026-07-16
**Task:** Built out comprehensive test coverage (backend REST API, WebSocket, recommender, utils; frontend components) and added a GitHub Actions CI workflow, treating the project as a consumer product requiring modern engineering rigor.
**Files Changed:** `tests/conftest.py` (added `api_client` fixture), `tests/test_api.py` (new, 35 tests), `tests/test_websocket.py` (new, 4 tests), `tests/test_recommender.py` (new, 12 tests), `tests/test_utils.py` (new, 9 tests), `tests/test_concept_matcher.py` and `tests/test_scheduler.py` (fixed 2 stale assertions — see Context), `requirements-dev.txt` (added `pytest-cov`, `httpx`), `.github/workflows/test.yml` (new CI pipeline), `frontend/vitest.config.js`, `frontend/src/test-setup.js` (new), `frontend/src/__tests__/PhaseIndicator.test.jsx` and `MCQPanel.test.jsx` (new), `frontend/package.json` (added `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`).
**Context:** Backend test suite grew from 117 → 183 passing tests, frontend from 22 → 31. Two pre-existing test failures were stale rather than real regressions: `test_excludes_future` in `test_scheduler.py` asserted `get_due_reviews` excludes future-dated reviews, but the function was intentionally changed to return *all* concepts with a `status` field (`due`/`new`/`upcoming`) that the frontend filters on — updated the test to assert `status == "upcoming"` instead. `test_substring_containment_bonus` in `test_concept_matcher.py` asserted `similarity("binary search", "binary search tree") >= 0.85`, but that pair's coverage ratio (13/19 ≈ 0.68) falls below the 0.75 containment-bonus threshold, so it correctly falls through to fuzzy-ratio scoring (~0.84) — split into two tests, one confirming the bonus applies above threshold and one confirming it doesn't below threshold. REST API tests use `httpx.AsyncClient` with `ASGITransport` and a `get_db` dependency override bound to a `StaticPool` in-memory SQLite engine (shares one connection across requests within a test). WebSocket tests use `fastapi.testclient.TestClient` with a temp-file-backed SQLite DB instead of in-memory — avoids aiosqlite connections binding to the wrong event loop when TestClient's blocking portal runs the ASGI app on its own thread/loop. LLM-calling code paths (`stream_to_ws`, `generate_comprehension_mcqs`, `generate_code_challenge`) are monkeypatched in WebSocket tests since CrewAI/OpenAI calls aren't mockable at the unit level without a real API key.

## 2026-07-15
**Task:** Moved `.env` from the project root into `backend/` so secrets live alongside the code that consumes them.
**Files Changed:** `backend/config.py`, `README.md`, `CLAUDE.md` (moved: `.env` → `backend/.env`)
**Context:** `config.py` previously resolved `.env` via `dirname(__file__)/../.env`; now resolves it via `dirname(__file__)/.env`. `.gitignore`'s bare `.env` pattern still matches the new path (git ignore patterns without a leading `/` match at any depth), so no gitignore change was needed. Verified `backend.config` still loads `OPENAI_API_KEY`/`DATABASE_URL` correctly from the new location.

## 2026-06-26 (2)
**Task:** Fixed "Merge Similar Topics" deleting a topic and orphaning its sessions.
**Files Changed:** `backend/services/concept_matcher.py`, `backend/main.py`
**Context:** Two bugs combined. (1) `deduplicate_concepts` scanned soft-deleted concepts — fixed by adding `WHERE deleted_at IS NULL`. (2) Sessions were reassigned in the ORM identity map but not flushed before `db.delete(source)`, which let SQLAlchemy's relationship-cleanup issue a `SET NULL` update that could orphan sessions — fixed by calling `await db.flush()` before each delete in both the auto-dedup and manual merge paths. (3) The `similarity()` substring-containment bonus unconditionally returned 0.85 for any substring pair (e.g. "Sorting" ⊂ "Sorting Algorithms"), causing false-positive merges — fixed to only apply the bonus when coverage ≥ 75% and to return the actual coverage ratio instead of a hard 0.85 floor.

## 2026-06-26
**Task:** Fixed "New Session" carrying over messages from the previous session into the new one.
**Files Changed:** `frontend/src/hooks/useWebSocket.js`
**Context:** The `RESET_SESSION` reducer case (dispatched when `sessionId` changes to a new value) was clearing MCQ/challenge/summary state but not the `messages` array. Adding `messages: []` to that case ensures the chat history is wiped when a new session starts.

## 2026-06-25 (18)
**Task:** Replaced all vivid/nylon colors with monotonic calm tones (teal/amber theme), and added a tomato 🍅 inside the Pomodoro clock ring.
**Files Changed:** `frontend/src/components/PomodoroTimer.jsx`, `frontend/src/components/PhaseIndicator.jsx`, `frontend/src/components/MessageBubble.jsx`, `frontend/src/components/Chat.jsx`, `frontend/src/components/MCQPanel.jsx`, `frontend/src/components/CodeChallengePanel.jsx`, `frontend/src/components/ComprehensionPanel.jsx`, `frontend/src/components/ConceptDetail.jsx`, `frontend/src/components/CodeBlock.jsx`, `frontend/src/components/CodeEditor.jsx`, `frontend/src/pages/AlgorithmQuiz.jsx`, `frontend/src/pages/MLMathDrill.jsx`, `frontend/src/pages/DSATemplateDrill.jsx`, `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/Review.jsx`
**Context:** Removed all bright blue/green/purple/indigo/violet/orange/emerald/yellow/pink across the UI. Replaced with `focus-teal`/`focus-amber` custom theme colors. Phase indicators are now monotone teal. MCQ/quiz results use teal for correct (vs. bright green). All CTA buttons use `bg-focus-teal`. Pomodoro tomato added as an overlay emoji inside the SVG ring.

## 2026-06-25 (17)
**Task:** Top "Generate Quiz" button now only shows on first load; subsequent regeneration uses a floating bottom-right button.
**Files Changed:** `frontend/src/pages/AlgorithmQuiz.jsx`
**Context:** Top button condition narrowed to `!questions` (first-time only). After completing a quiz, only the floating `fixed bottom-6 right-6` button appears so users don't need to scroll back to the top.

## 2026-06-25 (16)
**Task:** Hide the "Generate Quiz" button while a quiz is in progress; restore it (as "Generate New Quiz") once all questions are answered.
**Files Changed:** `frontend/src/pages/AlgorithmQuiz.jsx`
**Context:** Both `AlgorithmTab` and `ConstraintTab` now conditionally render the generate button only when `!questions || totalAnswered === questions.length`. Label changes to "Generate New Quiz" after first completion for clarity.

## 2026-06-25 (15)
**Task:** Algorithm Mastery bars now refresh automatically after completing a quiz instead of requiring a page reload.
**Files Changed:** `frontend/src/pages/AlgorithmQuiz.jsx`, `frontend/src/utils/saveQuizHistory.js`
**Context:** `saveQuizHistory` was fire-and-forget; the mastery `useEffect` only ran on mount. Fixed by making `saveQuizHistory` return its promise, extracting mastery fetch into `refreshMastery()`, and chaining `.then(() => refreshMastery())` after the save completes.

## 2026-06-25 (14)
**Task:** Moved the "Today" study-time widget from the Dashboard into the global header, next to the Pomodoro timer, with a live second-by-second animated clock.
**Files Changed:** `frontend/src/components/TodayWidget.jsx` (new), `frontend/src/App.jsx`, `frontend/src/pages/Dashboard.jsx`, `backend/main.py`
**Context:** The backend `/api/goals/today` now returns full-precision `actual_minutes` and an `active_session` boolean. The widget polls every 10s; between polls it interpolates forward by 1 second only when `active_session` is true. An SVG clock face with animated minute/second hands ticks every second. The Today section was removed from Dashboard.jsx along with its state and fetch call.

## 2026-06-25 (13)
**Task:** Merged DSA Template Drill into the Algorithm Quiz page as a third tab, removing it as a separate navbar entry.
**Files Changed:** `frontend/src/App.jsx`, `frontend/src/pages/AlgorithmQuiz.jsx`, `frontend/src/pages/DSATemplateDrill.jsx`
**Context:** User wanted both features under a single navbar link and single page. Added `hideHeader` prop to `DSATemplateDrill` to suppress the standalone h2 heading when rendered as a tab (keeping the description and "Back to templates" button). Removed the `/dsa-templates` route and nav entry from `App.jsx`. Added a "DSA Drill" third tab to `AlgorithmQuiz` that renders `<DSATemplateDrill hideHeader />`. All existing persisted state keys (`dsaDrill_*`) and backend endpoints are untouched.

## 2026-06-25 (12)
**Task:** Added semantic (embedding-based) deduplication so that conceptually similar topics like "SOLID principals" and "Give me a review on L in SOLID principal" are automatically merged into one, preserving all sessions and conversations from both.
**Files Changed:** `backend/services/concept_matcher.py`, `backend/config.py`, `backend/main.py`, `frontend/src/pages/Dashboard.jsx`
**Context:** The existing fuzzy matcher used difflib SequenceMatcher (syntactic only), which scored those two topics far below the 0.7 threshold. Added `_fetch_embeddings` (batched OpenAI `text-embedding-3-small` call) and `_cosine_similarity` to `concept_matcher.py`. `deduplicate_concepts` now falls back to semantic similarity (threshold 0.82) when syntactic similarity is insufficient. The `/api/concepts/deduplicate` endpoint defaults to `semantic=True`. A "Merge similar topics" button in the Study Progress section triggers deduplication and refreshes skills/reviews data on success.

## 2026-06-25 (11)
**Task:** Merged the Spaced Review card into the Study Progress card, showing next-review timing inline on each concept row.
**Files Changed:** `frontend/src/pages/Dashboard.jsx`
**Context:** Removed the standalone Spaced Review SectionCard. Each concept in Study Progress now shows a small badge ("Due now", "Due today", or "In Xd") next to its score, derived from the existing `reviewsDue` data (which already fetches all concepts with their SM-2 schedule status). Added `getReviewLabel` helper to compute the badge. Updated skeleton loader from 4 to 2 section card placeholders.

## 2026-06-25 (10)
**Task:** Added MCQ results view after study session quiz submission, showing per-question correct/wrong highlighting instead of discarding the questions immediately.
**Files Changed:** `frontend/src/hooks/useWebSocket.js`, `frontend/src/components/MCQPanel.jsx`, `frontend/src/components/Chat.jsx`, `frontend/src/pages/Study.jsx`
**Context:** Previously `CLEAR_MCQ` wiped questions the moment the user submitted, leaving only a vague "you missed X topic" text. Now `SUBMIT_MCQ` keeps the questions and stores the submitted answers; MCQPanel switches to a results mode that colors correct options green and the user's wrong picks red, with labels indicating which answer was correct.

## 2026-06-25 (9)
**Task:** Added spinner and GeneratingLoader to MLMathDrill's "Start Drill / Next Question" button, which previously showed no visual feedback during the 30s AI wait.
**Files Changed:** `frontend/src/pages/MLMathDrill.jsx`
**Context:** Follow-up to the loading UI pass — DSATemplateDrill and Notes already had spinners; MLMathDrill was the remaining gap.

## 2026-06-25 (8)
**Task:** Added animated loading UI for all generating buttons and async delete actions to reassure users the app isn't frozen.
**Files Changed:** `frontend/src/components/GeneratingLoader.jsx` (new), `frontend/src/pages/AlgorithmQuiz.jsx`, `frontend/src/pages/Dashboard.jsx`
**Context:** Quiz generation can take 30–90s with no visual feedback. Added a `GeneratingLoader` component with a cycling status message, fake-progress bar, and spinner. Used it in both AlgorithmTab and ConstraintTab. Also added per-item spinner states to Dashboard's concept delete, activity-row delete, and quiz history reset buttons.

## 2026-06-25 (7)
**Task:** Hid Notes from the navbar while keeping `/notes` accessible as a secret direct URL.
**Files Changed:** `frontend/src/App.jsx`
**Context:** Removed the Notes entry from `NAV_ITEMS` only — the route and lazy-loaded component are untouched, so navigating to `/notes` still works.

## 2026-06-25 (6)
**Task:** Made Spaced Review concepts clickable (opens ConceptDetail modal) and added cleanTopicName to strip prompt-style prefixes from display names.

**Files Changed:**
- `frontend/src/pages/Dashboard.jsx` — Added `cleanTopicName` helper (strips "Explain to me", "What is", "Tell me about", etc.); applied to Study Progress and Spaced Review name displays; converted Spaced Review items from static divs to clickable buttons that open ConceptDetail, cross-referencing skills for score.

## 2026-06-25 (5)
**Task:** Removed /review from nav and deleted Study Next section from Dashboard.

**Files Changed:**
- `frontend/src/App.jsx` — Removed Review lazy import, nav item, and route.
- `frontend/src/pages/Dashboard.jsx` — Removed Study Next SectionCard and its recommendations state/fetch; removed unused `useNavigate`; updated Spaced Review card link from `/review` to `/`.


## 2026-06-25 (4)
**Task:** Fixed Algorithm Quiz duplicate saves; replaced bar chart with per-algorithm mastery view and added reset button.

**Files Changed:**
- `frontend/src/pages/AlgorithmQuiz.jsx` — Added `hasSaved` persisted state to both `AlgorithmTab` and `ConstraintTab`; guard `saveQuizHistory` with `!hasSaved` and set it `true` after saving; reset to `false` when generating a new quiz.
- `frontend/src/pages/Dashboard.jsx` — Replaced per-session score bars with per-algorithm mastery bars (labeled by algorithm name, showing correct/total counts); added "Reset" button that bulk-deletes all algorithm and constraint quiz history.
- `backend/main.py` — Added `DELETE /api/quiz-history` bulk-delete endpoint with optional `quiz_type` query param.

**Context:** `usePersistedState` stores quiz state in `sessionStorage`. When the user navigated back to the quiz page, state was restored with all questions answered, causing the `useEffect` auto-save to re-fire and POST a duplicate history entry on every visit. The `hasSaved` flag acts as a once-per-session guard. The old bar chart showed only raw session scores with no labels; replaced with per-algorithm mastery derived by parsing `questions`/`answers` from stored quiz history entries (same logic as the AlgorithmQuiz page's mastery bars).

## 2026-06-25 (3)
**Task:** Fixed Algorithm Quiz failing to generate by resolving async blocking and timeout issues.

**Files Changed:**
- `backend/main.py` — Wrapped `generate_algorithm_quiz`, `generate_constraint_quiz`, and `generate_ml_math_question` calls in `asyncio.to_thread()` so the synchronous CrewAI/LLM work runs in a thread pool instead of blocking the event loop.
- `frontend/src/pages/AlgorithmQuiz.jsx` — Increased quiz generation fetch timeout from 30s to 90s (both Algorithm and Constraint tabs); added "This may take up to 60s…" hint text shown while loading.

**Context:** The quiz generation pipeline makes 6+ sequential LLM calls (1 generation + 5 per-question verifications), which can easily exceed 30 seconds with GPT-4o. The frontend's 30s `AbortController` timeout was aborting requests before the backend finished, causing a silent "Failed to generate quiz" error toast. Additionally, the synchronous CrewAI functions were called directly in `async def` FastAPI handlers, which blocked the entire asyncio event loop and prevented any other requests from being served during generation.

## 2026-06-25 (2)
**Task:** Fixed session notes rendering raw markdown instead of formatted HTML in ConceptDetail.

**Files Changed:**
- `frontend/src/components/ConceptDetail.jsx` — Added `stripMarkdownFence` utility and applied it to `summaryContent` before passing to `ReactMarkdown`.
- `backend/agents/professor.py` — Added explicit instruction to the summary prompt to output raw markdown without wrapping in a code fence.

**Context:** The LLM was wrapping its entire summary output in a ` ```markdown ``` ` code fence. `ReactMarkdown` then rendered the whole thing as a `<pre><code>` block, making `#`, `**`, and `-` characters appear literally in monospace font. The frontend fix strips any such outer fence defensively; the backend fix tells the model not to add it.


## 2026-06-25
**Task:** Fixed Dashboard crash (Rules of Hooks violation) and added full conversation history view to ConceptDetail modal.

**Files Changed:**
- `frontend/src/pages/Dashboard.jsx` — Moved all `useMemo` calls above the `if (loading) return` early return to fix "Rendered more hooks than during the previous render" crash.
- `frontend/src/components/ConceptDetail.jsx` — Added "Conversation" tab alongside "Session Notes" tab; now fetches full message history from `/api/session/{id}` and renders it as a chat log when a past session is expanded.

**Context:** The Dashboard crash was a classic React Rules of Hooks violation — `useMemo` hooks were placed after an early return, so they were skipped on the initial loading render and then called on the next render, changing the hook count. The ConceptDetail modal previously only fetched the AI-generated summary (`/api/session/{id}/summary`), so users had no way to view the actual back-and-forth conversation after a session ended. The full messages were always stored in the DB; the frontend just never fetched them for review.

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
