import { Routes, Route, Link, useLocation } from "react-router-dom";
import Study from "./pages/Study";
import Review from "./pages/Review";
import Dashboard from "./pages/Dashboard";
import AlgorithmQuiz from "./pages/AlgorithmQuiz";

const NAV_ITEMS = [
  { path: "/", label: "Study", icon: "📖" },
  { path: "/algorithm-quiz", label: "Algo Quiz", icon: "🧩" },
  { path: "/review", label: "Review", icon: "🔄" },
  { path: "/dashboard", label: "Dashboard", icon: "📊" },
];

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Study Agent</h1>
          <nav className="flex gap-1">
            {NAV_ITEMS.map(({ path, label, icon }) => (
              <Link
                key={path}
                to={path}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === path
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {icon} {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<Study />} />
          <Route path="/algorithm-quiz" element={<AlgorithmQuiz />} />
          <Route path="/review" element={<Review />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}
