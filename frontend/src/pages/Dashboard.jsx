import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useToast } from "../components/Toast";
import ConceptDetail from "../components/ConceptDetail";
import { ACTIVITY_TYPE } from "../constants/modeConfig";

export default function Dashboard() {
  const [skills, setSkills] = useState([]);
  const [stats, setStats] = useState(null);
  const [quizHistory, setQuizHistory] = useState([]);
  const [reviewsDue, setReviewsDue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const { addToast } = useToast();

  const deleteQuizEntry = async (entryId) => {
    try {
      const res = await fetch(`/api/quiz-history/${entryId}`, { method: "DELETE" });
      if (res.ok) {
        setQuizHistory((prev) => prev.filter((e) => e.id !== entryId));
        addToast("Entry deleted", "success", 2000);
      } else {
        addToast("Failed to delete entry", "error");
      }
    } catch {
      addToast("Failed to delete entry. Check your connection.", "error");
    }
  };

  const deleteConcept = async (conceptId) => {
    try {
      const res = await fetch(`/api/concepts/${conceptId}`, { method: "DELETE" });
      if (res.ok) {
        setSkills((prev) => prev.filter((s) => s.concept_id !== conceptId));
        addToast("Concept deleted", "success", 2000);
      } else {
        addToast("Failed to delete concept", "error");
      }
    } catch {
      addToast("Failed to delete concept. Check your connection.", "error");
    }
  };

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/dashboard/skills").then((r) => r.json()),
      fetch("/api/dashboard/stats").then((r) => r.json()),
      fetch("/api/quiz-history?limit=500").then((r) => r.json()),
      fetch("/api/reviews/due").then((r) => r.json()),
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

  if (loading) {
    return <DashboardSkeleton />;
  }

  // Derive section-specific data (memoized to avoid recalc on every render)
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
            color="text-violet-400"
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
              {skills.slice(0, 5).map((skill) => (
                <div key={skill.concept_id} className="group flex items-center gap-2">
                  <button
                    onClick={() => setSelectedConcept(skill)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-focus-text group-hover:text-focus-teal transition-colors truncate mr-2">
                        {skill.concept_name}
                      </span>
                      <span className="text-xs font-mono font-bold text-focus-text-muted">
                        {Math.round(skill.score)}
                      </span>
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
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all p-1 shrink-0"
                    title="Delete concept"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              ))}
              {skills.length > 5 && (
                <p className="text-xs text-focus-text-dim text-center">
                  +{skills.length - 5} more concepts
                </p>
              )}
              {/* Top gaps */}
              {(() => {
                const allGaps = skills.flatMap((s) => s.misconceptions || []);
                const uniqueGaps = [...new Set(allGaps)].slice(0, 3);
                return uniqueGaps.length > 0 ? (
                  <div className="pt-2 border-t border-focus-border">
                    <p className="text-xs text-focus-text-dim mb-1">
                      Top gaps to address
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {uniqueGaps.map((gap, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 bg-red-900/20 text-red-300 rounded"
                        >
                          {gap}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
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
                {algoAvg !== null && <span>Avg: {algoAvg}%</span>}
              </div>
              {/* Mini score bars for last 5 */}
              <div className="flex items-end gap-1 h-16">
                {algoQuizzes.slice(0, 8).reverse().map((q, i) => {
                  const score = q.score || 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center gap-0.5"
                    >
                      <div
                        className={`w-full rounded-t transition-all ${
                          score >= 80
                            ? "bg-focus-teal"
                            : score >= 50
                            ? "bg-focus-amber"
                            : "bg-red-400"
                        }`}
                        style={{ height: `${Math.max(score * 0.6, 4)}px` }}
                      />
                      <span className="text-[9px] text-focus-text-dim">
                        {Math.round(score)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Topic breakdown */}
              {(() => {
                const topics = {};
                algoQuizzes.forEach((q) => {
                  const t = q.topic || "all";
                  topics[t] = (topics[t] || 0) + 1;
                });
                const sorted = Object.entries(topics)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4);
                return (
                  <div className="pt-2 border-t border-focus-border">
                    <p className="text-xs text-focus-text-dim mb-1">
                      Topics practiced
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {sorted.map(([topic, count]) => (
                        <span
                          key={topic}
                          className="text-xs px-2 py-0.5 bg-focus-amber-dim/30 text-focus-amber-light rounded"
                        >
                          {topic} ({count})
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </SectionCard>


        {/* Review Section */}
        <SectionCard
          title="Spaced Review"
          icon={"\u{1F504}"}
          accentColor="focus-teal"
          linkTo="/review"
          linkLabel="Review now"
        >
          {reviewsDue.length === 0 && skills.length === 0 ? (
            <EmptyState text="Study some concepts first" />
          ) : reviewsDue.length === 0 ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">{"\u{2705}"}</div>
              <p className="text-sm text-focus-teal">All caught up!</p>
              <p className="text-xs text-focus-text-dim mt-1">
                No reviews due right now
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-focus-amber">
                  {reviewsDue.length}
                </span>
                <span className="text-xs text-focus-text-muted">due today</span>
              </div>
              {reviewsDue.slice(0, 4).map((r) => (
                <div
                  key={r.concept_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-focus-text truncate mr-2">
                    {r.concept_name}
                  </span>
                  <span className="text-xs text-focus-text-dim whitespace-nowrap">
                    Rep #{r.repetitions} &middot;{" "}
                    {Math.round(r.interval_days)}d interval
                  </span>
                </div>
              ))}
              {reviewsDue.length > 4 && (
                <p className="text-xs text-focus-text-dim text-center">
                  +{reviewsDue.length - 4} more due
                </p>
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
              <ActivityRow key={entry.id} entry={entry} onDelete={deleteQuizEntry} />
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


function ActivityRow({ entry, onDelete }) {
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
            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all p-0.5"
            title="Delete entry"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
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
        {[...Array(4)].map((_, i) => (
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
