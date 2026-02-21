import { useState, useEffect } from "react";
import ConceptDetail from "../components/ConceptDetail";

export default function Dashboard() {
  const [skills, setSkills] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedConcept, setSelectedConcept] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/skills").then((r) => r.json()),
      fetch("/api/dashboard/stats").then((r) => r.json()),
    ])
      .then(([skillsData, statsData]) => {
        setSkills(skillsData);
        setStats(statsData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center text-gray-400 mt-20">Loading dashboard...</div>;
  }

  return (
    <div>
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Sessions" value={stats.total_sessions} />
          <StatCard label="Concepts" value={stats.total_concepts} />
          <StatCard label="Mastered" value={stats.concepts_mastered} />
          <StatCard label="Avg Score" value={`${stats.avg_score}%`} />
        </div>
      )}

      {/* Skills list */}
      <h2 className="text-xl font-bold text-white mb-4">Concept Skills</h2>
      {skills.length === 0 ? (
        <p className="text-gray-400">
          No concepts studied yet. Start a session on the Study page!
        </p>
      ) : (
        <div className="space-y-3">
          {skills.map((skill) => (
            <button
              key={skill.concept_id}
              onClick={() => setSelectedConcept(skill)}
              className="w-full text-left bg-gray-800/60 border border-gray-700 rounded-lg p-4
                         hover:border-gray-500 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-medium">{skill.concept_name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Click for notes</span>
                  <span className="text-sm font-bold text-white">
                    {Math.round(skill.score)}/100
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    skill.score >= 80
                      ? "bg-green-500"
                      : skill.score >= 50
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${skill.score}%` }}
                />
              </div>
              {skill.misconceptions.length > 0 && (
                <div className="text-xs text-gray-400">
                  Gaps: {skill.misconceptions.slice(0, 3).join(", ")}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

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

function StatCard({ label, value }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}
