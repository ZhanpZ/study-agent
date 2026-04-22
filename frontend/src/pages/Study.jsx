import { useState, useEffect, useRef } from "react";
import { useSession } from "../context/SessionContext";
import { useToast } from "../components/Toast";
import useWebSocket from "../hooks/useWebSocket";
import Chat from "../components/Chat";
import SpinnerIcon from "../components/SpinnerIcon";
import { validateTopic, MIN_TOPIC_LENGTH, MAX_TOPIC_LENGTH } from "../utils/validation";
import fetchWithTimeout from "../utils/fetchWithTimeout";

export default function Study() {
  const [topic, setTopic] = useState("");
  const [topicError, setTopicError] = useState("");
  const {
    sessionId, setSessionId,
    setSessionTopic, sessionMode, setSessionMode,
    clearSession,
  } = useSession();
  const { addToast } = useToast();
  const [difficulty, setDifficulty] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [initialMessages, setInitialMessages] = useState([]);
  const [restoring, setRestoring] = useState(false);
  const [restoredPhase, setRestoredPhase] = useState(null);
  const hasRestored = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessionId]);

  useEffect(() => {
    if (sessionId && !hasRestored.current) {
      hasRestored.current = true;
      setRestoring(true);
      fetchWithTimeout(`/api/session/${sessionId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            addToast("Previous session not found. Starting fresh.", "warning");
            clearSession();
            hasRestored.current = false;
          } else {
            setInitialMessages(
              data.messages.map((m) => ({ agent: m.agent, content: m.content }))
            );
            setRestoredPhase(data.phase);
            if (data.mode) setSessionMode(data.mode);
          }
        })
        .catch(() => {
          addToast("Failed to restore session. Please try again.", "error");
          clearSession();
          hasRestored.current = false;
        })
        .finally(() => setRestoring(false));
    }
  }, [sessionId]);

  const {
    messages, phase, score, gaps, connected,
    mcqQuestions, codeChallenge, summary, comprehensionMcqs,
    thinking, connectionStatus, phaseTransition,
    sendMessage, sendReadyToTeach, sendMCQAnswers, sendCodeAnswer,
  } = useWebSocket(sessionId, initialMessages);

  // Clear restoredPhase once the WebSocket sends a real phase update
  // (restoredPhase is only needed to bridge the gap before WS connects)
  useEffect(() => {
    if (restoredPhase !== null && phase !== "explain") {
      setRestoredPhase(null);
    }
  }, [phase, restoredPhase]);

  const activePhase = restoredPhase || phase;
  const activeMode = sessionMode || "leetcode";

  const handleTopicChange = (e) => {
    const val = e.target.value;
    setTopic(val);
    if (topicError && val.trim()) {
      setTopicError(validateTopic(val.trim()));
    }
  };

  const startSession = async (e) => {
    e.preventDefault();
    const trimmed = topic.trim();
    const error = validateTopic(trimmed);
    if (error) {
      setTopicError(error);
      return;
    }

    setLoading(true);
    setTopicError("");
    try {
      const res = await fetchWithTimeout("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed, difficulty }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setSessionTopic(trimmed);
      setSessionMode("leetcode");
      setSessionId(data.id);
      setInitialMessages([]);
      hasRestored.current = true;
    } catch (err) {
      addToast("Failed to start session. Check your connection and try again.", "error");
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
    // Clear persisted WebSocket state from previous session
    sessionStorage.removeItem("ws_mcqQuestions");
    sessionStorage.removeItem("ws_codeChallenge");
    sessionStorage.removeItem("ws_summary");
    sessionStorage.removeItem("ws_comprehensionMcqs");
    sessionStorage.removeItem("ws_sessionId");
  };

  const DIFFICULTY_CONFIG = {
    easy:   { label: "Easy",   color: "bg-emerald-600 border-emerald-500", inactive: "border-focus-border hover:border-emerald-500/50", badge: "text-emerald-400" },
    medium: { label: "Medium", color: "bg-amber-600 border-amber-500",     inactive: "border-focus-border hover:border-amber-500/50",   badge: "text-amber-400" },
    hard:   { label: "Hard",   color: "bg-red-600 border-red-500",         inactive: "border-focus-border hover:border-red-500/50",     badge: "text-red-400" },
  };

  // Topic selection screen
  if (!sessionId) {
    const diffCfg = DIFFICULTY_CONFIG[difficulty];
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] px-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 text-center">
          What do you want to practice?
        </h2>
        <p className="text-focus-text-muted mb-8 text-center text-sm">
          Enter an algorithm topic. The professor will explain it, then you teach it back.
        </p>

        {/* Difficulty selector */}
        <div className="flex gap-3 mb-8">
          {Object.entries(DIFFICULTY_CONFIG).map(([key, c]) => (
            <button
              key={key}
              onClick={() => setDifficulty(key)}
              className={`px-5 py-2 rounded-lg border text-sm font-semibold transition-all ${
                difficulty === key
                  ? `${c.color} text-white shadow-lg`
                  : `bg-focus-surface ${c.inactive} text-focus-text-muted`
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Topic input */}
        <form onSubmit={startSession} className="w-full max-w-lg">
          <div className="relative">
            <input
              type="text"
              value={topic}
              onChange={handleTopicChange}
              onBlur={() => topic.trim() && setTopicError(validateTopic(topic.trim()))}
              onFocus={(e) => {
                const el = e.target;
                const len = el.value.length;
                requestAnimationFrame(() => {
                  el.selectionStart = el.selectionEnd = len;
                  el.scrollLeft = el.scrollWidth;
                });
              }}
              placeholder="e.g. Two Sum, BFS, Sliding Window, Merge Sort..."
              maxLength={MAX_TOPIC_LENGTH}
              className={`w-full bg-focus-surface border rounded-xl px-4 py-3.5 pr-24 text-sm
                         text-white placeholder-gray-500 focus:outline-none transition-all
                         focus:ring-1 ${
                           topicError
                             ? "border-red-500 focus:border-red-400 focus:ring-red-500/20"
                             : "border-focus-border focus:border-focus-teal focus:ring-focus-teal/20"
                         }`}
            />
            <button
              type="submit"
              disabled={!topic.trim() || loading}
              className={`absolute right-1.5 top-1.5 bottom-1.5 px-5 text-white text-sm font-medium rounded-lg
                         disabled:opacity-40 transition-all flex items-center gap-2 ${diffCfg.color}`}
            >
              {loading ? (<><SpinnerIcon className="h-4 w-4" /> Starting...</>) : "Start"}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1">
            {topicError ? (
              <p className="text-xs text-red-400">{topicError}</p>
            ) : (
              <span />
            )}
            {topic.length > 0 && (
              <span className={`text-[10px] ${
                topic.length > MAX_TOPIC_LENGTH * 0.8 ? "text-amber-400" : "text-gray-600"
              }`}>
                {topic.length}/{MAX_TOPIC_LENGTH}
              </span>
            )}
          </div>
        </form>
      </div>
    );
  }

  // Loading restored session
  if (restoring) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-gray-400">
          <SpinnerIcon className="h-5 w-5" />
          Restoring session...
        </div>
      </div>
    );
  }

  // Active session
  return (
    <div className="h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-amber-900/40 text-amber-400 border border-amber-700/50">
          LeetCode Mode
        </span>
        <button
          onClick={handleNewSession}
          className="px-3 py-1.5 text-xs text-focus-text-muted border border-focus-border rounded-lg
                     hover:text-white hover:border-focus-border-light transition-colors"
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
        comprehensionMcqs={comprehensionMcqs}
        thinking={thinking}
        connectionStatus={connectionStatus}
        phaseTransition={phaseTransition}
        onSend={sendMessage}
        onReadyToTeach={sendReadyToTeach}
        onSubmitMCQ={sendMCQAnswers}
        onSubmitCode={sendCodeAnswer}
      />
    </div>
  );
}
