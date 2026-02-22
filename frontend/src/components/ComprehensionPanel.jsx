import { useState } from "react";

export default function ComprehensionPanel({ questions }) {
  const [answeredMap, setAnsweredMap] = useState({});

  const handleSelect = (qIdx, letter) => {
    if (answeredMap[qIdx] !== undefined) return;
    setAnsweredMap((prev) => ({ ...prev, [qIdx]: letter }));
  };

  if (!questions || questions.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center mt-8">
        Comprehension questions will appear here as the professor explains.
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
        Comprehension Check
      </h3>
      {questions.map((q, qIdx) => {
        const answered = answeredMap[qIdx] !== undefined;
        const selectedLetter = answeredMap[qIdx];
        const isCorrect = selectedLetter === q.correct;

        return (
          <div key={qIdx} className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
            <p className="text-sm text-white font-medium mb-2">
              {qIdx + 1}. {q.question}
            </p>
            <div className="space-y-1.5">
              {q.options.map((option, oIdx) => {
                const letter = option.charAt(0);
                const isSelected = selectedLetter === letter;
                const isCorrectOption = q.correct === letter;

                let optionClass =
                  "bg-gray-900/40 border-gray-700 text-gray-300 hover:border-gray-500 cursor-pointer";
                if (answered) {
                  if (isCorrectOption) {
                    optionClass = "bg-green-900/30 border-green-600 text-green-300";
                  } else if (isSelected && !isCorrect) {
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
                    onClick={() => handleSelect(qIdx, letter)}
                    disabled={answered}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors border disabled:cursor-default ${optionClass}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {answered && q.explanation && (
              <div
                className={`mt-2 text-xs p-2 rounded ${
                  isCorrect
                    ? "text-green-400 bg-green-900/20"
                    : "text-red-400 bg-red-900/20"
                }`}
              >
                {isCorrect ? "Correct! " : "Incorrect. "}
                {q.explanation}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
