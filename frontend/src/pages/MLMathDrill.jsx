import { useState } from "react";

const TOPICS = [
  { value: "all", label: "All Topics" },
  { value: "linear algebra", label: "Linear Algebra" },
  { value: "probability and statistics", label: "Probability & Stats" },
  { value: "calculus and derivatives", label: "Calculus" },
  { value: "optimization", label: "Optimization" },
  { value: "information theory", label: "Information Theory" },
];

const STEPS = [
  { key: "math", label: "Math", color: "bg-violet-500" },
  { key: "proof", label: "Proof", color: "bg-blue-500" },
  { key: "application", label: "ML Application", color: "bg-emerald-500" },
];

export default function MLMathDrill() {
  const [topic, setTopic] = useState("all");
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("math"); // math → proof → application
  const [mathAnswer, setMathAnswer] = useState(null);
  const [mathRevealed, setMathRevealed] = useState(false);
  const [proofAnswer, setProofAnswer] = useState(null);
  const [proofRevealed, setProofRevealed] = useState(false);
  const [stats, setStats] = useState({ total: 0, mathCorrect: 0, proofCorrect: 0 });

  const fetchQuestion = async () => {
    setLoading(true);
    setQuestion(null);
    setStep("math");
    setMathAnswer(null);
    setMathRevealed(false);
    setProofAnswer(null);
    setProofRevealed(false);
    try {
      const res = await fetch(`/api/ml-math?topic=${encodeURIComponent(topic)}`);
      const data = await res.json();
      if (data.question && data.question.math_question) {
        setQuestion(data.question);
      }
    } catch (err) {
      console.error("Failed to generate question:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMathCheck = () => {
    setMathRevealed(true);
  };

  const handleProofCheck = () => {
    setProofRevealed(true);
  };

  const goToProof = () => {
    setStep("proof");
  };

  const goToApplication = () => {
    const mathOk = mathAnswer === question.math_question.correct;
    const proofOk = proofAnswer === question.proof_question.correct;
    // Update stats when finishing proof step
    setStats((prev) => ({
      total: prev.total + 1,
      mathCorrect: prev.mathCorrect + (mathOk ? 1 : 0),
      proofCorrect: prev.proofCorrect + (proofOk ? 1 : 0),
    }));
    setStep("application");
    // Save to quiz history
    fetch("/api/quiz-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quiz_type: "ml_math",
        topic: question.topic || topic,
        questions: [question],
        answers: { math: mathAnswer, proof: proofAnswer },
        score: (mathOk && proofOk) ? 100 : (mathOk || proofOk) ? 50 : 0,
      }),
    }).catch(() => {});
  };

  const stepIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">ML Math Drill</h2>
      <p className="text-gray-400 mb-6 text-sm">
        Math → Proof → ML Application. Infinite drill loop.
      </p>

      {/* Topic selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TOPICS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTopic(t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              topic === t.value
                ? "bg-violet-600 border-violet-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      {stats.total > 0 && (
        <div className="mb-6 p-3 bg-gray-800/60 rounded-lg border border-gray-700 flex gap-6 text-sm">
          <span className="text-gray-400">
            Questions: <span className="text-white font-bold">{stats.total}</span>
          </span>
          <span className="text-gray-400">
            Math: <span className="text-violet-400 font-bold">
              {stats.mathCorrect}/{stats.total} ({Math.round((stats.mathCorrect / stats.total) * 100)}%)
            </span>
          </span>
          <span className="text-gray-400">
            Proof: <span className="text-blue-400 font-bold">
              {stats.proofCorrect}/{stats.total} ({Math.round((stats.proofCorrect / stats.total) * 100)}%)
            </span>
          </span>
        </div>
      )}

      {/* Generate / Next button */}
      {(!question || step === "application") && (
        <button
          onClick={fetchQuestion}
          disabled={loading}
          className="px-6 py-3 bg-violet-600 text-white font-medium rounded-lg
                     hover:bg-violet-500 disabled:opacity-50 transition-colors mb-8"
        >
          {loading ? "Generating..." : question ? "Next Question" : "Start Drill"}
        </button>
      )}

      {question && (
        <>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {STEPS.map((s, idx) => (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    idx === stepIdx
                      ? `${s.color} text-white`
                      : idx < stepIdx
                      ? "bg-gray-700 text-gray-300"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {idx < stepIdx && <span>&#10003;</span>}
                  {s.label}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 ${idx < stepIdx ? "bg-gray-600" : "bg-gray-800"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Topic badge */}
          {question.topic && (
            <span className="inline-block px-2 py-0.5 mb-4 bg-violet-600/20 border border-violet-600/40 rounded text-xs text-violet-300 font-medium">
              {question.topic}
            </span>
          )}

          {/* STEP 1: Math Question */}
          {step === "math" && question.math_question && (
            <MathStep
              q={question.math_question}
              answer={mathAnswer}
              revealed={mathRevealed}
              onSelect={setMathAnswer}
              onCheck={handleMathCheck}
              onNext={goToProof}
            />
          )}

          {/* STEP 2: Proof Insertion */}
          {step === "proof" && question.proof_question && (
            <ProofStep
              q={question.proof_question}
              answer={proofAnswer}
              revealed={proofRevealed}
              onSelect={setProofAnswer}
              onCheck={handleProofCheck}
              onNext={goToApplication}
            />
          )}

          {/* STEP 3: ML Application */}
          {step === "application" && question.ml_application && (
            <ApplicationStep app={question.ml_application} />
          )}
        </>
      )}
    </div>
  );
}

/* ─── Math Step ──────────────────────────────────────── */

function MathStep({ q, answer, revealed, onSelect, onCheck, onNext }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5 space-y-4">
      <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wide">Math Problem</h3>
      <p className="text-sm text-white whitespace-pre-wrap">{q.question}</p>

      <MCOptions
        options={q.options}
        correct={q.correct}
        answer={answer}
        revealed={revealed}
        onSelect={(letter) => !revealed && onSelect(letter)}
      />

      {answer && !revealed && (
        <button
          onClick={onCheck}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-500 transition-colors"
        >
          Check Answer
        </button>
      )}

      {revealed && (
        <>
          <div className={`text-sm p-3 rounded-lg ${
            answer === q.correct
              ? "bg-green-900/20 text-green-400 border border-green-700/50"
              : "bg-red-900/20 text-red-400 border border-red-700/50"
          }`}>
            <span className="font-medium">{answer === q.correct ? "Correct!" : "Incorrect."}</span>
            {q.solution && <p className="mt-2 whitespace-pre-wrap">{q.solution}</p>}
          </div>
          <button
            onClick={onNext}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 transition-colors"
          >
            Continue to Proof →
          </button>
        </>
      )}
    </div>
  );
}

/* ─── Proof Step ─────────────────────────────────────── */

function ProofStep({ q, answer, revealed, onSelect, onCheck, onNext }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5 space-y-4">
      <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">Proof Insertion</h3>
      <p className="text-sm text-white">{q.question}</p>

      {/* Proof context with missing step */}
      {q.context && (
        <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">
          {q.context}
        </div>
      )}

      <MCOptions
        options={q.options}
        correct={q.correct}
        answer={answer}
        revealed={revealed}
        onSelect={(letter) => !revealed && onSelect(letter)}
      />

      {answer && !revealed && (
        <button
          onClick={onCheck}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-500 transition-colors"
        >
          Check Answer
        </button>
      )}

      {revealed && (
        <>
          <div className={`text-sm p-3 rounded-lg ${
            answer === q.correct
              ? "bg-green-900/20 text-green-400 border border-green-700/50"
              : "bg-red-900/20 text-red-400 border border-red-700/50"
          }`}>
            <span className="font-medium">{answer === q.correct ? "Correct!" : "Incorrect."}</span>
            {q.explanation && <p className="mt-2 whitespace-pre-wrap">{q.explanation}</p>}
          </div>
          <button
            onClick={onNext}
            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-500 transition-colors"
          >
            See ML Application →
          </button>
        </>
      )}
    </div>
  );
}

