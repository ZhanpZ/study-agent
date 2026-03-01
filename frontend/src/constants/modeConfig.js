export const MODE_CONFIG = {
  concept: {
    label: "Concept",
    color: "bg-blue-600 border-blue-500",
    inactive: "border-focus-border hover:border-blue-500/50 hover:bg-blue-950/30",
    badge: "bg-blue-900/40 text-blue-400 border border-blue-700/50",
    badgeLight: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    description: "Understand through analogies and explanations. Tested with MCQs.",
    placeholder: "e.g. Binary Search Trees, TCP/IP, Dynamic Programming...",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    iconColor: "text-blue-400",
  },
  industrial: {
    label: "Industrial",
    color: "bg-emerald-600 border-emerald-500",
    inactive: "border-focus-border hover:border-emerald-500/50 hover:bg-emerald-950/30",
    badge: "bg-emerald-900/40 text-emerald-400 border border-emerald-700/50",
    badgeLight: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    description: "Production code, design patterns, SOLID principles, system design.",
    placeholder: "e.g. REST API Design, Dependency Injection, Observer Pattern...",
    icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
    iconColor: "text-emerald-400",
  },
  leetcode: {
    label: "Leetcode",
    color: "bg-amber-600 border-amber-500",
    inactive: "border-focus-border hover:border-amber-500/50 hover:bg-amber-950/30",
    badge: "bg-amber-900/40 text-amber-400 border border-amber-700/50",
    badgeLight: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    description: "Algorithms, data structures, time/space complexity, problem-solving.",
    placeholder: "e.g. Two Sum, BFS, Sliding Window, Merge Sort...",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    iconColor: "text-amber-400",
  },
};

export const ACTIVITY_TYPE = {
  algorithm: { label: "Algo Quiz", color: "bg-focus-amber-dim/40 text-focus-amber" },
  constraint: { label: "Constraint Quiz", color: "bg-blue-900/40 text-blue-400" },
  ml_math: { label: "ML Math", color: "bg-violet-900/40 text-violet-400" },
};
