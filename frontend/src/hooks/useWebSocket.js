import { useRef, useState, useCallback, useEffect } from "react";

export default function useWebSocket(sessionId, initialMessages = []) {
  const wsRef = useRef(null);
  const [messages, setMessages] = useState(initialMessages);
  const [phase, setPhase] = useState("explain");
  const [score, setScore] = useState(null);
  const [gaps, setGaps] = useState([]);
  const [connected, setConnected] = useState(false);
  const [mcqQuestions, setMcqQuestions] = useState(null);
  const [codeChallenge, setCodeChallenge] = useState(null);
  const [summary, setSummary] = useState(null);

  // Sync initialMessages when they arrive from session restore
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const connect = useCallback(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/session/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "message":
          setMessages((prev) => [
            ...prev,
            { agent: data.agent, content: data.content, phase: data.phase },
          ]);
          if (data.phase) setPhase(data.phase);
          break;

        case "phase_change":
          setPhase(data.phase);
          break;

        case "score_update":
          setScore(data.score);
          setGaps(data.gaps || []);
          break;

        case "mcq":
          setMcqQuestions(data.questions);
          setPhase("quiz");
          break;

        case "code_challenge":
          setCodeChallenge({
            problem: data.problem,
            hints: data.hints || [],
          });
          setPhase("evaluate");
          break;

        case "summary":
          setSummary(data.content);
          break;

        case "error":
          setMessages((prev) => [
            ...prev,
            { agent: "system", content: data.content },
          ]);
          break;
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
  }, [sessionId]);

  const sendMessage = useCallback((content) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", content }));
      setMessages((prev) => [...prev, { agent: "user", content }]);
    }
  }, []);

  const sendReadyToTeach = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "ready_to_teach" }));
    }
  }, []);

  const sendMCQAnswers = useCallback((answers) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "mcq_answers", answers }));
      setMcqQuestions(null);
    }
  }, []);

  const sendCodeAnswer = useCallback((code) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "code_answer", code }));
      setCodeChallenge(null);
    }
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);

  // Auto-connect when sessionId changes
  useEffect(() => {
    if (sessionId) connect();
    return () => disconnect();
  }, [sessionId, connect, disconnect]);

  return {
    messages, phase, score, gaps, connected,
    mcqQuestions, codeChallenge, summary,
    sendMessage, sendReadyToTeach, sendMCQAnswers, sendCodeAnswer,
    disconnect,
  };
}
