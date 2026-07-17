import { useState, useRef, useEffect, useCallback } from "react";
import MessageBubble from "./MessageBubble";
import PhaseIndicator from "./PhaseIndicator";
import MCQPanel from "./MCQPanel";
import ComprehensionPanel from "./ComprehensionPanel";
import CodeChallengePanel from "./CodeChallengePanel";
import CodeEditor from "./CodeEditor";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import CodeBlock from "./CodeBlock";

export default function Chat({
  messages, phase, score, gaps, connected, mode,
  mcqQuestions, mcqSubmittedAnswers, codeChallenge, summary, comprehensionMcqs,
  thinking, connectionStatus, phaseTransition,
  onSend, onReadyToTeach, onSubmitMCQ, onSubmitCode,
}) {
  const [input, setInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [showHints, setShowHints] = useState(false);
  const [submittingCode, setSubmittingCode] = useState(false);
  // Live session timer
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Score animation state
  const [displayedScore, setDisplayedScore] = useState(score || 0);
  const [scoreGlow, setScoreGlow] = useState(false);
  const prevScoreRef = useRef(score);

  useEffect(() => {
    if (score === null || score === prevScoreRef.current) return;
    // Trigger glow
    setScoreGlow(true);
    const glowTimer = setTimeout(() => setScoreGlow(false), 1000);
    // Count up animation
    const start = displayedScore;
    const end = Math.round(score);
    const diff = end - start;
    if (diff !== 0) {
      const steps = Math.abs(diff);
      const stepTime = Math.max(Math.floor(500 / steps), 16);
      const increment = diff > 0 ? 1 : -1;
      let current = start;
      const interval = setInterval(() => {
        current += increment;
        setDisplayedScore(current);
        if (current === end) clearInterval(interval);
      }, stepTime);
      prevScoreRef.current = score;
      return () => { clearInterval(interval); clearTimeout(glowTimer); };
    }
    prevScoreRef.current = score;
    return () => clearTimeout(glowTimer);
  }, [score]);

  const handleInputFocus = useCallback((e) => {
    const el = e.target;
    const len = el.value.length;
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = len;
      el.scrollLeft = el.scrollWidth;
    });
  }, []);
  const isLeetcode = mode === "leetcode";
  const isTeachPhase = phase === "teach";
  const isExplainDone = phase === "explain_done";
  const canType = isTeachPhase || isExplainDone;
  const isCodeMode = mode !== "concept";
  const isComplete = phase === "complete";

  const showComprehensionPanel =
    comprehensionMcqs &&
    comprehensionMcqs.length > 0 &&
    (phase === "explain" || phase === "explain_done");

  useEffect(() => {
    const t = setTimeout(() => {
      const el = messagesEndRef.current;
      if (!el) return;
      const container = el.parentElement;
      container?.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }, 50);
    return () => clearTimeout(t);
  }, [messages.length, mcqQuestions, codeChallenge, thinking]);

  useEffect(() => {
    if (!thinking) setSubmittingCode(false);
  }, [thinking]);

  // Start timer when connected, stop when complete
  useEffect(() => {
    if (phase === "complete" || !connected) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, connected]);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!input.trim() || !canType) return;
    onSend(input.trim());
    setInput("");
  }, [input, canType, onSend]);

  const handleCodeSubmit = useCallback((language = "python") => {
    if (codeInput.trim()) {
      setSubmittingCode(true);
      onSubmitCode(codeInput.trim(), language);
    }
  }, [codeInput, onSubmitCode]);

  return (
    <div className="flex flex-col h-full">
      {/* Connection status banner */}
      {connectionStatus === "reconnecting" && (
        <div className="mb-3 px-4 py-2.5 bg-focus-surface border border-focus-border rounded-xl text-xs text-focus-text-muted flex items-center gap-2.5">
          <svg className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
          Reconnecting to session...
        </div>
      )}
      {connectionStatus === "disconnected" && !connected && messages.length > 0 && (
        <div className="mb-3 px-4 py-2.5 bg-red-950/80 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          Connection lost. Please start a new session.
        </div>
      )}

      {/* Phase transition notification */}
      {phaseTransition && (
        <div className="mb-3 px-4 py-3 bg-focus-surface border border-focus-border rounded-xl text-sm text-focus-text-muted text-center font-semibold animate-slide-in animate-phase-shimmer">
          Entering: {phaseTransition} phase
        </div>
      )}

      {/* Phase indicator + timer */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <PhaseIndicator currentPhase={phase} mode={mode} />
        </div>
        {phase !== "complete" && connected && elapsed > 0 && (
          <span className="text-xs font-mono text-focus-text-muted tabular-nums shrink-0 px-2 py-1 bg-focus-surface border border-focus-border rounded-lg">
            {formatTime(elapsed)}
          </span>
        )}
      </div>

      {/* Score bar */}
      {score !== null && (
        <div className="mb-4 p-4 bg-focus-surface rounded-xl border border-focus-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-focus-text-muted uppercase tracking-wide">Understanding Score</span>
            <span className={`text-lg font-bold tabular-nums ${
              score >= 80 ? "text-focus-teal" : score >= 50 ? "text-focus-amber" : "text-red-400"
            }`}>{displayedScore}</span>
          </div>
          <div className="w-full bg-focus-border rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-700 ease-out ${
                score >= 80 ? "bg-focus-teal" : score >= 50 ? "bg-focus-amber" : "bg-red-500"
              } ${scoreGlow ? "animate-score-glow" : ""}`}
              style={{ width: `${score}%` }}
            />
          </div>
          {gaps.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {gaps.map((gap, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-red-900/25 text-red-300 rounded-md border border-red-800/30">
                  {gap}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Session summary */}
      {isComplete && summary && (
        <div className="mb-4 bg-focus-surface rounded-xl border border-focus-border overflow-hidden">
          <div className="px-4 py-3 border-b border-focus-border flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-focus-teal shrink-0">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <span className="text-sm font-semibold text-focus-text">Session Notes</span>
          </div>
          <div className="p-4 text-sm text-gray-200 prose prose-invert prose-sm max-w-none
                          prose-headings:text-gray-100 prose-headings:mb-2 prose-headings:mt-3
                          prose-p:my-1.5 prose-li:my-0 prose-ul:my-1.5 prose-ol:my-1.5
                          prose-code:text-focus-teal prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                          prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700
                          prose-strong:text-gray-100 prose-a:text-focus-teal max-h-80 overflow-y-auto">
            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={{ code: CodeBlock }}>
              {summary}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={`flex-1 overflow-hidden ${showComprehensionPanel ? "flex flex-col md:flex-row gap-4" : "flex flex-col"}`}>
        {/* Chat messages */}
        <div className={`${showComprehensionPanel ? "w-full md:w-3/5" : "w-full"} flex flex-col overflow-hidden`}>
          <div className="flex-1 overflow-y-auto mb-4 space-y-1 pr-1">
            {messages.length === 0 && !thinking && (
              <div className="flex flex-col items-center justify-center mt-16 text-gray-400">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-40">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
                <span className="text-sm">Connecting to session...</span>
              </div>
            )}
            {messages.map((msg, idx) => (
              <MessageBubble
                key={idx}
                agent={msg.agent}
                content={msg.content}
                isLatest={idx === messages.length - 1}
                isNew={!!msg.isNew}
                streaming={!!msg.streaming}
              />
            ))}

            {/* Thinking indicator */}
            {thinking && (
              <div className="flex items-start gap-3 py-3 px-1">
                <div className="w-8 h-8 rounded-lg bg-focus-teal/10 flex items-center justify-center shrink-0 border border-focus-teal/20">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-focus-teal">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                </div>
                <div className="bg-focus-surface border border-focus-border rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-focus-text-muted">Thinking</span>
                    <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-focus-teal"></span>
                    <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-focus-teal"></span>
                    <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-focus-teal"></span>
                  </div>
                </div>
              </div>
            )}

            {/* MCQ panel — interactive during quiz phase, results mode after submission */}
            {mcqQuestions && (phase === "quiz" || mcqSubmittedAnswers) && (
              <div className="my-4">
                <MCQPanel
                  questions={mcqQuestions}
                  onSubmit={onSubmitMCQ}
                  submittedAnswers={mcqSubmittedAnswers}
                />
              </div>
            )}

            {/* Code challenge */}
            {phase === "evaluate" && codeChallenge && (
              <CodeChallengePanel
                challenge={codeChallenge}
                codeInput={codeInput}
                setCodeInput={setCodeInput}
                onSubmit={handleCodeSubmit}
                showHints={showHints}
                setShowHints={setShowHints}
                submitting={submittingCode}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Comprehension side panel */}
        {showComprehensionPanel && (
          <div className="w-full md:w-2/5 md:border-l border-t md:border-t-0 border-focus-border md:pl-4 pt-4 md:pt-0 overflow-y-auto">
            <ComprehensionPanel questions={comprehensionMcqs} />
          </div>
        )}
      </div>

      {/* Input area */}
      {!isComplete && phase !== "quiz" && !(phase === "evaluate" && codeChallenge) && (
        <div className="border-t border-focus-border pt-3 mt-auto">
          {isExplainDone && (
            <button
              onClick={onReadyToTeach}
              disabled={thinking}
              className={`w-full py-3 mb-3 text-white font-medium rounded-xl transition-all disabled:opacity-50 btn-interactive btn-ripple ${
                isLeetcode
                  ? "bg-focus-teal hover:bg-focus-teal-light shadow-lg shadow-focus-teal/10"
                  : "bg-focus-teal hover:bg-focus-teal-light shadow-lg shadow-focus-teal/10"
              }`}
            >
              {isLeetcode ? "Ready for Challenge" : "I'm Ready to Teach"}
            </button>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            {isCodeMode && isTeachPhase ? (
              <div className="flex-1 rounded-xl overflow-hidden border border-focus-border focus-within:border-focus-teal transition-colors">
                <CodeEditor
                  value={input}
                  onChange={setInput}
                  language="python"
                  minHeight="80px"
                  maxHeight="200px"
                  placeholder="# Explain the code in your own words..."
                />
              </div>
            ) : (
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={handleInputFocus}
                placeholder={
                  isExplainDone
                    ? "Ask the professor a follow-up question..."
                    : isTeachPhase
                    ? "Explain the concept in your own words..."
                    : "Waiting for agent..."
                }
                disabled={!canType}
                className="flex-1 bg-focus-surface border border-focus-border rounded-xl px-4 py-3 text-sm
                           text-white placeholder-gray-500 focus:outline-none focus:border-focus-teal
                           focus:ring-1 focus:ring-focus-teal/30
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
            )}
            <button
              type="submit"
              disabled={!canType || !input.trim() || thinking}
              className="px-5 py-3 bg-focus-teal text-white text-sm font-medium rounded-xl
                         hover:bg-focus-teal-light disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all shadow-lg shadow-focus-teal/10 btn-interactive btn-ripple"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* Complete state footer */}
      {isComplete && (
        <div className="border-t border-focus-border pt-3 mt-auto text-center">
          <p className="text-sm text-focus-text-muted">Session complete. Click <strong className="text-focus-text">New Session</strong> above to start another.</p>
        </div>
      )}
    </div>
  );
}
