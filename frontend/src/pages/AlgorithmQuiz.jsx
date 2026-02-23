import { useState, useEffect, useCallback } from "react";

function saveQuizHistory(quiz_type, topic, questions, answers, score) {
  fetch("/api/quiz-history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quiz_type, topic, questions, answers, score }),
  }).catch(() => {});
}

function usePersistedState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = sessionStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  const setAndPersist = useCallback((updater) => {
    setValue((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      sessionStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);
  return [value, setAndPersist];
}

const TABS = [
  { key: "algorithm", label: "Algorithm Selection" },
  { key: "constraint", label: "Constraint Matching" },
];

const TOPICS = [
  { value: "all", label: "All Topics" },
  { value: "graphs", label: "Graphs" },
  { value: "dp", label: "Dynamic Programming" },
  { value: "trees", label: "Trees" },
  { value: "sorting", label: "Sorting & Searching" },
  { value: "greedy", label: "Greedy" },
  { value: "strings", label: "Strings" },
  { value: "arrays", label: "Arrays & Hashing" },
  { value: "linked-lists", label: "Linked Lists" },
  { value: "binary-search", label: "Binary Search" },
  { value: "sliding-window", label: "Sliding Window" },
  { value: "stack-queue", label: "Stacks & Queues" },
];

export default function AlgorithmQuiz() {
  const [activeTab, setActiveTab] = usePersistedState("algoQuiz_activeTab", "algorithm");

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">Algorithm Quiz</h2>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-gray-800/60 rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-amber-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "algorithm" ? <AlgorithmTab /> : <ConstraintTab />}
    </div>
  );
}

/* ─── Algorithm Selection Tab ─────────────────────────────── */

function AlgorithmTab() {
  const [topic, setTopic] = usePersistedState("algoQuiz_topic", "all");
  const [questions, setQuestions] = usePersistedState("algoQuiz_questions", null);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = usePersistedState("algoQuiz_answers", {});
  const [revealed, setRevealed] = usePersistedState("algoQuiz_revealed", {});

  const generateQuiz = async () => {
    setLoading(true);
    setQuestions(null);
    setAnswers({});
    setRevealed({});
    try {
      const res = await fetch(`/api/algorithm-quiz?topic=${topic}&count=5`);
      const data = await res.json();
      setQuestions(data.questions);
    } catch (err) {
      console.error("Failed to generate quiz:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (qIdx, letter) => {
    if (revealed[qIdx]) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: letter }));
  };

  const handleReveal = (qIdx) => {
    setRevealed((prev) => ({ ...prev, [qIdx]: true }));
  };

  const totalAnswered = Object.keys(revealed).length;
  const totalCorrect = questions
    ? questions.filter((q, i) => revealed[i] && answers[i] === q.correct).length
    : 0;

  // Auto-save when all questions answered
  useEffect(() => {
    if (questions && totalAnswered === questions.length) {
      saveQuizHistory(
        "algorithm", topic, questions, answers,
        Math.round((totalCorrect / questions.length) * 100),
      );
    }
  }, [totalAnswered]);

  return (
    <>
      <p className="text-gray-400 mb-4 text-sm">
        Given a problem description, pick the best algorithm or approach.
      </p>

      {/* Topic selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TOPICS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTopic(t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              topic === t.value
                ? "bg-amber-600 border-amber-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <button
        onClick={generateQuiz}
        disabled={loading}
        className="px-6 py-3 bg-amber-600 text-white font-medium rounded-lg
                   hover:bg-amber-500 disabled:opacity-50 transition-colors mb-8"
      >
        {loading ? "Generating..." : "Generate Quiz"}
      </button>

      {questions && totalAnswered > 0 && (
        <div className="mb-6 p-3 bg-gray-800/60 rounded-lg border border-gray-700">
          <span className="text-sm text-gray-400">
            Score: <span className="text-white font-bold">{totalCorrect}/{totalAnswered}</span>
            {totalAnswered === questions.length && (
              <span className="ml-2">
                ({Math.round((totalCorrect / questions.length) * 100)}%)
              </span>
            )}
          </span>
        </div>
      )}

      {questions && (
        <div className="space-y-6">
          {questions.map((q, qIdx) => (
            <AlgorithmQuestion
              key={qIdx}
              index={qIdx}
              question={q}
              selectedAnswer={answers[qIdx]}
              isRevealed={revealed[qIdx]}
              onSelect={(letter) => handleSelect(qIdx, letter)}
              onReveal={() => handleReveal(qIdx)}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ─── Constraint Matching Tab ─────────────────────────────── */

const COMPLEXITY_REFERENCE = [
  { constraint: "n ≤ 10", complexity: "O(n!), O(2ⁿ·n)", algorithms: "Brute-force permutations, backtracking (all subsets), TSP brute-force, N-Queens" },
  { constraint: "n ≤ 15–20", complexity: "O(2ⁿ), O(2ⁿ·n)", algorithms: "Bitmask DP, subset enumeration, meet-in-the-middle, subset-sum DP" },
  { constraint: "n ≤ 50", complexity: "O(n⁴), O(2^(n/2))", algorithms: "Meet-in-the-middle, higher-order DP, matrix DP" },
  { constraint: "n ≤ 100", complexity: "O(n³)", algorithms: "Floyd-Warshall, matrix chain multiplication, interval DP, Gaussian elimination, network flow (small)" },
  { constraint: "n ≤ 500", complexity: "O(n³) tight", algorithms: "Hungarian algorithm, DP on intervals, Bellman-Ford (dense), LCS brute DP" },
  { constraint: "n ≤ 1,000", complexity: "O(n²)", algorithms: "Quadratic DP (LIS naive, edit distance), bubble/insertion sort, pairwise comparison, brute BFS/DFS on dense graphs" },
  { constraint: "n ≤ 5,000", complexity: "O(n²) tight", algorithms: "2D DP (knapsack, LCS), convex hull (n²), Dijkstra (no heap, dense)" },
  { constraint: "n ≤ 10⁵", complexity: "O(n log n)", algorithms: "Merge/quick sort, binary search, segment tree, BIT/Fenwick, Dijkstra (heap), Kruskal's, monotonic stack, LIS (binary search), sweep line" },
  { constraint: "n ≤ 5·10⁵", complexity: "O(n log n) tight", algorithms: "Segment tree + lazy propagation, heavy-light decomposition, centroid decomposition, suffix array, persistent data structures" },
  { constraint: "n ≤ 10⁶", complexity: "O(n)", algorithms: "Two pointers, sliding window, prefix sums, hashing, union-find, topological sort, BFS/DFS, KMP, Rabin-Karp, counting sort, bucket sort, monotonic deque" },
  { constraint: "n ≤ 10⁷", complexity: "O(n) tight", algorithms: "Sieve of Eratosthenes, linear-time selection, suffix automaton, radix sort" },
  { constraint: "n ≤ 10⁸+", complexity: "O(log n), O(√n), O(1)", algorithms: "Binary search, math formulas, matrix exponentiation, fast doubling, number theory (GCD, modpow), sqrt decomposition" },
];

function ConstraintTab() {
  const [questions, setQuestions] = usePersistedState("constQuiz_questions", null);
  const [loading, setLoading] = useState(false);
  // selections stored as { qIdx: [letters] } arrays (Sets aren't JSON-serializable)
  const [selectionsRaw, setSelectionsRaw] = usePersistedState("constQuiz_selections", {});
  const [revealed, setRevealed] = usePersistedState("constQuiz_revealed", {});
  const [showRef, setShowRef] = useState(false);

  // Convert stored arrays back to Sets for component use
  const selections = {};
  for (const [k, v] of Object.entries(selectionsRaw)) {
    selections[k] = new Set(v);
  }
  const setSelections = (updater) => {
    setSelectionsRaw((prev) => {
      // Convert prev arrays to Sets for the updater
      const prevSets = {};
      for (const [k, v] of Object.entries(prev)) {
        prevSets[k] = new Set(v);
      }
      const next = typeof updater === "function" ? updater(prevSets) : updater;
      // Convert Sets back to arrays for storage
      const out = {};
      for (const [k, v] of Object.entries(next)) {
        out[k] = v instanceof Set ? [...v] : v;
      }
      return out;
    });
  };

  const generateQuiz = async () => {
    setLoading(true);
    setQuestions(null);
    setSelectionsRaw({});
    setRevealed({});
    try {
      const res = await fetch("/api/constraint-quiz?count=5");
      const data = await res.json();
      setQuestions(data.questions);
    } catch (err) {
      console.error("Failed to generate quiz:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (qIdx, letter) => {
    if (revealed[qIdx]) return;
    setSelections((prev) => {
      const current = new Set(prev[qIdx] || []);
      if (current.has(letter)) {
        current.delete(letter);
      } else {
        current.add(letter);
      }
      return { ...prev, [qIdx]: current };
    });
  };

  const handleReveal = (qIdx) => {
    setRevealed((prev) => ({ ...prev, [qIdx]: true }));
  };

  const getScore = (qIdx) => {
    if (!questions || !revealed[qIdx]) return null;
    const q = questions[qIdx];
    const correctSet = new Set(q.correct);
    const userSet = selections[qIdx] || new Set();
    const correctPicks = [...userSet].filter((l) => correctSet.has(l)).length;
    const wrongPicks = [...userSet].filter((l) => !correctSet.has(l)).length;
    const missed = [...correctSet].filter((l) => !userSet.has(l)).length;
    return { correctPicks, wrongPicks, missed, total: correctSet.size };
  };

  const totalAnswered = Object.keys(revealed).length;
  const totalPerfect = questions
    ? questions.filter((q, i) => {
        if (!revealed[i]) return false;
        const s = getScore(i);
        return s && s.correctPicks === s.total && s.wrongPicks === 0;
      }).length
    : 0;

  // Auto-save when all questions answered
  useEffect(() => {
    if (questions && totalAnswered === questions.length) {
      const selObj = {};
      for (const [k, v] of Object.entries(selections)) {
        selObj[k] = [...v];
      }
      saveQuizHistory(
        "constraint", "all", questions, selObj,
        Math.round((totalPerfect / questions.length) * 100),
      );
    }
  }, [totalAnswered]);

  return (
    <>
      <p className="text-gray-400 mb-2 text-sm">
        Given problem keywords and constraints, select <strong className="text-white">ALL</strong> algorithms
        that could solve it within Python's ~10⁷ operation ceiling.
      </p>

      {/* Reference table toggle */}
      <div className="mb-6 bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowRef(!showRef)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-300 hover:text-white transition-colors"
        >
          <span>Complexity Reference Table</span>
          <span className={`text-xs text-gray-500 transition-transform ${showRef ? "rotate-180" : ""}`}>▼</span>
        </button>

        {showRef && (
          <div className="border-t border-gray-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400">
                  <th className="px-3 py-2 text-left">Constraint</th>
                  <th className="px-3 py-2 text-left">Max Complexity</th>
                  <th className="px-3 py-2 text-left">Common Algorithms</th>
                </tr>
              </thead>
              <tbody>
                {COMPLEXITY_REFERENCE.map((row, i) => (
                  <tr key={i} className="border-b border-gray-800 text-gray-300">
                    <td className="px-3 py-1.5 font-mono text-amber-400 whitespace-nowrap">{row.constraint}</td>
                    <td className="px-3 py-1.5 font-mono whitespace-nowrap">{row.complexity}</td>
                    <td className="px-3 py-1.5">{row.algorithms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button
        onClick={generateQuiz}
        disabled={loading}
        className="px-6 py-3 bg-amber-600 text-white font-medium rounded-lg
                   hover:bg-amber-500 disabled:opacity-50 transition-colors mb-8"
      >
        {loading ? "Generating..." : "Generate Quiz"}
      </button>

      {questions && totalAnswered > 0 && (
        <div className="mb-6 p-3 bg-gray-800/60 rounded-lg border border-gray-700">
          <span className="text-sm text-gray-400">
            Perfect: <span className="text-white font-bold">{totalPerfect}/{totalAnswered}</span>
            {totalAnswered === questions.length && (
              <span className="ml-2">
                ({Math.round((totalPerfect / questions.length) * 100)}%)
              </span>
            )}
          </span>
        </div>
      )}

      {questions && (
        <div className="space-y-6">
          {questions.map((q, qIdx) => (
            <ConstraintQuestion
              key={qIdx}
              index={qIdx}
              question={q}
              selected={selections[qIdx] || new Set()}
              isRevealed={revealed[qIdx]}
              score={getScore(qIdx)}
              onToggle={(letter) => toggleSelection(qIdx, letter)}
              onReveal={() => handleReveal(qIdx)}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ─── Shared: Algorithm Question (single select) ──────────── */

function AlgorithmQuestion({ index, question, selectedAnswer, isRevealed, onSelect, onReveal }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3">
      <p className="text-sm text-white font-medium">{index + 1}. {question.problem}</p>

      {question.example && (
        <div className="bg-gray-900 rounded-lg p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap">
          {question.example}
        </div>
      )}

      {question.constraints && (
        <p className="text-xs text-gray-500">Constraints: {question.constraints}</p>
      )}

      <div className="space-y-2">
        {question.options.map((option, oIdx) => {
          const letter = option.charAt(0);
          const isSelected = selectedAnswer === letter;
          const isCorrectOption = question.correct === letter;

          let optionClass =
            "bg-gray-900/40 border-gray-700 text-gray-300 hover:border-gray-500 cursor-pointer";
          if (isRevealed) {
            if (isCorrectOption) {
              optionClass = "bg-green-900/30 border-green-600 text-green-300";
            } else if (isSelected) {
              optionClass = "bg-red-900/30 border-red-600 text-red-300";
            } else {
              optionClass = "bg-gray-900/40 border-gray-700 text-gray-500";
            }
          } else if (isSelected) {
            optionClass = "bg-indigo-600/30 border-indigo-500 text-white";
          }

          return (
            <button
              key={oIdx}
              onClick={() => onSelect(letter)}
              disabled={isRevealed}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border disabled:cursor-default ${optionClass}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {selectedAnswer && !isRevealed && (
        <button
          onClick={onReveal}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-500 transition-colors"
        >
          Check Answer
        </button>
      )}

      {isRevealed && question.explanation && (
        <div
          className={`text-sm p-3 rounded-lg ${
            selectedAnswer === question.correct
              ? "bg-green-900/20 text-green-400 border border-green-700/50"
              : "bg-red-900/20 text-red-400 border border-red-700/50"
          }`}
        >
          {selectedAnswer === question.correct ? "Correct! " : "Incorrect. "}
          {question.explanation}
        </div>
      )}
    </div>
  );
}

/* ─── Constraint Question (multi-select) ──────────────────── */

function ConstraintQuestion({ index, question, selected, isRevealed, score, onToggle, onReveal }) {
  const correctSet = new Set(question.correct);

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3">
      {/* Keywords */}
      <div className="flex items-start gap-2">
        <span className="text-sm text-gray-400 font-medium shrink-0">{index + 1}.</span>
        <div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {question.keywords.map((kw, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-amber-600/20 border border-amber-600/40 rounded text-xs text-amber-300 font-medium"
              >
                {kw}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400 font-mono">{question.constraints}</p>
        </div>
      </div>

      {/* Select-all hint */}
      {!isRevealed && (
        <p className="text-xs text-gray-500 italic">Select all algorithms that could work:</p>
      )}

      {/* Options (multi-select checkboxes) */}
      <div className="grid grid-cols-2 gap-2">
        {question.options.map((option, oIdx) => {
          const letter = option.charAt(0);
          const isSelected = selected.has(letter);
          const isCorrect = correctSet.has(letter);

          let optionClass =
            "bg-gray-900/40 border-gray-700 text-gray-300 hover:border-gray-500 cursor-pointer";
          if (isRevealed) {
            if (isCorrect && isSelected) {
              optionClass = "bg-green-900/30 border-green-600 text-green-300";
            } else if (isCorrect && !isSelected) {
              optionClass = "bg-yellow-900/30 border-yellow-600 text-yellow-300";
            } else if (!isCorrect && isSelected) {
              optionClass = "bg-red-900/30 border-red-600 text-red-300";
            } else {
              optionClass = "bg-gray-900/40 border-gray-700 text-gray-500";
            }
          } else if (isSelected) {
            optionClass = "bg-indigo-600/30 border-indigo-500 text-white";
          }

          return (
            <button
              key={oIdx}
              onClick={() => onToggle(letter)}
              disabled={isRevealed}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-colors border disabled:cursor-default flex items-center gap-2 ${optionClass}`}
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs shrink-0 ${
                isSelected
                  ? isRevealed
                    ? isCorrect ? "bg-green-600 border-green-600" : "bg-red-600 border-red-600"
                    : "bg-indigo-600 border-indigo-600"
                  : "border-gray-600"
              }`}>
                {isSelected && "✓"}
              </span>
              {option}
            </button>
          );
        })}
      </div>

      {/* Check answer button */}
      {selected.size > 0 && !isRevealed && (
        <button
          onClick={onReveal}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-500 transition-colors"
        >
          Check Answer
        </button>
      )}

      {/* Score + explanation */}
      {isRevealed && score && (
        <div className={`text-sm p-3 rounded-lg space-y-1 ${
          score.wrongPicks === 0 && score.missed === 0
            ? "bg-green-900/20 text-green-400 border border-green-700/50"
            : "bg-amber-900/20 text-amber-400 border border-amber-700/50"
        }`}>
          <div className="font-medium">
            {score.wrongPicks === 0 && score.missed === 0
              ? "Perfect!"
              : `${score.correctPicks}/${score.total} correct`}
            {score.wrongPicks > 0 && `, ${score.wrongPicks} wrong pick${score.wrongPicks > 1 ? "s" : ""}`}
            {score.missed > 0 && `, ${score.missed} missed`}
          </div>
          {question.explanation && (
            <p className="text-xs opacity-80 whitespace-pre-wrap">{question.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
