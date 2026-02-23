import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const AGENT_STYLES = {
  professor: {
    bg: "bg-blue-900/40",
    border: "border-blue-700/50",
    label: "Professor",
    labelColor: "text-blue-400",
  },
  student: {
    bg: "bg-green-900/40",
    border: "border-green-700/50",
    label: "Student",
    labelColor: "text-green-400",
  },
  tester: {
    bg: "bg-orange-900/40",
    border: "border-orange-700/50",
    label: "Evaluator",
    labelColor: "text-orange-400",
  },
  user: {
    bg: "bg-indigo-900/40",
    border: "border-indigo-700/50",
    label: "You",
    labelColor: "text-indigo-400",
  },
  system: {
    bg: "bg-gray-800/60",
    border: "border-gray-700/50",
    label: "System",
    labelColor: "text-gray-400",
  },
};

export default function MessageBubble({ agent, content }) {
  const style = AGENT_STYLES[agent] || AGENT_STYLES.system;
  const isUser = agent === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 border ${style.bg} ${style.border}`}
      >
        <div className={`text-xs font-semibold mb-1 ${style.labelColor}`}>
          {style.label}
        </div>
        {isUser ? (
          <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
            {content}
          </div>
        ) : (
          <div className="text-sm text-gray-200 leading-relaxed prose prose-invert prose-sm max-w-none
                          prose-headings:text-gray-100 prose-headings:mb-2 prose-headings:mt-3
                          prose-p:my-1 prose-li:my-0 prose-ul:my-1 prose-ol:my-1
                          prose-code:text-indigo-300 prose-code:bg-gray-800 prose-code:px-1 prose-code:rounded
                          prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700
                          prose-strong:text-gray-100 prose-a:text-indigo-400">
            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
