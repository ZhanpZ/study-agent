import { useState, useEffect } from "react";

const DEFAULT_MESSAGES = [
  "Crafting questions…",
  "Analyzing concepts…",
  "Setting difficulty…",
  "Checking answers…",
  "Finalizing quiz…",
];

export default function GeneratingLoader({
  messages = DEFAULT_MESSAGES,
  note,
  accentColor = "amber",
}) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setMsgIdx((i) => (i + 1) % messages.length),
      2400,
    );
    return () => clearInterval(timer);
  }, [messages]);

  // Fake progress: fast at first, slows to ~85% max
  useEffect(() => {
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 85) return p;
        const step = p < 35 ? 4 : p < 60 ? 2 : 0.6;
        return Math.min(85, p + step);
      });
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const colors = {
    amber: {
      border: "border-amber-800/40",
      bg: "bg-amber-950/20",
      spinner: "text-amber-500",
      text: "text-amber-300",
      bar: "bg-amber-500",
    },
    teal: {
      border: "border-teal-800/40",
      bg: "bg-teal-950/20",
      spinner: "text-teal-400",
      text: "text-teal-300",
      bar: "bg-teal-500",
    },
  };
  const c = colors[accentColor] ?? colors.amber;

  return (
    <div
      className={`mt-4 p-6 rounded-xl border ${c.border} ${c.bg} text-center`}
    >
      <svg
        className={`animate-spin h-8 w-8 ${c.spinner} mx-auto mb-4`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>

      <p className={`${c.text} font-medium text-sm mb-4 h-5`}>
        {messages[msgIdx]}
      </p>

      <div className="w-full max-w-xs mx-auto bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full ${c.bar} rounded-full transition-all duration-500`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {note && <p className="text-xs text-gray-500 mt-3 italic">{note}</p>}
    </div>
  );
}
