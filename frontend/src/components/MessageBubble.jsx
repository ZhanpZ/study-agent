import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import CodeBlock from "./CodeBlock";

const AGENT_STYLES = {
  professor: {
    bg: "bg-focus-surface",
    border: "border-focus-border",
    label: "Professor",
    labelColor: "text-focus-teal",
    avatarBg: "bg-focus-teal/10 border-focus-teal/25",
    avatarIcon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
  student: {
    bg: "bg-focus-surface",
    border: "border-focus-border",
    label: "Student",
    labelColor: "text-focus-teal-light",
    avatarBg: "bg-focus-teal/10 border-focus-teal/20",
    avatarIcon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
  tester: {
    bg: "bg-focus-surface",
    border: "border-focus-border",
    label: "Evaluator",
    labelColor: "text-focus-amber",
    avatarBg: "bg-focus-amber/10 border-focus-amber/25",
    avatarIcon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  user: {
    bg: "bg-focus-bg-alt",
    border: "border-focus-border",
    label: "You",
    labelColor: "text-focus-text-muted",
    avatarBg: "bg-focus-surface border-focus-border",
    avatarIcon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  system: {
    bg: "bg-focus-surface",
    border: "border-focus-border",
    label: "System",
    labelColor: "text-focus-text-dim",
    avatarBg: "bg-focus-surface border-focus-border",
    avatarIcon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

const WORDS_PER_TICK = 2;
const TICK_MS = 30;

export default function MessageBubble({ agent, content, isLatest, isNew, streaming = false }) {
  const style = AGENT_STYLES[agent] || AGENT_STYLES.system;
  const isUser = agent === "user";

  // Skip word-by-word animation when real token streaming is active
  const shouldAnimate = isLatest && isNew && !isUser && !streaming;
  const words = useRef(content.split(/(\s+)/));
  const [wordIndex, setWordIndex] = useState(shouldAnimate ? 0 : words.current.length);
  const [isAnimating, setIsAnimating] = useState(shouldAnimate);

  // Reset animation when content changes (new message arrives)
  useEffect(() => {
    words.current = content.split(/(\s+)/);
    if (shouldAnimate) {
      setWordIndex(0);
      setIsAnimating(true);
    } else {
      setWordIndex(words.current.length);
      setIsAnimating(false);
    }
  }, [content, shouldAnimate]);

  // Word-by-word reveal interval
  useEffect(() => {
    if (!isAnimating) return;
    const interval = setInterval(() => {
      setWordIndex((prev) => {
        const next = prev + WORDS_PER_TICK;
        if (next >= words.current.length) {
          clearInterval(interval);
          setIsAnimating(false);
          return words.current.length;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [isAnimating]);

  const displayedContent = isAnimating
    ? words.current.slice(0, wordIndex).join("")
    : content;

  return (
    <div className={`flex gap-3 py-2.5 ${isUser ? "flex-row-reverse" : ""} ${isLatest && isNew ? "animate-message-enter" : ""}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${style.avatarBg}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={style.labelColor}>
          <path d={style.avatarIcon}/>
        </svg>
      </div>

      {/* Content */}
      <div className={`max-w-[85%] rounded-xl px-4 py-3 border ${style.bg} ${style.border}`}>
        <div className={`text-[11px] font-semibold mb-1.5 ${style.labelColor} uppercase tracking-wider`}>
          {style.label}
        </div>
        {isUser ? (
          <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
            {content}
          </div>
        ) : (
          <div className="text-sm text-gray-200 leading-relaxed prose prose-invert prose-sm max-w-none
                          prose-headings:text-gray-100 prose-headings:mb-2 prose-headings:mt-3
                          prose-p:my-1.5 prose-li:my-0.5 prose-ul:my-1.5 prose-ol:my-1.5
                          prose-code:text-focus-teal prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                          prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700 prose-pre:rounded-lg
                          prose-strong:text-gray-100 prose-a:text-focus-teal
                          prose-blockquote:border-l-focus-teal prose-blockquote:text-gray-300">
            <ReactMarkdown
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex]}
              components={{
                code: CodeBlock,
              }}
            >
              {displayedContent}
            </ReactMarkdown>
            {streaming && (
              <span className="inline-block w-0.5 h-4 bg-focus-teal ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
