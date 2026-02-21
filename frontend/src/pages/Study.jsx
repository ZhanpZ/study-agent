import { useState, useEffect, useRef } from "react";
import { useSession } from "../context/SessionContext";
import useWebSocket from "../hooks/useWebSocket";
import Chat from "../components/Chat";

export default function Study() {
  const [topic, setTopic] = useState("");
  const {
    sessionId, setSessionId,
    setSessionTopic, sessionMode, setSessionMode,
    clearSession,
  } = useSession();
  const [mode, setMode] = useState("concept");
  const [loading, setLoading] = useState(false);
  const [initialMessages, setInitialMessages] = useState([]);
  const [restoring, setRestoring] = useState(false);
  const [restoredPhase, setRestoredPhase] = useState(null);
  const hasRestored = useRef(false);

  // On mount: if sessionId exists, fetch stored messages from backend
  useEffect(() => {
    if (sessionId && !hasRestored.current) {
      hasRestored.current = true;
      setRestoring(true);
      fetch(`/api/session/${sessionId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            clearSession();
          } else {
            setInitialMessages(
              data.messages.map((m) => ({ agent: m.agent, content: m.content }))
            );
            setRestoredPhase(data.phase);
            if (data.mode) setSessionMode(data.mode);
          }
        })
        .catch(() => clearSession())
        .finally(() => setRestoring(false));
    }
  }, []);

  const {
    messages, phase, score, gaps, connected,
    mcqQuestions, codeChallenge, summary,
    sendMessage, sendReadyToTeach, sendMCQAnswers, sendCodeAnswer,
  } = useWebSocket(sessionId, initialMessages);

  const activePhase = restoredPhase || phase;
  const activeMode = sessionMode || mode;

  const startSession = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), mode }),
      });
      const data = await res.json();
      setSessionTopic(topic.trim());
      setSessionMode(mode);
      setSessionId(data.id);
      setInitialMessages([]);
      hasRestored.current = true;
    } catch (err) {
      console.error("Failed to start session:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleNewSession = () => {
    clearSession();
    setInitialMessages([]);
    setRestoredPhase(null);
    hasRestored.current = false;
  };

  // Topic selection screen
  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-3xl font-bold text-white mb-2">What do you want to learn?</h2>
        <p className="text-gray-400 mb-6">
          Choose a mode and enter a topic to get started.
        </p>

        {/* Mode toggle */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setMode("concept")}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              mode === "concept"
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
            }`}
          >
            Concept Mode
          </button>
          <button
            onClick={() => setMode("code")}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              mode === "code"
                ? "bg-emerald-600 border-emerald-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
            }`}
          >
            Code Mode
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-6 max-w-md text-center">
          {mode === "concept"
            ? "Focus on understanding concepts through analogies and explanations. Tested with multiple choice questions."
            : "Focus on code templates and variations. Tested with coding challenges."}
        </p>

        <form onSubmit={startSession} className="w-full max-w-md flex gap-2">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={
              mode === "concept"
                ? "e.g. Binary Search Trees, TCP/IP, Dynamic Programming..."
                : "e.g. BFS, Merge Sort, Two Pointer Pattern..."
            }
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm
                       text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!topic.trim() || loading}
            className="px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg
                       hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {loading ? "Starting..." : "Start"}
          </button>
        </form>
      </div>
    );
  }

  // Loading restored session
  if (restoring) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Restoring session...</div>
      </div>
    );
  }

  // Active session
  return (
    <div className="h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          activeMode === "code"
            ? "bg-emerald-900/40 text-emerald-400 border border-emerald-700/50"
            : "bg-blue-900/40 text-blue-400 border border-blue-700/50"
        }`}>
          {activeMode === "code" ? "Code Mode" : "Concept Mode"}
        </span>
        <button
          onClick={handleNewSession}
          className="px-3 py-1 text-xs text-gray-400 border border-gray-700 rounded-lg
                     hover:text-white hover:border-gray-500 transition-colors"
        >
          New Session
        </button>
      </div>
      <Chat
        messages={messages}
        phase={activePhase}
        score={score}
        gaps={gaps}
        connected={connected}
        mode={activeMode}
        mcqQuestions={mcqQuestions}
        codeChallenge={codeChallenge}
        summary={summary}
        onSend={sendMessage}
        onReadyToTeach={sendReadyToTeach}
        onSubmitMCQ={sendMCQAnswers}
        onSubmitCode={sendCodeAnswer}
      />
    </div>
  );
}