/* ─── Application Step ───────────────────────────────── */

function ApplicationStep({ app }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5 space-y-4">
      <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">ML Application</h3>

      <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4 space-y-3">
        <div>
          <span className="text-xs text-gray-400 uppercase">Algorithm</span>
          <p className="text-lg font-semibold text-white">{app.algorithm}</p>
        </div>

        <div>
          <span className="text-xs text-gray-400 uppercase">How this math is used</span>
          <p className="text-sm text-gray-200 whitespace-pre-wrap">{app.explanation}</p>
        </div>

        {app.related_algorithms && app.related_algorithms.length > 0 && (
          <div>
            <span className="text-xs text-gray-400 uppercase">Also used in</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {app.related_algorithms.map((algo, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300"
                >
                  {algo}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 italic">Click "Next Question" above to continue drilling.</p>
    </div>
  );
}

/* ─── Shared MC Options ──────────────────────────────── */

function MCOptions({ options, correct, answer, revealed, onSelect }) {
  return (
    <div className="space-y-2">
      {options.map((option, idx) => {
        const letter = option.charAt(0);
        const isSelected = answer === letter;
        const isCorrect = correct === letter;

        let cls = "bg-gray-900/40 border-gray-700 text-gray-300 hover:border-gray-500 cursor-pointer";
        if (revealed) {
          if (isCorrect) cls = "bg-green-900/30 border-green-600 text-green-300";
          else if (isSelected) cls = "bg-red-900/30 border-red-600 text-red-300";
          else cls = "bg-gray-900/40 border-gray-700 text-gray-500";
        } else if (isSelected) {
          cls = "bg-indigo-600/30 border-indigo-500 text-white";
        }

        return (
          <button
            key={idx}
            onClick={() => onSelect(letter)}
            disabled={revealed}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border disabled:cursor-default ${cls}`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
