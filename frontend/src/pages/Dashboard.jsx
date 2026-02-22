import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ConceptDetail from "../components/ConceptDetail";

const QUIZ_TYPE_LABEL = {
  algorithm: "Algo Selection",
  constraint: "Constraint Match",
  ml_math: "ML Math",
};
const QUIZ_TYPE_COLOR = {
  algorithm: "bg-amber-900/40 text-amber-400",
  constraint: "bg-blue-900/40 text-blue-400",
  ml_math: "bg-violet-900/40 text-violet-400",
};

export default function Dashboard() {
  const [skills, setSkills] = useState([]);
  const [stats, setStats] = useState(null);
  const [quizHistory, setQuizHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [expandedQuiz, setExpandedQuiz] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/skills").then((r) => r.json()),
      fetch("/api/dashboard/stats").then((r) => r.json()),
      fetch("/api/quiz-history?limit=20").then((r) => r.json()),
    ])
      .then(([skillsData, statsData, quizData]) => {
        setSkills(skillsData);
        setStats(statsData);
        setQuizHistory(quizData);
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

      {/* Quiz History */}
      <h2 className="text-xl font-bold text-white mb-4 mt-10">Quiz History</h2>
      {quizHistory.length === 0 ? (
        <p className="text-gray-400">
          No quizzes taken yet. Try the Algo Quiz or ML Math pages!
        </p>
      ) : (
        <div className="space-y-3">
          {quizHistory.map((entry) => (
            <div key={entry.id}>
              <button
                onClick={() => setExpandedQuiz(expandedQuiz === entry.id ? null : entry.id)}
                className={`w-full text-left bg-gray-800/60 border rounded-lg p-3 transition-colors ${
                  expandedQuiz === entry.id
                    ? "border-indigo-500"
                    : "border-gray-700 hover:border-gray-500"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      QUIZ_TYPE_COLOR[entry.quiz_type] || "bg-gray-700 text-gray-400"
                    }`}>
                      {QUIZ_TYPE_LABEL[entry.quiz_type] || entry.quiz_type}
                    </span>
                    {entry.topic !== "all" && (
                      <span className="text-xs text-gray-500">{entry.topic}</span>
                    )}
                    {entry.score !== null && (
                      <span className={`text-xs font-bold ${
                        entry.score >= 80 ? "text-green-400"
                          : entry.score >= 50 ? "text-yellow-400"
                          : "text-red-400"
                      }`}>
                        {Math.round(entry.score)}%
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {entry.created_at ? new Date(entry.created_at).toLocaleDateString() : "---"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {entry.questions?.length || 0} question{(entry.questions?.length || 0) !== 1 ? "s" : ""}
                  {" · "}
                  {expandedQuiz === entry.id ? "Click to collapse" : "Click to review"}
                </p>
              </button>

              {/* Expanded quiz questions */}
              {expandedQuiz === entry.id && (
                <div className="mt-2 bg-gray-800/40 border border-gray-700 rounded-lg p-4 space-y-4">
                  {entry.quiz_type === "ml_math" ? (
                    <MLMathReview entry={entry} />
                  ) : entry.quiz_type === "constraint" ? (
                    <ConstraintReview entry={entry} />
                  ) : (
                    <AlgorithmReview entry={entry} />
                  )}
                </div>
              )}
            </div>
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

/* ─── Quiz Review Components ─────────────────────────── */

function AlgorithmReview({ entry }) {
  return entry.questions.map((q, i) => {
    const userAnswer = entry.answers?.[i];
    const isCorrect = userAnswer === q.correct;
    return (
      <div key={i} className="text-sm space-y-1">
        <p className="text-white font-medium">{i + 1}. {q.problem}</p>
        {q.constraints && <p className="text-xs text-gray-500">Constraints: {q.constraints}</p>}
        <div className="flex gap-2 text-xs">
          <span className={isCorrect ? "text-green-400" : "text-red-400"}>
            Your answer: {userAnswer || "—"}
          </span>
          {!isCorrect && <span className="text-gray-400">Correct: {q.correct}</span>}
        </div>
        {q.explanation && <p className="text-xs text-gray-500">{q.explanation}</p>}
      </div>
    );
  });
}

function ConstraintReview({ entry }) {
  return entry.questions.map((q, i) => {
    const userPicks = entry.answers?.[i] || [];
    const correctSet = new Set(q.correct);
    return (
      <div key={i} className="text-sm space-y-1">
        <div className="flex flex-wrap gap-1.5 mb-1">
          {q.keywords?.map((kw, j) => (
            <span key={j} className="px-2 py-0.5 bg-amber-600/20 border border-amber-600/40 rounded text-xs text-amber-300">
              {kw}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-400 font-mono">{q.constraints}</p>
        <div className="text-xs space-y-0.5 mt-1">
          {q.options.map((opt, j) => {
            const letter = opt.charAt(0);
            const picked = userPicks.includes(letter);
            const correct = correctSet.has(letter);
            return (
              <div key={j} className={
                correct && picked ? "text-green-400"
                  : correct && !picked ? "text-yellow-400"
                  : !correct && picked ? "text-red-400"
                  : "text-gray-600"
              }>
                {picked ? "✓" : "·"} {opt} {correct ? "(correct)" : ""}
              </div>
            );
          })}
        </div>
      </div>
    );
  });
}

function MLMathReview({ entry }) {
  const q = entry.questions?.[0];
  if (!q) return <p className="text-sm text-gray-500">No data.</p>;
  const userMath = entry.answers?.math;
  const userProof = entry.answers?.proof;
  return (
    <div className="space-y-3 text-sm">
      {q.math_question && (
        <div>
          <p className="text-violet-400 text-xs font-semibold uppercase mb-1">Math</p>
          <p className="text-white">{q.math_question.question}</p>
          <div className="flex gap-2 text-xs mt-1">
            <span className={userMath === q.math_question.correct ? "text-green-400" : "text-red-400"}>
              Your answer: {userMath || "—"}
            </span>
            {userMath !== q.math_question.correct && (
              <span className="text-gray-400">Correct: {q.math_question.correct}</span>
            )}
          </div>
          {q.math_question.solution && (
            <p className="text-xs text-gray-500 mt-1">{q.math_question.solution}</p>
          )}
        </div>
      )}
      {q.proof_question && (
        <div>
          <p className="text-blue-400 text-xs font-semibold uppercase mb-1">Proof</p>
          <p className="text-white">{q.proof_question.question}</p>
          <div className="flex gap-2 text-xs mt-1">
            <span className={userProof === q.proof_question.correct ? "text-green-400" : "text-red-400"}>
              Your answer: {userProof || "—"}
            </span>
            {userProof !== q.proof_question.correct && (
              <span className="text-gray-400">Correct: {q.proof_question.correct}</span>
            )}
          </div>
          {q.proof_question.explanation && (
            <p className="text-xs text-gray-500 mt-1">{q.proof_question.explanation}</p>
          )}
        </div>
      )}
      {q.ml_application && (
        <div>
          <p className="text-emerald-400 text-xs font-semibold uppercase mb-1">ML Application</p>
          <p className="text-white font-medium">{q.ml_application.algorithm}</p>
          <p className="text-xs text-gray-400">{q.ml_application.explanation}</p>
        </div>
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
