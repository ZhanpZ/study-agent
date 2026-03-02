import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useState } from "react";

const customStyle = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: "rgba(15, 20, 25, 0.8)",
    margin: 0,
    borderRadius: "0.5rem",
    fontSize: "0.8125rem",
    lineHeight: "1.6",
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: "none",
    fontSize: "0.8125rem",
    lineHeight: "1.6",
  },
};

export default function CodeBlock({ children, className, node, ...rest }) {
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const code = String(children).replace(/\n$/, "");
  const isInline = !className && !code.includes("\n");
  const [copied, setCopied] = useState(false);

  if (isInline) {
    return (
      <code className="text-indigo-300 bg-gray-800 px-1.5 py-0.5 rounded text-[0.8125rem]" {...rest}>
        {children}
      </code>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-2">
      {/* Language label + copy button */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/80 rounded-t-lg border border-gray-700 border-b-0">
        <span className="text-[11px] text-gray-400 font-mono uppercase tracking-wide">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="text-[11px] text-gray-400 hover:text-gray-300 transition-colors flex items-center gap-1"
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <div className="border border-gray-700 border-t-0 rounded-b-lg overflow-hidden">
        <SyntaxHighlighter
          style={customStyle}
          language={language || "python"}
          showLineNumbers
          lineNumberStyle={{ color: "#4b5563", fontSize: "0.75rem", minWidth: "2em" }}
          wrapLongLines
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
