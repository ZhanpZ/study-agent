import { useState } from "react";

export default function MCQPanel({ questions, onSubmit }) {
  const [answers, setAnswers] = useState(Array(questions.length).fill(""));

  const handleSelect = (questionIdx, option) => {
    const letter = option.charAt(0);
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIdx] = letter;
      return next;
    });
  };

  const allAnswered = answers.every((a) => a !== "");
  const answeredCount = answers.filter((a) => a !== "").length;

  const handleSubmit = () => {
    if (allAnswered) {
      onSubmit(answers);
    }
  };

  return (
    <div className="bg-focus-surface border border-focus-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-focus-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center border border-indigo-500/25">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white">Knowledge Check</h3>
        </div>
        <span className="text-xs text-focus-text-muted">
          {answeredCount}/{questions.length} answered
        </span>
      </div>

      {/* Questions */}
      <div className="p-5 space-y-5">
        {questions.map((q, qIdx) => (
          <div key={qIdx}>
            <p className="text-sm text-white font-medium mb-3">
              <span className="text-focus-text-muted mr-1.5">{qIdx + 1}.</span>
              {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((option, oIdx) => {
                const letter = option.charAt(0);
                const isSelected = answers[qIdx] === letter;
                return (
                  <button
                    key={oIdx}
                    onClick={() => handleSelect(qIdx, option)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all border ${
                      isSelected
                        ? "bg-indigo-600/25 border-indigo-500/60 text-white ring-1 ring-indigo-500/20"
                        : "bg-gray-900/30 border-focus-border text-gray-300 hover:border-focus-border-light hover:bg-gray-800/40"
                    }`}
                  >
                    <span className={`inline-block w-5 font-mono text-xs mr-1.5 ${isSelected ? "text-indigo-400" : "text-gray-500"}`}>{letter})</span>
                    {option.substring(3)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Submit footer */}
      <div className="px-5 py-3.5 border-t border-focus-border">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className="w-full py-3 bg-indigo-600 text-white font-medium rounded-lg
                     hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Submit Answers
        </button>
      </div>
    </div>
  );
}
