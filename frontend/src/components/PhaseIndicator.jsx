import { useState, useEffect, useRef } from "react";

const ALL_PHASES = [
  { key: "explain", label: "Learn", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { key: "teach", label: "Teach", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { key: "evaluate", label: "Evaluate", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "complete", label: "Complete", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
];

const LEETCODE_PHASES = [
  { key: "explain", label: "Learn", icon: ALL_PHASES[0].icon },
  { key: "evaluate", label: "Challenge", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
  { key: "complete", label: "Complete", icon: ALL_PHASES[3].icon },
];

const PHASE_MAP = {
  explain: "explain",
  explain_done: "explain",
  teach: "teach",
  quiz: "evaluate",
  evaluate: "evaluate",
  complete: "complete",
};

const COLORS = {
  explain: { bg: "bg-blue-500", glow: "shadow-blue-500/25", border: "border-blue-500/30", text: "text-blue-400", fill: "bg-blue-500/15", line: "bg-blue-500" },
  teach: { bg: "bg-green-500", glow: "shadow-green-500/25", border: "border-green-500/30", text: "text-green-400", fill: "bg-green-500/15", line: "bg-green-500" },
  evaluate: { bg: "bg-amber-500", glow: "shadow-amber-500/25", border: "border-amber-500/30", text: "text-amber-400", fill: "bg-amber-500/15", line: "bg-amber-500" },
  complete: { bg: "bg-purple-500", glow: "shadow-purple-500/25", border: "border-purple-500/30", text: "text-purple-400", fill: "bg-purple-500/15", line: "bg-purple-500" },
};

export default function PhaseIndicator({ currentPhase, mode }) {
  const phases = mode === "leetcode" ? LEETCODE_PHASES : ALL_PHASES;
  const mappedPhase = PHASE_MAP[currentPhase] || currentPhase;
  const currentIdx = phases.findIndex((p) => p.key === mappedPhase);

  // Track phase transitions for pulse animation
  const prevPhaseRef = useRef(mappedPhase);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (mappedPhase !== prevPhaseRef.current) {
      prevPhaseRef.current = mappedPhase;
      setTransitioning(true);
      const t = setTimeout(() => setTransitioning(false), 1500);
      return () => clearTimeout(t);
    }
  }, [mappedPhase]);

  return (
    <div className="flex items-center mb-5">
      {phases.map((phase, idx) => {
        const c = COLORS[phase.key];
        const isCurrent = idx === currentIdx;
        const isDone = idx < currentIdx;

        return (
          <div key={phase.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 relative">
              {/* Circle */}
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  isCurrent
                    ? `${c.bg} text-white shadow-lg ${c.glow}`
                    : isDone
                    ? `${c.fill} ${c.text} border ${c.border}`
                    : "bg-focus-surface text-gray-600 border border-focus-border"
                } ${isCurrent && transitioning ? "animate-phase-pulse" : ""}`}
              >
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={phase.icon}/>
                  </svg>
                )}
              </div>
              {/* Label */}
              <span className={`text-[11px] font-medium transition-colors ${
                isCurrent ? "text-white" : isDone ? "text-focus-text-muted" : "text-gray-600"
              }`}>
                {phase.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < phases.length - 1 && (
              <div className="flex-1 mx-2 mt-[-1.25rem]">
                <div className={`h-[2px] rounded-full transition-all duration-500 ${
                  isDone ? c.line : "bg-focus-border"
                }`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
