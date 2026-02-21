import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import PhaseIndicator from "./PhaseIndicator";
import MCQPanel from "./MCQPanel";

export default function Chat({
  messages, phase, score, gaps, connected, mode,
  mcqQuestions, codeChallenge, summary,
  onSend, onReadyToTeach, onSubmitMCQ, onSubmitCode,
}) {
  const [input, setInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const messagesEndRef = useRef(null);
  const isTeachPhase = phase === "teach";
  const isExplainDone = phase === "explain_done";
  const canType = isTeachPhase || isExplainDone;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, mcqQuestions, codeChallenge]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || !canType) return;
    onSend(input.trim());
    setInput("");
  };

  const handleCodeSubmit = () => {
    if (codeInput.trim()) {
      onSubmitCode(codeInput.trim());
      setCodeInput("");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Phase indicator */}
      <PhaseIndicator currentPhase={phase} />

      {/* Score bar (shown after first evaluation) */}
      {score !== null && (
        <div className="mb-4 p-3 bg-gray-800/60 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Understanding Score</span>
            <span className="text-sm font-bold text-white">{Math.round(score)}/100</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
          {gaps.length > 0 && (
            <div className="mt-2 text-xs text-gray-400">
              Gaps: {gaps.join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-1">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            Starting session...
          </div>
        )}
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} agent={msg.agent} content={msg.content} />
        ))}

        {/* MCQ panel for concept mode evaluation */}
        {phase === "quiz" && mcqQuestions && (
          <div className="my-4">
            <MCQPanel questions={mcqQuestions} onSubmit={onSubmitMCQ} />
          </div>
        )}

        {/* Code challenge for code mode evaluation */}
        {phase === "evaluate" && codeChallenge && (
          <div className="my-4 bg-gray-800/60 border border-gray-700 rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold text-white">Coding Challenge</h3>
            <p className="text-sm text-gray-200 whitespace-pre-wrap">
              {codeChallenge.problem}
            </p>
            {codeChallenge.hints.length > 0 && (
              <div className="text-xs text-gray-400">
                Hints: {codeChallenge.hints.join(" | ")}
              </div>
            )}
            <textarea
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              rows={10}
              placeholder="Write your code here..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm
                         text-white font-mono placeholder-gray-500 focus:outline-none
                         focus:border-indigo-500 resize-y"
            />
            <button
              onClick={handleCodeSubmit}
              disabled={!codeInput.trim()}
              className="w-full py-3 bg-emerald-600 text-white font-medium rounded-lg
                         hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              Submit Code
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area — shown during explain_done (follow-up questions) and teach phase */}
      {phase !== "quiz" && !(phase === "evaluate" && codeChallenge) && (
        <>
          {isExplainDone && (
            <button
              onClick={onReadyToTeach}
              className="w-full py-3 mb-2 bg-green-600 text-white font-medium rounded-lg
                         hover:bg-green-500 transition-colors"
            >
              I'm Ready to Teach
            </button>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            {mode === "code" && isTeachPhase ? (
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                rows={3}
                placeholder="Explain the code in your own words..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm
                           text-white font-mono placeholder-gray-500 focus:outline-none
                           focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed resize-y"
              />
            ) : (
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isExplainDone
                    ? "Ask the professor a follow-up question..."
                    : isTeachPhase
                    ? "Explain the concept in your own words..."
                    : phase === "complete"
                    ? "Session complete!"
                    : "Waiting for agent..."
                }
                disabled={!canType}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm
                           text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500
                           disabled:opacity-50 disabled:cursor-not-allowed"
              />
            )}
            <button
              type="submit"
              disabled={!canType || !input.trim()}
              className="px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg
                         hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
