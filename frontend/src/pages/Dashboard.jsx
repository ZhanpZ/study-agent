import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useToast } from "../components/Toast";
import ConceptDetail from "../components/ConceptDetail";
import { ACTIVITY_TYPE } from "../constants/modeConfig";
import fetchWithTimeout from "../utils/fetchWithTimeout";

export default function Dashboard() {
  const [skills, setSkills] = useState([]);
  const [stats, setStats] = useState(null);
  const [quizHistory, setQuizHistory] = useState([]);
  const [reviewsDue, setReviewsDue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [deletingConcepts, setDeletingConcepts] = useState(new Set());
  const [deletingEntries, setDeletingEntries] = useState(new Set());
  const [resettingHistory, setResettingHistory] = useState(false);
  const [mergingConcepts, setMergingConcepts] = useState(false);
  const { addToast } = useToast();

  const refreshSkillsAndReviews = async () => {
    const [skillsRes, reviewRes] = await Promise.allSettled([
      fetchWithTimeout("/api/dashboard/skills").then((r) => r.json()),
      fetchWithTimeout("/api/reviews/due").then((r) => r.json()),
    ]);
    if (skillsRes.status === "fulfilled") setSkills(skillsRes.value);
    if (reviewRes.status === "fulfilled") setReviewsDue(reviewRes.value);
  };

  const mergeSimilarConcepts = async () => {
    setMergingConcepts(true);
    try {
      const res = await fetchWithTimeout("/api/concepts/deduplicate", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        if (data.merged_count > 0) {
          addToast(`Merged ${data.merged_count} similar topic${data.merged_count > 1 ? "s" : ""}`, "success");
          await refreshSkillsAndReviews();
        } else {
          addToast("No similar topics found to merge", "success", 2000);
        }
      } else {
        addToast("Failed to merge topics", "error");
      }
    } catch {
      addToast("Failed to merge topics. Check your connection.", "error");
    } finally {
      setMergingConcepts(false);
    }
  };

  const deleteQuizEntry = async (entryId) => {
    setDeletingEntries((prev) => new Set([...prev, entryId]));
    try {
      const res = await fetchWithTimeout(`/api/quiz-history/${entryId}`, { method: "DELETE" });
      if (res.ok) {
        setQuizHistory((prev) => prev.filter((e) => e.id !== entryId));
        addToast("Entry deleted", "success", 2000);
      } else {
        addToast("Failed to delete entry", "error");
      }
    } catch {
      addToast("Failed to delete entry. Check your connection.", "error");
    } finally {
      setDeletingEntries((prev) => { const n = new Set(prev); n.delete(entryId); return n; });
    }
  };

  const deleteConcept = async (conceptId) => {
    setDeletingConcepts((prev) => new Set([...prev, conceptId]));
    try {
      const res = await fetchWithTimeout(`/api/concepts/${conceptId}`, { method: "DELETE" });
      if (res.ok) {
        setSkills((prev) => prev.filter((s) => s.concept_id !== conceptId));
        addToast("Concept deleted", "success", 2000);
      } else {
        addToast("Failed to delete concept", "error");
      }
    } catch {
      addToast("Failed to delete concept. Check your connection.", "error");
    } finally {
      setDeletingConcepts((prev) => { const n = new Set(prev); n.delete(conceptId); return n; });
    }
  };

  const resetQuizHistory = async () => {
    setResettingHistory(true);
    try {
      await Promise.all([
        fetchWithTimeout("/api/quiz-history?quiz_type=algorithm", { method: "DELETE" }),
        fetchWithTimeout("/api/quiz-history?quiz_type=constraint", { method: "DELETE" }),
      ]);
      setQuizHistory((prev) =>
        prev.filter((e) => e.quiz_type !== "algorithm" && e.quiz_type !== "constraint")
      );
      addToast("Quiz history cleared", "success", 2000);
    } catch {
      addToast("Failed to clear history", "error");
    } finally {
      setResettingHistory(false);
    }
  };

  useEffect(() => {
    Promise.allSettled([
      fetchWithTimeout("/api/dashboard/skills").then((r) => r.json()),
      fetchWithTimeout("/api/dashboard/stats").then((r) => r.json()),
      fetchWithTimeout("/api/quiz-history?limit=500").then((r) => r.json()),
      fetchWithTimeout("/api/reviews/due").then((r) => r.json()),
    ])
      .then(([skillsRes, statsRes, quizRes, reviewRes]) => {
        if (skillsRes.status === "fulfilled") setSkills(skillsRes.value);
        if (statsRes.status === "fulfilled") setStats(statsRes.value);
        if (quizRes.status === "fulfilled") setQuizHistory(quizRes.value);
        if (reviewRes.status === "fulfilled") setReviewsDue(reviewRes.value);

        const failures = [skillsRes, statsRes, quizRes, reviewRes].filter(
          (r) => r.status === "rejected"
        );
        if (failures.length > 0) {
          addToast("Some dashboard data failed to load", "warning");
        }
        setLoading(false);
      });
  }, []);

  // Derive section-specific data (memoized to avoid recalc on every render)
  // These must be above the early return to satisfy Rules of Hooks
  const algoQuizzes = useMemo(
    () => quizHistory.filter((q) => q.quiz_type === "algorithm" || q.quiz_type === "constraint"),
    [quizHistory]
  );
  const mlMathQuizzes = useMemo(
    () => quizHistory.filter((q) => q.quiz_type === "ml_math"),
    [quizHistory]
  );

  const algoAvg = useMemo(
    () => algoQuizzes.length
      ? Math.round(algoQuizzes.reduce((s, q) => s + (q.score || 0), 0) / algoQuizzes.length)
      : null,
    [algoQuizzes]
  );

  // Recent activity (last 10 across all types)
  const recentActivity = useMemo(() => quizHistory.slice(0, 10), [quizHistory]);

  // Top knowledge gaps across all skills
  const topGaps = useMemo(() => {
    const allGaps = skills.flatMap((s) => s.misconceptions || []);
    return [...new Set(allGaps)].slice(0, 3);
  }, [skills]);

  // Per-algorithm mastery derived from stored question/answer data
  const algoMastery = useMemo(() => {
    const counts = {};
    for (const entry of algoQuizzes) {
      if (entry.quiz_type !== "algorithm") continue;
      const qs = entry.questions || [];
      const ans = entry.answers || {};
      for (let i = 0; i < qs.length; i++) {
        const q = qs[i];
        const userAns = ans[String(i)] ?? ans[i] ?? "";
        const correct = (q.correct || "").toUpperCase();
        const correctOpt = (q.options || []).find(
          (o) => o && o[0].toUpperCase() === correct
        );
        if (!correctOpt) continue;
        const algo = correctOpt.slice(3).split(" — ")[0].trim();
        if (!counts[algo]) counts[algo] = { correct: 0, total: 0 };
        counts[algo].total++;
        if (String(userAns).toUpperCase().trim() === correct.trim()) {
          counts[algo].correct++;
        }
      }
    }
    return Object.entries(counts)
      .map(([algo, { correct, total }]) => ({
        algo,
        correct,
        total,
        pct: Math.round((correct / total) * 100),
      }))
      .sort((a, b) => a.pct - b.pct);
  }, [algoQuizzes]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <OverviewStat
            label="Study Sessions"
            value={stats.total_sessions}
            icon={"\u{1F4D6}"}
            color="text-focus-teal"
          />
          <OverviewStat
            label="Quiz Avg"
            value={algoAvg !== null ? `${algoAvg}%` : "--"}
            icon={"\u{1F9E9}"}
            color="text-focus-amber"
          />
          <OverviewStat
            label="Math Drills"
            value={mlMathQuizzes.length}
            icon={"\u{1F4D0}"}
            color="text-focus-text-muted"
          />
          <OverviewStat
            label="Reviews Due"
            value={reviewsDue.length}
            icon={"\u{1F504}"}
            color={reviewsDue.length > 0 ? "text-focus-amber" : "text-focus-teal"}
          />
        </div>
      )}

      {/* 4 Section Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Study Section */}
        <SectionCard
          title="Study Progress"
          icon={"\u{1F4D6}"}
          accentColor="focus-teal"
          linkTo="/"
          linkLabel="Start studying"
        >
          {skills.length === 0 ? (
            <EmptyState text="No concepts studied yet" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-focus-text-muted">
                <span>{skills.length} concepts tracked</span>
                <span>
                  {skills.filter((s) => s.score >= 80).length} mastered
                </span>
              </div>
              {skills.slice(0, 5).map((skill) => {
                const review = reviewsDue.find((r) => r.concept_id === skill.concept_id);
                const reviewLabel = getReviewLabel(review);
                return (
                <div key={skill.concept_id} className="group flex items-center gap-2">
                  <button
                    onClick={() => setSelectedConcept(skill)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-focus-text group-hover:text-focus-teal transition-colors truncate mr-2">
                        {cleanTopicName(skill.concept_name)}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {reviewLabel && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${reviewLabel.className}`}>
                            {reviewLabel.text}
                          </span>
                        )}
                        <span className="text-xs font-mono font-bold text-focus-text-muted">
                          {Math.round(skill.score)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-focus-border rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          skill.score >= 80
                            ? "bg-focus-teal"
                            : skill.score >= 50
                            ? "bg-focus-amber"
                            : "bg-red-400"
                        }`}
                        style={{ width: `${skill.score}%` }}
                      />
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${skill.concept_name}" and all its data?`)) {
                        deleteConcept(skill.concept_id);
                      }
                    }}
                    disabled={deletingConcepts.has(skill.concept_id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all p-1 shrink-0 disabled:opacity-50"
                    title="Delete concept"
                  >
                    {deletingConcepts.has(skill.concept_id) ? (
                      <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      </svg>
                    )}
                  </button>
                </div>
                );
              })}
              {skills.length > 5 && (
                <p className="text-xs text-focus-text-dim text-center">
                  +{skills.length - 5} more concepts
                </p>
              )}
              {/* Top gaps */}
              {topGaps.length > 0 && (
                <div className="pt-2 border-t border-focus-border">
                  <p className="text-xs text-focus-text-dim mb-1">
                    Top gaps to address
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {topGaps.map((gap, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 bg-red-900/20 text-red-300 rounded"
                      >
                        {gap}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Merge similar topics */}
              {skills.length > 1 && (
                <div className="pt-2 border-t border-focus-border flex justify-end">
                  <button
                    onClick={mergeSimilarConcepts}
                    disabled={mergingConcepts}
                    className="flex items-center gap-1.5 text-xs text-focus-text-dim hover:text-focus-teal transition-colors disabled:opacity-50"
                    title="Merge semantically similar topics into one"
                  >
                    {mergingConcepts ? (
                      <>
                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Merging&hellip;
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 6H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/><path d="M16 6h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3"/><line x1="12" y1="3" x2="12" y2="21"/><polyline points="9 6 12 3 15 6"/><polyline points="9 18 12 21 15 18"/>
                        </svg>
                        Merge similar topics
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* Algo Quiz Section */}
        <SectionCard
          title="Algorithm Quizzes"
          icon={"\u{1F9E9}"}
          accentColor="focus-amber"
          linkTo="/algorithm-quiz"
          linkLabel="Take a quiz"
        >
          {algoQuizzes.length === 0 ? (
            <EmptyState text="No quizzes taken yet" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-focus-text-muted">
                <span>{algoQuizzes.length} quizzes completed</span>
                <div className="flex items-center gap-3">
                  {algoAvg !== null && <span>Avg: {algoAvg}%</span>}
                  <button
                    onClick={() => {
                      if (confirm("Reset all algorithm quiz history? This cannot be undone.")) {
                        resetQuizHistory();
                      }
                    }}
                    disabled={resettingHistory}
                    className="flex items-center gap-1 text-focus-text-dim hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Reset quiz history"
                  >
                    {resettingHistory ? (
                      <>
                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Resetting…</span>
                      </>
                    ) : "Reset"}
                  </button>
                </div>
              </div>
              {/* Per-algorithm mastery bars */}
              {algoMastery.length > 0 ? (
                <div className="space-y-1.5">
                  {algoMastery.slice(0, 6).map(({ algo, correct, total, pct }) => (
                    <div key={algo}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="text-focus-text-muted truncate max-w-[140px]" title={algo}>{algo}</span>
                        <span className={`font-mono tabular-nums shrink-0 ml-1 ${pct >= 70 ? "text-focus-teal" : pct >= 40 ? "text-focus-amber" : "text-red-400"}`}>
                          {correct}/{total}
                        </span>
                      </div>
                      <div className="w-full bg-focus-border rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${pct >= 70 ? "bg-focus-teal" : pct >= 40 ? "bg-focus-amber" : "bg-red-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {algoMastery.length > 6 && (
                    <p className="text-xs text-focus-text-dim text-center">
                      +{algoMastery.length - 6} more algorithms
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-focus-text-dim">Complete algorithm quizzes to see per-skill breakdown</p>
              )}
            </div>
          )}
        </SectionCard>


      </div>

      {/* Recent Activity Feed */}
      <div className="bg-focus-surface border border-focus-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-focus-text mb-4">
          Recent Activity
        </h3>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-focus-text-dim">No activity yet</p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} onDelete={deleteQuizEntry} isDeleting={deletingEntries.has(entry.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Concept detail modal */}
      {selectedConcept && (
        <ConceptDetail
          conceptId={selectedConcept.concept_id}
          conceptName={selectedConcept.concept_name}
          score={selectedConcept.score}
          onClose={() => setSelectedConcept(null)}
        />
      )}
    </div>
  );
}

/* ─── Helper Components ──────────────────────────────── */

function OverviewStat({ label, value, icon, color }) {
  return (
    <div className="bg-focus-surface border border-focus-border rounded-xl p-4 text-center">
      <div className="text-lg mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-focus-text-dim mt-1">{label}</div>
    </div>
  );
}

function SectionCard({ title, icon, accentColor, linkTo, linkLabel, children }) {
  return (
    <div className="bg-focus-surface border border-focus-border rounded-xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-focus-text flex items-center gap-2">
          <span>{icon}</span>
          {title}
        </h3>
        <Link
          to={linkTo}
          className={`text-xs text-focus-text-dim hover:text-${accentColor} transition-colors`}
        >
          {linkLabel} &rarr;
        </Link>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-6">
      <p className="text-sm text-focus-text-dim">{text}</p>
    </div>
  );
}

function MiniGauge({ label, value, color, bgColor }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${color}`}>
        {value !== null ? `${value}%` : "--"}
      </div>
      <div className="w-full bg-focus-border rounded-full h-1 mt-1">
        <div
          className={`h-1 rounded-full transition-all ${bgColor}`}
          style={{ width: `${value || 0}%` }}
        />
      </div>
      <div className="text-xs text-focus-text-dim mt-1">{label}</div>
    </div>
  );
}


function ActivityRow({ entry, onDelete, isDeleting }) {
  const type = ACTIVITY_TYPE[entry.quiz_type] || {
    label: entry.quiz_type,
    color: "bg-focus-border text-focus-text-dim",
  };
  const score = entry.score;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-focus-border/50 last:border-0 group">
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${type.color}`}
        >
          {type.label}
        </span>
        {entry.topic && entry.topic !== "all" && (
          <span className="text-xs text-focus-text-dim">{entry.topic}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {score !== null && (
          <span
            className={`text-xs font-bold ${
              score >= 80
                ? "text-focus-teal"
                : score >= 50
                ? "text-focus-amber"
                : "text-red-400"
            }`}
          >
            {Math.round(score)}%
          </span>
        )}
        <span className="text-[10px] text-focus-text-dim">
          {entry.created_at
            ? new Date(entry.created_at).toLocaleDateString()
            : "---"}
        </span>
        {onDelete && (
          <button
            onClick={() => onDelete(entry.id)}
            disabled={isDeleting}
            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all p-0.5 disabled:opacity-50"
            title="Delete entry"
          >
            {isDeleting ? (
              <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Skeleton Loader ──────────────────────────────── */

function SkeletonBlock({ className = "" }) {
  return <div className={`bg-gray-700/50 rounded skeleton-pulse ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Overview stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-focus-surface border border-focus-border rounded-xl p-4 text-center">
            <SkeletonBlock className="w-8 h-8 mx-auto mb-2 rounded-full" />
            <SkeletonBlock className="w-12 h-7 mx-auto mb-1" />
            <SkeletonBlock className="w-20 h-3 mx-auto" />
          </div>
        ))}
      </div>
      {/* Section cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-focus-surface border border-focus-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <SkeletonBlock className="w-32 h-4" />
              <SkeletonBlock className="w-16 h-3" />
            </div>
            <div className="space-y-3">
              <SkeletonBlock className="w-full h-3" />
              <SkeletonBlock className="w-3/4 h-3" />
              <SkeletonBlock className="w-full h-2" />
              <SkeletonBlock className="w-5/6 h-3" />
              <SkeletonBlock className="w-full h-2" />
            </div>
          </div>
        ))}
      </div>
      {/* Activity skeleton */}
      <div className="bg-focus-surface border border-focus-border rounded-xl p-5">
        <SkeletonBlock className="w-28 h-4 mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <SkeletonBlock className="w-24 h-4" />
              <SkeletonBlock className="w-16 h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Data Helpers ──────────────────────────────────── */
// deriveMlMathStats is now imported from ../utils/statsHelpers

function getReviewLabel(review) {
  if (!review) return null;
  if (review.status === "due" || review.status === "new") {
    return { text: "Due now", className: "bg-focus-amber/20 text-focus-amber" };
  }
  if (review.next_review) {
    const days = Math.ceil(
      (new Date(review.next_review) - new Date()) / (1000 * 60 * 60 * 24)
    );
    if (days <= 1) return { text: "Due today", className: "bg-focus-amber/20 text-focus-amber" };
    return { text: `In ${days}d`, className: "bg-focus-border/80 text-focus-text-dim" };
  }
  return null;
}

function cleanTopicName(name) {
  if (!name) return name;
  return name
    .replace(/^(explain\s+(to\s+me\s+)?|tell\s+me\s+(about\s+)?|what\s+(is|are)\s+|how\s+do(es)?\s+|describe\s+|walk\s+me\s+through\s+|give\s+me\s+(a\s+)?(brief\s+)?overview\s+of\s+)/i, "")
    .replace(/\s+(work|works)(\?)?$/i, "")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}
