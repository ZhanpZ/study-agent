import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import PhaseIndicator from "./PhaseIndicator";

export default function Chat({ messages, phase, score, gaps, connected, onSend }) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const isTeachPhase = phase === "teach";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || !isTeachPhase) return;
    onSend(input.trim());
    setInput("");
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
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isTeachPhase
              ? "Explain the concept in your own words..."
              : phase === "complete"
              ? "Session complete!"
              : "Waiting for agent..."
          }
          disabled={!isTeachPhase}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm
                     text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500
                     disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!isTeachPhase || !input.trim()}
          className="px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg
                     hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
