import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import PhaseIndicator from "./PhaseIndicator";
import MCQPanel from "./MCQPanel";
import ComprehensionPanel from "./ComprehensionPanel";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import CodeBlock from "./CodeBlock";

export default function Chat({
  messages, phase, score, gaps, connected, mode,
  mcqQuestions, codeChallenge, summary, comprehensionMcqs,
  thinking, connectionStatus, phaseTransition,
  onSend, onReadyToTeach, onSubmitMCQ, onSubmitCode,
}) {
  const [input, setInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [showHints, setShowHints] = useState(false);
  const [submittingCode, setSubmittingCode] = useState(false);
  const messagesEndRef = useRef(null);
  const codeTextareaRef = useRef(null);
  const inputRef = useRef(null);

  const handleInputFocus = (e) => {
    const el = e.target;
    const len = el.value.length;
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = len;
      el.scrollLeft = el.scrollWidth;
    });
  };
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, mcqQuestions, codeChallenge, thinking]);

  useEffect(() => {
    if (!thinking) setSubmittingCode(false);
  }, [thinking]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || !canType) return;
    onSend(input.trim());
    setInput("");
  };

  const handleCodeSubmit = () => {
    if (codeInput.trim()) {
      setSubmittingCode(true);
      onSubmitCode(codeInput.trim());
    }
  };

  const handleTabKey = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.target;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = codeInput.substring(0, start) + "    " + codeInput.substring(end);
      setCodeInput(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
      });
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCodeSubmit();
    }
  };

  const lineCount = codeInput.split("\n").length;

  return (
    <div className="flex flex-col h-full">
      {/* Connection status banner */}
      {connectionStatus === "reconnecting" && (
        <div className="mb-3 px-4 py-2.5 bg-amber-950/80 border border-amber-800/60 rounded-xl text-xs text-amber-300 flex items-center gap-2.5">
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
        <div className="mb-3 px-4 py-2.5 bg-indigo-950/80 border border-indigo-800/60 rounded-xl text-xs text-indigo-300 text-center font-medium animate-slide-in">
          Entering: {phaseTransition} phase
        </div>
      )}

      {/* Phase indicator */}
      <PhaseIndicator currentPhase={phase} mode={mode} />

      {/* Score bar */}
      {score !== null && (
        <div className="mb-4 p-4 bg-focus-surface rounded-xl border border-focus-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-focus-text-muted uppercase tracking-wide">Understanding Score</span>
            <span className={`text-lg font-bold ${
              score >= 80 ? "text-green-400" : score >= 50 ? "text-amber-400" : "text-red-400"
            }`}>{Math.round(score)}</span>
          </div>
          <div className="w-full bg-focus-border rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-700 ease-out ${
                score >= 80 ? "bg-green-500" : score >= 50 ? "bg-amber-500" : "bg-red-500"
              }`}
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
                          prose-code:text-indigo-300 prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                          prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700
                          prose-strong:text-gray-100 prose-a:text-indigo-400 max-h-80 overflow-y-auto">
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
              <MessageBubble key={idx} agent={msg.agent} content={msg.content} />
            ))}

            {/* Thinking indicator */}
            {thinking && (
              <div className="flex items-start gap-3 py-3 px-1">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0 border border-blue-500/20">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                </div>
                <div className="bg-focus-surface border border-focus-border rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Thinking</span>
                    <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  </div>
                </div>
              </div>
            )}

            {/* MCQ panel */}
            {phase === "quiz" && mcqQuestions && (
              <div className="my-4">
                <MCQPanel questions={mcqQuestions} onSubmit={onSubmitMCQ} />
              </div>
            )}

            {/* Code challenge */}
            {phase === "evaluate" && codeChallenge && (
              <CodeChallengePanel
                challenge={codeChallenge}
                codeInput={codeInput}
                setCodeInput={setCodeInput}
                onSubmit={handleCodeSubmit}
                onKeyDown={handleTabKey}
                lineCount={lineCount}
                showHints={showHints}
                setShowHints={setShowHints}
                submitting={submittingCode}
                textareaRef={codeTextareaRef}
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
              className={`w-full py-3 mb-3 text-white font-medium rounded-xl transition-all disabled:opacity-50 ${
                isLeetcode
                  ? "bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-900/20"
                  : "bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/20"
              }`}
            >
              {isLeetcode ? "Ready for Challenge" : "I'm Ready to Teach"}
            </button>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            {isCodeMode && isTeachPhase ? (
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={handleInputFocus}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                rows={3}
                placeholder="Explain the code in your own words..."
                className="flex-1 bg-focus-surface border border-focus-border rounded-xl px-4 py-3 text-sm
                           text-white font-mono placeholder-gray-500 focus:outline-none
                           focus:border-focus-teal focus:ring-1 focus:ring-focus-teal/30
                           disabled:opacity-50 disabled:cursor-not-allowed resize-y transition-colors"
              />
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
                         transition-all shadow-lg shadow-focus-teal/10"
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


/* ─── Code Challenge Panel ─────────────────────────── */

function CodeChallengePanel({
  challenge, codeInput, setCodeInput, onSubmit, onKeyDown,
  lineCount, showHints, setShowHints, submitting, textareaRef,
}) {
  const lines = codeInput.split("\n");

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-focus-border bg-focus-surface">
      {/* Problem header */}
      <div className="px-5 py-4 border-b border-focus-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center border border-amber-500/25">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white">
              {challenge.title || "Coding Challenge"}
            </h3>
            {challenge.difficulty && (
              <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${
                challenge.difficulty === "Easy"
                  ? "bg-green-500/15 text-green-400 border-green-500/25"
                  : challenge.difficulty === "Medium"
                  ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                  : "bg-red-500/15 text-red-400 border-red-500/25"
              }`}>
                {challenge.difficulty}
              </span>
            )}
          </div>
          {challenge.url && (
            <a
              href={challenge.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-focus-text-muted hover:text-amber-400 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              LeetCode
            </a>
          )}
        </div>

        <div className="text-sm text-gray-300 leading-relaxed prose prose-invert prose-sm max-w-none
                        prose-headings:text-gray-100 prose-headings:mb-2 prose-headings:mt-3
                        prose-p:my-1.5 prose-li:my-0 prose-ul:my-1.5
                        prose-code:text-indigo-300 prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                        prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700 prose-pre:rounded-lg
                        prose-strong:text-gray-100 max-h-80 overflow-y-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
            {challenge.problem}
          </ReactMarkdown>
        </div>

        {challenge.hints && challenge.hints.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowHints(!showHints)}
              className="flex items-center gap-1.5 text-xs text-focus-amber hover:text-focus-amber-light transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              {showHints ? "Hide hints" : `Show ${challenge.hints.length} hint${challenge.hints.length > 1 ? "s" : ""}`}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${showHints ? "rotate-180" : ""}`}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {showHints && (
              <div className="mt-2 space-y-1.5">
                {challenge.hints.map((hint, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-300/80 bg-amber-900/15 rounded-lg px-3 py-2 border border-amber-800/20">
                    <span className="text-amber-500 font-mono shrink-0">{i + 1}.</span>
                    <span>{hint}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Code editor */}
      <div className="relative">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/60"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/60"></span>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">solution.py</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span>{lineCount} {lineCount === 1 ? "line" : "lines"}</span>
            <span className="text-gray-700">|</span>
            <span className="text-gray-600">Tab = 4 spaces</span>
          </div>
        </div>

        {/* Line numbers + textarea */}
        <div className="flex">
          <div className="select-none py-3 pl-3 pr-2 bg-gray-900/60 text-right border-r border-gray-800/50 min-w-[3rem]">
            {lines.map((_, i) => (
              <div key={i} className="text-[11px] leading-[1.65rem] text-gray-600 font-mono">
                {i + 1}
              </div>
            ))}
            {codeInput.endsWith("\n") && (
              <div className="text-[11px] leading-[1.65rem] text-gray-600 font-mono">
                {lines.length + 1}
              </div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={Math.max(12, lineCount + 2)}
            placeholder="# Write your solution here..."
            className="flex-1 bg-gray-900/40 px-3 py-3 text-sm text-emerald-300 font-mono
                       placeholder-gray-600 focus:outline-none resize-none
                       leading-[1.65rem] caret-emerald-400"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>
      </div>

      {/* Submit footer */}
      <div className="px-4 py-3 border-t border-focus-border bg-focus-surface flex items-center justify-between">
        <span className="text-[11px] text-gray-400">
          <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 border border-gray-700 font-mono text-[10px]">Ctrl</kbd>
          +
          <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 border border-gray-700 font-mono text-[10px]">Enter</kbd>
          <span className="ml-1.5">to submit</span>
        </span>
        <button
          onClick={onSubmit}
          disabled={!codeInput.trim() || submitting}
          className="px-6 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg
                     hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              Evaluating...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Submit Code
            </>
          )}
        </button>
      </div>
    </div>
  );
}
