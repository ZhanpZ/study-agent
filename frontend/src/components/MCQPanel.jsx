import { useState } from "react";

export default function MCQPanel({ questions, onSubmit, submittedAnswers }) {
  const [answers, setAnswers] = useState(Array(questions.length).fill(""));
  const [justSelected, setJustSelected] = useState(null);

  const isResults = !!submittedAnswers;

  const handleSelect = (questionIdx, option) => {
    if (isResults) return;
    const letter = option.charAt(0);
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIdx] = letter;
      return next;
    });
    setJustSelected({ qIdx: questionIdx, oIdx: option });
    setTimeout(() => setJustSelected(null), 200);
  };

  const allAnswered = answers.every((a) => a !== "");
  const answeredCount = answers.filter((a) => a !== "").length;

  const handleSubmit = () => {
    if (allAnswered) onSubmit(answers);
  };

  // Count correct answers for results header
  const correctCount = isResults
    ? questions.filter((q, i) => {
        const ua = (submittedAnswers[i] || "").toUpperCase().trim();
        return ua === (q.correct || "").toUpperCase().trim();
      }).length
    : null;

  return (
    <div className="bg-focus-surface border border-focus-border rounded-xl overflow-hidden animate-message-enter">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-focus-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center border bg-focus-teal/10 border-focus-teal/25">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-focus-teal">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white">
            {isResults ? "Quiz Results" : "Knowledge Check"}
          </h3>
        </div>
        {isResults ? (
          <span className={`text-sm font-bold tabular-nums ${
            correctCount === questions.length ? "text-focus-teal"
            : correctCount >= questions.length / 2 ? "text-focus-amber"
            : "text-red-400"
          }`}>
            {correctCount}/{questions.length} correct
          </span>
        ) : (
          <span className="text-xs text-focus-text-muted">
            {answeredCount}/{questions.length} answered
          </span>
        )}
      </div>

      {/* Questions */}
      <div className="p-5 space-y-6">
        {questions.map((q, qIdx) => {
          const userLetter = isResults
            ? (submittedAnswers[qIdx] || "").toUpperCase().trim()
            : answers[qIdx];
          const correctLetter = (q.correct || "").toUpperCase().trim();

          return (
            <div key={qIdx}>
              <p className="text-sm text-white font-medium mb-3">
                <span className="text-focus-text-muted mr-1.5">{qIdx + 1}.</span>
                {q.question}
              </p>
              <div className="space-y-2">
                {q.options.map((option, oIdx) => {
                  const letter = option.charAt(0).toUpperCase();
                  const isSelected = !isResults && answers[qIdx] === letter;
                  const isJustSelected = justSelected?.qIdx === qIdx && justSelected?.oIdx === option;

                  // Results mode styling
                  let resultStyle = "";
                  let labelEl = null;
                  if (isResults) {
                    const isCorrect = letter === correctLetter;
                    const isUserChoice = letter === userLetter;
                    if (isCorrect) {
                      resultStyle = "bg-focus-teal/15 border-focus-teal/50 text-white ring-1 ring-focus-teal/20";
                    } else if (isUserChoice && !isCorrect) {
                      resultStyle = "bg-red-900/30 border-red-600/60 text-white ring-1 ring-red-500/20";
                    } else {
                      resultStyle = "bg-gray-900/20 border-focus-border text-gray-500";
                    }
                    if (isCorrect && isUserChoice) {
                      labelEl = <span className="ml-2 text-xs text-focus-teal font-medium">✓ Correct</span>;
                    } else if (isCorrect) {
                      labelEl = <span className="ml-2 text-xs text-focus-teal font-medium">Correct answer</span>;
                    } else if (isUserChoice) {
                      labelEl = <span className="ml-2 text-xs text-red-400 font-medium">Your answer</span>;
                    }
                  }

                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleSelect(qIdx, option)}
                      disabled={isResults}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all border ${
                        isResults
                          ? resultStyle
                          : isSelected
                          ? "bg-focus-teal/15 border-focus-teal/50 text-white ring-1 ring-focus-teal/20"
                          : "bg-gray-900/30 border-focus-border text-gray-300 hover:border-focus-border-light hover:bg-gray-800/40"
                      } ${isJustSelected ? "animate-option-select" : ""} disabled:cursor-default`}
                    >
                      <span className={`inline-block w-5 font-mono text-xs mr-1.5 ${
                        isResults
                          ? letter === correctLetter ? "text-focus-teal"
                            : letter === userLetter ? "text-red-400"
                            : "text-gray-600"
                          : isSelected ? "text-focus-teal" : "text-gray-400"
                      }`}>
                        {letter})
                      </span>
                      {option.substring(3)}
                      {labelEl}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submit footer — only in interactive mode */}
      {!isResults && (
        <div className="px-5 py-3.5 border-t border-focus-border">
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="w-full py-3 bg-focus-teal text-white font-medium rounded-lg
                       hover:bg-focus-teal-light disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all shadow-lg shadow-focus-teal/10 flex items-center justify-center gap-2
                       btn-interactive btn-ripple"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Submit Answers
          </button>
        </div>
      )}
    </div>
  );
}
