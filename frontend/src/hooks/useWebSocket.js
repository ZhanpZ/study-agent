import { useRef, useReducer, useCallback, useEffect, useMemo } from "react";
import { loadSessionState, persistSessionState } from "../utils/sessionStorage";

const PHASE_LABELS = {
  explain: "Learn",
  explain_done: "Ready to Teach",
  teach: "Teach",
  evaluate: "Evaluate",
  quiz: "Quiz",
  complete: "Complete",
};

function initState(sessionId) {
  const storedId = loadSessionState("ws_sessionId", null);
  const isMatch = storedId === sessionId;
  return {
    messages: [],
    phase: "explain",
    score: null,
    gaps: [],
    mcqQuestions: isMatch ? loadSessionState("ws_mcqQuestions", null) : null,
    codeChallenge: isMatch ? loadSessionState("ws_codeChallenge", null) : null,
    summary: isMatch ? loadSessionState("ws_summary", null) : null,
    comprehensionMcqs: isMatch ? loadSessionState("ws_comprehensionMcqs", []) : [],
    thinking: false,
    connectionStatus: "disconnected",
    phaseTransition: null,
  };
}

function wsReducer(state, action) {
  switch (action.type) {
    case "WS_MESSAGE": {
      const newState = { ...state, thinking: false };
      newState.messages = [
        ...state.messages,
        { agent: action.agent, content: action.content, phase: action.phase, isNew: true },
      ];
      if (action.phase && action.phase !== state.phase) {
        newState.phase = action.phase;
      }
      return newState;
    }
    case "PHASE_CHANGE": {
      const newState = { ...state, thinking: false, phase: action.phase };
      if (action.phase !== "explain" && action.phase !== "explain_done") {
        newState.comprehensionMcqs = [];
        persistSessionState("ws_comprehensionMcqs", []);
      }
      return newState;
    }
    case "SCORE_UPDATE":
      return { ...state, thinking: false, score: action.score, gaps: action.gaps || [] };
    case "MCQ": {
      persistSessionState("ws_mcqQuestions", action.questions);
      return { ...state, thinking: false, mcqQuestions: action.questions, phase: "quiz" };
    }
    case "CODE_CHALLENGE": {
      const challenge = { problem: action.problem, hints: action.hints || [] };
      if (action.url) challenge.url = action.url;
      if (action.title) challenge.title = action.title;
      if (action.difficulty) challenge.difficulty = action.difficulty;
      if (action.leetcode_id) challenge.leetcode_id = action.leetcode_id;
      persistSessionState("ws_codeChallenge", challenge);
      return { ...state, thinking: false, codeChallenge: challenge, phase: "evaluate" };
    }
    case "COMPREHENSION_MCQS": {
      const next = [...state.comprehensionMcqs, ...action.questions];
      persistSessionState("ws_comprehensionMcqs", next);
      return { ...state, comprehensionMcqs: next };
    }
    case "SUMMARY":
      persistSessionState("ws_summary", action.content);
      return { ...state, thinking: false, summary: action.content };
    case "STREAM_START":
      return {
        ...state,
        thinking: false,
        messages: [
          ...state.messages,
          { agent: action.agent, content: "", isNew: true, streaming: true },
        ],
      };
    case "STREAM_CHUNK": {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.streaming) {
        msgs[msgs.length - 1] = { ...last, content: last.content + action.content };
      }
      return { ...state, messages: msgs };
    }
    case "STREAM_END": {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.streaming) {
        msgs[msgs.length - 1] = { ...last, streaming: false };
      }
      return { ...state, messages: msgs };
    }
    case "ERROR":
      return {
        ...state,
        thinking: false,
        messages: [...state.messages, { agent: "system", content: action.content, isNew: true }],
      };
    case "SET_MESSAGES":
      return { ...state, messages: action.messages };
    case "SEND_MESSAGE":
      return {
        ...state,
        thinking: true,
        messages: [...state.messages, { agent: "user", content: action.content, isNew: true }],
      };
    case "SET_THINKING":
      return { ...state, thinking: action.value };
    case "CONNECTION_STATUS":
      return { ...state, connectionStatus: action.status };
    case "WS_CLOSE":
      return { ...state, thinking: false, connectionStatus: action.status };
    case "PHASE_TRANSITION":
      return { ...state, phaseTransition: action.label };
    case "CLEAR_MCQ":
      persistSessionState("ws_mcqQuestions", null);
      return { ...state, thinking: true, mcqQuestions: null };
    case "CLEAR_CODE_CHALLENGE":
      persistSessionState("ws_codeChallenge", null);
      return { ...state, thinking: true, codeChallenge: null };
    case "RESET_SESSION": {
      sessionStorage.removeItem("ws_mcqQuestions");
      sessionStorage.removeItem("ws_codeChallenge");
      sessionStorage.removeItem("ws_summary");
      sessionStorage.removeItem("ws_comprehensionMcqs");
      return {
        ...state,
        mcqQuestions: null,
        codeChallenge: null,
        summary: null,
        comprehensionMcqs: [],
        phase: "explain",
        score: null,
        gaps: [],
      };
    }
    default:
      return state;
  }
}

