import { useState, useEffect, useRef, useCallback } from "react";

const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.stop(ctx.currentTime + 0.8);
  } catch {
    /* silent fallback */
  }
}

export default function PomodoroTimer() {
  const [secondsLeft, setSecondsLeft] = useState(WORK_SECONDS);
  const [running, setRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const intervalRef = useRef(null);
  const panelRef = useRef(null);

  const totalSeconds = isBreak ? BREAK_SECONDS : WORK_SECONDS;
  const progress = 1 - secondsLeft / totalSeconds;

  const tick = useCallback(() => {
    setSecondsLeft((prev) => {
      if (prev <= 1) {
        playBeep();
        return 0;
      }
      return prev - 1;
    });
  }, []);

  useEffect(() => {
    if (running && secondsLeft > 0) {
      intervalRef.current = setInterval(tick, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, secondsLeft, tick]);

  // When timer hits 0, switch mode
  useEffect(() => {
    if (secondsLeft === 0 && running) {
      setRunning(false);
      if (!isBreak) {
        setIsBreak(true);
        setSecondsLeft(BREAK_SECONDS);
      } else {
        setIsBreak(false);
        setSecondsLeft(WORK_SECONDS);
      }
    }
  }, [secondsLeft, running, isBreak]);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowPanel(false);
      }
    }
    if (showPanel) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPanel]);

  const reset = () => {
    setRunning(false);
    setIsBreak(false);
    setSecondsLeft(WORK_SECONDS);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  // SVG ring
  const size = 40;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - progress);

  const ringColor = isBreak ? "#d4a574" : running ? "#4a9a8e" : "#6b7280";

  return (
    <div className="relative" ref={panelRef}>
      {/* Compact timer button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-focus-surface transition-colors"
        title="Pomodoro Timer"
      >
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#2a3444"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <span
          className="text-sm font-mono font-medium"
          style={{ color: ringColor }}
        >
          {timeStr}
        </span>
      </button>

      {/* Expanded panel */}
      {showPanel && (
        <div className="absolute right-0 top-full mt-2 bg-focus-surface border border-focus-border rounded-xl p-4 shadow-2xl z-50 w-56">
          <div className="text-center mb-3">
            <div
              className="text-xs font-semibold uppercase tracking-wider mb-1"
              style={{ color: ringColor }}
            >
              {isBreak ? "Break" : "Focus"}
            </div>
            <div className="text-3xl font-mono font-bold text-focus-text">
              {timeStr}
            </div>
          </div>

          <div className="flex justify-center gap-2">
            <button
              onClick={() => setRunning(!running)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                running
                  ? "bg-focus-border text-focus-text-muted hover:bg-focus-border-light"
                  : "bg-focus-teal text-white hover:bg-focus-teal-light"
              }`}
            >
              {running ? "Pause" : "Start"}
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-focus-border text-focus-text-muted hover:bg-focus-border-light transition-colors"
            >
              Reset
            </button>
          </div>

          <div className="mt-3 text-center text-xs text-focus-text-dim">
            25 min focus / 5 min break
          </div>
        </div>
      )}
    </div>
  );
}
