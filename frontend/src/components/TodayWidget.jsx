import { useState, useEffect } from "react";

export default function TodayWidget() {
  const [goalData, setGoalData] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const doFetch = async () => {
      try {
        const res = await fetch("/api/goals/today");
        const data = await res.json();
        setGoalData(data);
        setFetchedAt(Date.now());
      } catch {}
    };
    doFetch();
    const id = setInterval(doFetch, 10_000);
    return () => clearInterval(id);
  }, []);

  // Re-render every second for live clock + second counter
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!goalData) return null;

  const secondsSinceFetch = fetchedAt ? (Date.now() - fetchedAt) / 1000 : 0;
  const liveMinutes =
    goalData.actual_minutes +
    (goalData.active_session ? secondsSinceFetch / 60 : 0);

  const totalSecs = Math.floor(liveMinutes * 60);
  const displayMins = Math.floor(liveMinutes);
  const displaySecs = totalSecs % 60;

  // Clock hand angles based on total study seconds (like a stopwatch face)
  const secAngle = (totalSecs % 60) * 6;
  const minAngle = (Math.floor(totalSecs / 60) % 60) * 6 + (totalSecs % 60) * 0.1;

  const isActive = goalData.active_session;

  return (
    <div className="flex items-center gap-1.5 select-none" title="Today's study time">
      {/* Animated clock SVG */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 18 18"
        className="shrink-0"
        aria-hidden
      >
        <circle
          cx="9" cy="9" r="8"
          fill="none"
          stroke="#2a3444"
          strokeWidth="1.5"
        />
        {/* Clock face tick marks */}
        {[0, 90, 180, 270].map((a) => {
          const rad = (a * Math.PI) / 180;
          return (
            <line
              key={a}
              x1={9 + 6.5 * Math.sin(rad)}
              y1={9 - 6.5 * Math.cos(rad)}
              x2={9 + 7.5 * Math.sin(rad)}
              y2={9 - 7.5 * Math.cos(rad)}
              stroke="#3a4555"
              strokeWidth="1"
              strokeLinecap="round"
            />
          );
        })}
        {/* Minute hand */}
        <line
          x1="9" y1="9" x2="9" y2="3.5"
          stroke="#4a9a8e"
          strokeWidth="1.5"
          strokeLinecap="round"
          transform={`rotate(${minAngle}, 9, 9)`}
        />
        {/* Second hand */}
        <line
          x1="9" y1="10" x2="9" y2="2"
          stroke={isActive ? "#d4a574" : "#4a5568"}
          strokeWidth="0.75"
          strokeLinecap="round"
          transform={`rotate(${secAngle}, 9, 9)`}
        />
        <circle cx="9" cy="9" r="1" fill="#4a9a8e" />
      </svg>

      {/* Minutes counter */}
      <span className="font-mono font-bold text-focus-teal text-sm tabular-nums leading-none">
        {displayMins}
      </span>
      <span className="text-focus-text-dim text-xs leading-none">min</span>
      <span className="font-mono text-focus-text-dim text-xs tabular-nums leading-none w-[20px]">
        {displaySecs.toString().padStart(2, "0")}s
      </span>

      {/* Streak badge */}
      {goalData.streak_days > 0 && (
        <span className="text-xs font-bold text-focus-amber leading-none ml-0.5">
          {goalData.streak_days}🔥
        </span>
      )}
    </div>
  );
}
