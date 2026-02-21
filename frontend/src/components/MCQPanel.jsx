import { useState } from "react";

export default function MCQPanel({ questions, onSubmit }) {
  const [answers, setAnswers] = useState(Array(questions.length).fill(""));

  const handleSelect = (questionIdx, option) => {
    // Extract the letter (e.g., "A" from "A) ...")
    const letter = option.charAt(0);
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIdx] = letter;
      return next;
    });
  };

  const allAnswered = answers.every((a) => a !== "");

  const handleSubmit = () => {
    if (allAnswered) {
      onSubmit(answers);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">Knowledge Check</h3>
      {questions.map((q, qIdx) => (
        <div
          key={qIdx}
          className="bg-gray-800/60 border border-gray-700 rounded-lg p-4"
        >
          <p className="text-sm text-white font-medium mb-3">
            {qIdx + 1}. {q.question}
          </p>
          <div className="space-y-2">
            {q.options.map((option, oIdx) => {
              const letter = option.charAt(0);
              const isSelected = answers[qIdx] === letter;
              return (
                <button
                  key={oIdx}
                  onClick={() => handleSelect(qIdx, option)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border ${
                    isSelected
                      ? "bg-indigo-600/30 border-indigo-500 text-white"
                      : "bg-gray-900/40 border-gray-700 text-gray-300 hover:border-gray-500"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button
        onClick={handleSubmit}
        disabled={!allAnswered}
        className="w-full py-3 bg-indigo-600 text-white font-medium rounded-lg
                   hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
      >
        Submit Answers
      </button>
    </div>
  );
}