export default function useWebSocket(sessionId, initialMessages = []) {
  const wsRef = useRef(null);
  const [state, dispatch] = useReducer(wsReducer, sessionId, initState);

  const prevSessionIdRef = useRef(sessionId);
  const phaseRef = useRef(state.phase);

  useEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef(null);
  const heartbeatTimer = useRef(null);
  const maxReconnectAttempts = 5;

  // Reset ws state when sessionId changes (new session)
  useEffect(() => {
    if (sessionId && sessionId !== prevSessionIdRef.current) {
      dispatch({ type: "RESET_SESSION" });
    }
    if (sessionId) {
      persistSessionState("ws_sessionId", sessionId);
    }
    prevSessionIdRef.current = sessionId;
  }, [sessionId]);

  // Sync initialMessages when they arrive from session restore
  useEffect(() => {
    if (initialMessages.length > 0) {
      dispatch({ type: "SET_MESSAGES", messages: initialMessages });
    }
  }, [initialMessages]);

  function showPhaseTransition(newPhase) {
    const label = PHASE_LABELS[newPhase] || newPhase;
    dispatch({ type: "PHASE_TRANSITION", label });
    setTimeout(() => dispatch({ type: "PHASE_TRANSITION", label: null }), 3000);
  }

  const connect = useCallback(() => {
    if (!sessionId) return;

    const isReconnect = reconnectAttempts.current > 0;
    dispatch({ type: "CONNECTION_STATUS", status: isReconnect ? "reconnecting" : "connecting" });

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/session/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      dispatch({ type: "CONNECTION_STATUS", status: "connected" });
      reconnectAttempts.current = 0;
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "pong":
          break;
        case "message":
          dispatch({ type: "WS_MESSAGE", agent: data.agent, content: data.content, phase: data.phase });
          if (data.phase && data.phase !== phaseRef.current) showPhaseTransition(data.phase);
          break;
        case "phase_change":
          if (data.phase !== phaseRef.current) showPhaseTransition(data.phase);
          dispatch({ type: "PHASE_CHANGE", phase: data.phase });
          break;
        case "score_update":
          dispatch({ type: "SCORE_UPDATE", score: data.score, gaps: data.gaps });
          break;
        case "mcq":
          dispatch({ type: "MCQ", questions: data.questions });
          break;
        case "code_challenge":
          dispatch({
            type: "CODE_CHALLENGE",
            problem: data.problem, hints: data.hints,
            url: data.url, title: data.title,
            difficulty: data.difficulty, leetcode_id: data.leetcode_id,
          });
          break;
        case "stream_start":
          dispatch({ type: "STREAM_START", agent: data.agent });
          break;
        case "stream_chunk":
          dispatch({ type: "STREAM_CHUNK", content: data.content });
          break;
        case "stream_end":
          dispatch({ type: "STREAM_END" });
          break;
        case "comprehension_mcqs":
          dispatch({ type: "COMPREHENSION_MCQS", questions: data.questions });
          break;
        case "summary":
          dispatch({ type: "SUMMARY", content: data.content });
          break;
        case "error":
          dispatch({ type: "ERROR", content: data.content });
          break;
      }
    };

    ws.onclose = () => {
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
        heartbeatTimer.current = null;
      }
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 10000);
        dispatch({ type: "WS_CLOSE", status: "reconnecting" });
        reconnectTimer.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        dispatch({ type: "WS_CLOSE", status: "disconnected" });
      }
    };

    ws.onerror = () => {
      dispatch({ type: "SET_THINKING", value: false });
    };
  }, [sessionId]);

  const sendMessage = useCallback((content) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", content }));
      dispatch({ type: "SEND_MESSAGE", content });
    }
  }, []);

  const sendReadyToTeach = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "ready_to_teach" }));
      dispatch({ type: "SET_THINKING", value: true });
    }
  }, []);

  const sendMCQAnswers = useCallback((answers) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "mcq_answers", answers }));
      dispatch({ type: "CLEAR_MCQ" });
    }
  }, []);

  const sendCodeAnswer = useCallback((code, language = "python") => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "code_answer", code, language }));
      dispatch({ type: "CLEAR_CODE_CHALLENGE" });
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
    reconnectAttempts.current = maxReconnectAttempts;
    wsRef.current?.close();
  }, []);

  // Auto-connect when sessionId changes
  useEffect(() => {
    reconnectAttempts.current = 0;
    if (sessionId) connect();
    return () => disconnect();
  }, [sessionId, connect, disconnect]);

  // Derive connected from connectionStatus for backwards compatibility
  const connected = state.connectionStatus === "connected";

  return {
    messages: state.messages, phase: state.phase,
    score: state.score, gaps: state.gaps, connected,
    mcqQuestions: state.mcqQuestions, codeChallenge: state.codeChallenge,
    summary: state.summary, comprehensionMcqs: state.comprehensionMcqs,
    thinking: state.thinking, connectionStatus: state.connectionStatus,
    phaseTransition: state.phaseTransition,
    sendMessage, sendReadyToTeach, sendMCQAnswers, sendCodeAnswer,
    disconnect,
  };
}
