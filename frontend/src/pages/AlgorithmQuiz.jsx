import { useState } from "react";

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
  const [topic, setTopic] = useState("all");
  const [questions, setQuestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({});

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

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">Algorithm Selection Quiz</h2>
      <p className="text-gray-400 mb-6">
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

      {/* Score summary */}
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

      {/* Questions */}
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
    </div>
  );
}

function AlgorithmQuestion({ index, question, selectedAnswer, isRevealed, onSelect, onReveal }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3">
      {/* Problem */}
      <p className="text-sm text-white font-medium">{index + 1}. {question.problem}</p>

      {/* Example */}
      {question.example && (
        <div className="bg-gray-900 rounded-lg p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap">
          {question.example}
        </div>
      )}

      {/* Constraints */}
      {question.constraints && (
        <p className="text-xs text-gray-500">Constraints: {question.constraints}</p>
      )}

      {/* Options */}
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

      {/* Check answer button */}
      {selectedAnswer && !isRevealed && (
        <button
          onClick={onReveal}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-500 transition-colors"
        >
          Check Answer
        </button>
      )}

      {/* Explanation */}
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
