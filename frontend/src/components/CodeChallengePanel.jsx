import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";

export default function CodeChallengePanel({
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
                     transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2
                     btn-interactive btn-ripple"
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
