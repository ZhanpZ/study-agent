import { useRef, useState, useCallback, useEffect } from "react";
import { loadSessionState, persistSessionState } from "../utils/sessionStorage";

const PHASE_LABELS = {
  explain: "Learn",
  explain_done: "Ready to Teach",
  teach: "Teach",
  evaluate: "Evaluate",
  quiz: "Quiz",
  complete: "Complete",
};

export default function useWebSocket(sessionId, initialMessages = []) {
  const wsRef = useRef(null);
  const [messages, setMessages] = useState(initialMessages);
  const [phase, setPhase] = useState("explain");
  const [score, setScore] = useState(null);
  const [gaps, setGaps] = useState([]);
  const [connected, setConnected] = useState(false);
  const [mcqQuestions, setMcqQuestions] = useState(() => {
    const storedId = loadSessionState("ws_sessionId", null);
    return storedId === sessionId ? loadSessionState("ws_mcqQuestions", null) : null;
  });
  const [codeChallenge, setCodeChallenge] = useState(() => {
    const storedId = loadSessionState("ws_sessionId", null);
    return storedId === sessionId ? loadSessionState("ws_codeChallenge", null) : null;
  });
  const [summary, setSummary] = useState(() => {
    const storedId = loadSessionState("ws_sessionId", null);
    return storedId === sessionId ? loadSessionState("ws_summary", null) : null;
  });
  const [comprehensionMcqs, setComprehensionMcqs] = useState(() => {
    const storedId = loadSessionState("ws_sessionId", null);
    return storedId === sessionId ? loadSessionState("ws_comprehensionMcqs", []) : [];
  });
  const [thinking, setThinking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected"); // disconnected | connecting | connected | reconnecting
  const [phaseTransition, setPhaseTransition] = useState(null);
  const prevSessionIdRef = useRef(sessionId);
  const phaseRef = useRef(phase);

  // Keep phaseRef in sync with phase state
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef(null);
  const maxReconnectAttempts = 5;

  // Reset ws state when sessionId changes (new session)
  useEffect(() => {
    if (sessionId && sessionId !== prevSessionIdRef.current) {
      setMcqQuestions(null);
      setCodeChallenge(null);
      setSummary(null);
      setComprehensionMcqs([]);
      setPhase("explain");
      setScore(null);
      setGaps([]);
      sessionStorage.removeItem("ws_mcqQuestions");
      sessionStorage.removeItem("ws_codeChallenge");
      sessionStorage.removeItem("ws_summary");
      sessionStorage.removeItem("ws_comprehensionMcqs");
    }
    if (sessionId) {
      persistSessionState("ws_sessionId", sessionId);
    }
    prevSessionIdRef.current = sessionId;
  }, [sessionId]);

  // Sync initialMessages when they arrive from session restore
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const connect = useCallback(() => {
    if (!sessionId) return;

    const isReconnect = reconnectAttempts.current > 0;
    setConnectionStatus(isReconnect ? "reconnecting" : "connecting");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/session/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnectionStatus("connected");
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "message":
          setThinking(false);
          setMessages((prev) => [
            ...prev,
            { agent: data.agent, content: data.content, phase: data.phase },
          ]);
          if (data.phase) {
            setPhase((prev) => {
              if (data.phase !== prev) showPhaseTransition(data.phase);
              return data.phase;
            });
          }
          break;

        case "phase_change": {
          setPhase((prev) => {
            if (data.phase !== prev) showPhaseTransition(data.phase);
            return data.phase;
          });
          setThinking(false);
          // Clear comprehension MCQs when leaving explain phases
          if (data.phase !== "explain" && data.phase !== "explain_done") {
            setComprehensionMcqs([]);
            persistSessionState("ws_comprehensionMcqs", []);
          }
          break;
        }

        case "score_update":
          setThinking(false);
          setScore(data.score);
          setGaps(data.gaps || []);
          break;

        case "mcq":
          setThinking(false);
          setMcqQuestions(data.questions);
          persistSessionState("ws_mcqQuestions", data.questions);
          setPhase("quiz");
          break;

        case "code_challenge": {
          setThinking(false);
          const challenge = {
            problem: data.problem,
            hints: data.hints || [],
          };
          // Pass through LeetCode metadata if present
          if (data.url) challenge.url = data.url;
          if (data.title) challenge.title = data.title;
          if (data.difficulty) challenge.difficulty = data.difficulty;
          if (data.leetcode_id) challenge.leetcode_id = data.leetcode_id;
          setCodeChallenge(challenge);
          persistSessionState("ws_codeChallenge", challenge);
          setPhase("evaluate");
          break;
        }

        case "comprehension_mcqs":
          setComprehensionMcqs((prev) => {
            const next = [...prev, ...data.questions];
            persistSessionState("ws_comprehensionMcqs", next);
            return next;
          });
          break;

        case "summary":
          setThinking(false);
          setSummary(data.content);
          persistSessionState("ws_summary", data.content);
          break;

        case "error":
          setThinking(false);
          setMessages((prev) => [
            ...prev,
            { agent: "system", content: data.content },
          ]);
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setThinking(false);
      // Attempt reconnection
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 10000);
        setConnectionStatus("reconnecting");
        reconnectTimer.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        setConnectionStatus("disconnected");
      }
    };

    ws.onerror = () => {
      setConnected(false);
      setThinking(false);
    };
  }, [sessionId]);

  function showPhaseTransition(newPhase) {
    const label = PHASE_LABELS[newPhase] || newPhase;
    setPhaseTransition(label);
    setTimeout(() => setPhaseTransition(null), 3000);
  }

  const sendMessage = useCallback((content) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", content }));
      setMessages((prev) => [...prev, { agent: "user", content }]);
      setThinking(true);
    }
  }, []);

  const sendReadyToTeach = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "ready_to_teach" }));
      setThinking(true);
    }
  }, []);

  const sendMCQAnswers = useCallback((answers) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "mcq_answers", answers }));
      setMcqQuestions(null);
      persistSessionState("ws_mcqQuestions", null);
      setThinking(true);
    }
  }, []);

  const sendCodeAnswer = useCallback((code) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "code_answer", code }));
      setCodeChallenge(null);
      persistSessionState("ws_codeChallenge", null);
      setThinking(true);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    reconnectAttempts.current = maxReconnectAttempts; // prevent reconnect on intentional close
    wsRef.current?.close();
  }, []);

  // Auto-connect when sessionId changes
  useEffect(() => {
    reconnectAttempts.current = 0;
    if (sessionId) connect();
    return () => disconnect();
  }, [sessionId, connect, disconnect]);

  return {
    messages, phase, score, gaps, connected,
    mcqQuestions, codeChallenge, summary, comprehensionMcqs,
    thinking, connectionStatus, phaseTransition,
    sendMessage, sendReadyToTeach, sendMCQAnswers, sendCodeAnswer,
    disconnect,
  };
}
