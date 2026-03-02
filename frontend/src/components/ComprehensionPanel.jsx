import { useState } from "react";

export default function ComprehensionPanel({ questions }) {
  const [answeredMap, setAnsweredMap] = useState({});

  const handleSelect = (qIdx, letter) => {
    if (answeredMap[qIdx] !== undefined) return;
    setAnsweredMap((prev) => ({ ...prev, [qIdx]: letter }));
  };

  if (!questions || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center mt-8 text-gray-400">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 opacity-30">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span className="text-sm text-center">Self-check questions will appear here as the professor explains.</span>
      </div>
    );
  }

  const totalAnswered = Object.keys(answeredMap).length;
  const totalCorrect = Object.entries(answeredMap).filter(([qIdx, letter]) => {
    const q = questions[parseInt(qIdx)];
    return q && letter === q.correct;
  }).length;

  return (
    <div className="space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-focus-text-muted uppercase tracking-wider">
          Self-Check
        </h3>
        {totalAnswered > 0 && (
          <span className="text-xs text-focus-text-dim">
            {totalCorrect}/{totalAnswered} correct
          </span>
        )}
      </div>
      {questions.map((q, qIdx) => {
        const answered = answeredMap[qIdx] !== undefined;
        const selectedLetter = answeredMap[qIdx];
        const isCorrect = selectedLetter === q.correct;

        return (
          <div key={qIdx} className="bg-focus-surface border border-focus-border rounded-xl p-3.5">
            <p className="text-sm text-white font-medium mb-2.5">
              <span className="text-focus-text-muted mr-1">{qIdx + 1}.</span>
              {q.question}
            </p>
            <div className="space-y-1.5">
              {q.options.map((option, oIdx) => {
                const letter = option.charAt(0);
                const isSelected = selectedLetter === letter;
                const isCorrectOption = q.correct === letter;

                let optionClass =
                  "bg-gray-900/30 border-focus-border text-gray-300 hover:border-focus-border-light cursor-pointer";
                if (answered) {
                  if (isCorrectOption) {
                    optionClass = "bg-green-900/25 border-green-600/40 text-green-300";
                  } else if (isSelected && !isCorrect) {
                    optionClass = "bg-red-900/25 border-red-600/40 text-red-300";
                  } else {
                    optionClass = "bg-gray-900/20 border-focus-border text-gray-400";
                  }
                } else if (isSelected) {
                  optionClass = "bg-indigo-600/25 border-indigo-500/50 text-white";
                }

                return (
                  <button
                    key={oIdx}
                    onClick={() => handleSelect(qIdx, letter)}
                    disabled={answered}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all border disabled:cursor-default ${optionClass}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {answered && q.explanation && (
              <div
                className={`mt-2.5 text-xs p-2.5 rounded-lg border ${
                  isCorrect
                    ? "text-green-300 bg-green-900/15 border-green-800/25"
                    : "text-red-300 bg-red-900/15 border-red-800/25"
                }`}
              >
                <span className="font-semibold">{isCorrect ? "Correct! " : "Incorrect. "}</span>
                {q.explanation}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
