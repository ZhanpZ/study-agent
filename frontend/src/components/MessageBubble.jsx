import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const AGENT_STYLES = {
  professor: {
    bg: "bg-blue-950/40",
    border: "border-blue-800/30",
    label: "Professor",
    labelColor: "text-blue-400",
    avatarBg: "bg-blue-500/15 border-blue-500/25",
    avatarIcon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
  student: {
    bg: "bg-green-950/40",
    border: "border-green-800/30",
    label: "Student",
    labelColor: "text-green-400",
    avatarBg: "bg-green-500/15 border-green-500/25",
    avatarIcon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
  tester: {
    bg: "bg-orange-950/40",
    border: "border-orange-800/30",
    label: "Evaluator",
    labelColor: "text-orange-400",
    avatarBg: "bg-orange-500/15 border-orange-500/25",
    avatarIcon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  user: {
    bg: "bg-indigo-950/40",
    border: "border-indigo-800/30",
    label: "You",
    labelColor: "text-indigo-400",
    avatarBg: "bg-indigo-500/15 border-indigo-500/25",
    avatarIcon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  system: {
    bg: "bg-gray-900/40",
    border: "border-gray-700/30",
    label: "System",
    labelColor: "text-gray-400",
    avatarBg: "bg-gray-600/15 border-gray-600/25",
    avatarIcon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

export default function MessageBubble({ agent, content }) {
  const style = AGENT_STYLES[agent] || AGENT_STYLES.system;
  const isUser = agent === "user";

  return (
    <div className={`flex gap-3 py-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
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
                          prose-code:text-indigo-300 prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                          prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700 prose-pre:rounded-lg
                          prose-strong:text-gray-100 prose-a:text-indigo-400
                          prose-blockquote:border-l-focus-teal prose-blockquote:text-gray-300">
            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
