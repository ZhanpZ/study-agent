import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useToast } from "../components/Toast";
import ConceptDetail from "../components/ConceptDetail";
import fetchWithTimeout from "../utils/fetchWithTimeout";

export default function Dashboard() {
  const [skills, setSkills] = useState([]);
  const [stats, setStats] = useState(null);
  const [reviewsDue, setReviewsDue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const { addToast } = useToast();

  const deleteConcept = async (conceptId) => {
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
    }
  };

  useEffect(() => {
    Promise.allSettled([
      fetchWithTimeout("/api/dashboard/skills").then((r) => r.json()),
      fetchWithTimeout("/api/dashboard/stats").then((r) => r.json()),
      fetchWithTimeout("/api/reviews/due").then((r) => r.json()),
    ])
      .then(([skillsRes, statsRes, reviewRes]) => {
        if (skillsRes.status === "fulfilled") setSkills(skillsRes.value);
        if (statsRes.status === "fulfilled") setStats(statsRes.value);
        if (reviewRes.status === "fulfilled") setReviewsDue(reviewRes.value);

        const failures = [skillsRes, statsRes, reviewRes].filter(
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

  // Top knowledge gaps across all skills
  const topGaps = useMemo(() => {
    const allGaps = skills.flatMap((s) => s.misconceptions || []);
    return [...new Set(allGaps)].slice(0, 3);
  }, [skills]);

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
            label="Concepts"
            value={stats.total_concepts}
            icon={"\u{1F9E0}"}
            color="text-focus-amber"
          />
          <OverviewStat
            label="Mastered"
            value={stats.concepts_mastered}
            icon={"\u{2705}"}
            color="text-focus-teal"
          />
          <OverviewStat
            label="Reviews Due"
            value={reviewsDue.length}
            icon={"\u{1F504}"}
            color={reviewsDue.length > 0 ? "text-focus-amber" : "text-focus-teal"}
          />
        </div>
      )}

      {/* 2 Section Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Study Progress */}
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
            </div>
          )}
        </SectionCard>

        {/* Spaced Review */}
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

/* ─── Skeleton Loader ──────────────────────────────── */

function SkeletonBlock({ className = "" }) {
  return <div className={`bg-gray-700/50 rounded skeleton-pulse ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-focus-surface border border-focus-border rounded-xl p-4 text-center">
            <SkeletonBlock className="w-8 h-8 mx-auto mb-2 rounded-full" />
            <SkeletonBlock className="w-12 h-7 mx-auto mb-1" />
            <SkeletonBlock className="w-20 h-3 mx-auto" />
          </div>
        ))}
      </div>
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
