import { Routes, Route, Link, useLocation } from "react-router-dom";
import Study from "./pages/Study";
import Review from "./pages/Review";
import Dashboard from "./pages/Dashboard";
import AlgorithmQuiz from "./pages/AlgorithmQuiz";
import MLMathDrill from "./pages/MLMathDrill";
import PomodoroTimer from "./components/PomodoroTimer";

const NAV_ITEMS = [
  { path: "/", label: "Study", icon: "\u{1F4D6}" },
  { path: "/algorithm-quiz", label: "Algo Quiz", icon: "\u{1F9E9}" },
  { path: "/ml-math", label: "ML Math(TBC)", icon: "\u{1F4D0}" },
  { path: "/review", label: "Review", icon: "\u{1F504}" },
  { path: "/dashboard", label: "Dashboard", icon: "\u{1F4CA}" },
];

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-focus-bg">
      {/* Header */}
      <header className="border-b border-focus-border bg-focus-bg-alt">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-focus-text">Study Agent</h1>
          <nav className="flex gap-1 items-center">
            {NAV_ITEMS.map(({ path, label, icon }) => (
              <Link
                key={path}
                to={path}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === path
                    ? "bg-focus-teal text-white"
                    : "text-focus-text-muted hover:text-focus-text hover:bg-focus-surface"
                }`}
              >
                {icon} {label}
              </Link>
            ))}
            <div className="ml-3 border-l border-focus-border pl-3">
              <PomodoroTimer />
            </div>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<Study />} />
          <Route path="/algorithm-quiz" element={<AlgorithmQuiz />} />
          <Route path="/ml-math" element={<MLMathDrill />} />
          <Route path="/review" element={<Review />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}
