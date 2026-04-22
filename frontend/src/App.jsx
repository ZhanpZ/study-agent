import { useState, lazy, Suspense } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import Study from "./pages/Study";
import PomodoroTimer from "./components/PomodoroTimer";

// Lazy-load heavy pages to reduce initial bundle size
const Review = lazy(() => import("./pages/Review"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

const NAV_ITEMS = [
  { path: "/", label: "Study", icon: "\u{1F4D6}" },
  { path: "/review", label: "Review", icon: "\u{1F504}" },
  { path: "/dashboard", label: "Dashboard", icon: "\u{1F4CA}" },
];

export default function App() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-focus-bg">
      {/* Header */}
      <header className="border-b border-focus-border bg-focus-bg-alt">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-focus-text hover:text-focus-accent transition-colors">Study Agent</Link>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-focus-text-muted hover:text-focus-text"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {mobileMenuOpen ? (
                <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              ) : (
                <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
              )}
            </svg>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-1 items-center">
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

        {/* Mobile nav dropdown */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-focus-border px-4 py-2 space-y-1">
            {NAV_ITEMS.map(({ path, label, icon }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === path
                    ? "bg-focus-teal text-white"
                    : "text-focus-text-muted hover:text-focus-text hover:bg-focus-surface"
                }`}
              >
                {icon} {label}
              </Link>
            ))}
            <div className="pt-2 border-t border-focus-border">
              <PomodoroTimer />
            </div>
          </nav>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh] text-focus-text-muted">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Study />} />
            <Route path="/review" element={<Review />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
