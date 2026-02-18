const PHASES = [
  { key: "explain", label: "Learn", color: "bg-blue-500" },
  { key: "teach", label: "Teach", color: "bg-green-500" },
  { key: "evaluate", label: "Evaluate", color: "bg-orange-500" },
  { key: "complete", label: "Complete", color: "bg-purple-500" },
];

export default function PhaseIndicator({ currentPhase }) {
  const currentIdx = PHASES.findIndex((p) => p.key === currentPhase);

  return (
    <div className="flex items-center gap-2 mb-4">
      {PHASES.map((phase, idx) => (
        <div key={phase.key} className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              idx === currentIdx
                ? `${phase.color} text-white`
                : idx < currentIdx
                ? "bg-gray-700 text-gray-300"
                : "bg-gray-800 text-gray-500"
            }`}
          >
            {idx < currentIdx && <span>&#10003;</span>}
            {phase.label}
          </div>
          {idx < PHASES.length - 1 && (
            <div
              className={`w-8 h-0.5 ${
                idx < currentIdx ? "bg-gray-600" : "bg-gray-800"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
