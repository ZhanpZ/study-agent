import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "../components/Toast";

function ReportButton({ quizType, questionData, addToast }) {
  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState("");
  const [sending, setSending] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const submit = async () => {
    if (!issue.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/quiz-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_type: quizType,
          question_data: questionData,
          reported_issue: issue.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      addToast("Report submitted. Thanks!", "success");
      setOpen(false);
      setIssue("");
    } catch {
      addToast("Failed to submit report.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        title="Report incorrect question"
        className="text-gray-500 hover:text-red-400 transition-colors p-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl">
          <p className="text-xs text-gray-400 mb-2">What's wrong with this question?</p>
          <textarea
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="e.g. Wrong answer, bad computation..."
            className="w-full bg-gray-900 text-sm text-gray-200 border border-gray-700 rounded p-2 resize-none h-16 focus:outline-none focus:border-red-500"
            maxLength={500}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-white">Cancel</button>
            <button
              onClick={submit}
              disabled={!issue.trim() || sending}
              className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-50"
            >
              {sending ? "Sending..." : "Report"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function usePersistedState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = sessionStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  const setAndPersist = useCallback((updater) => {
    setValue((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      sessionStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);
  return [value, setAndPersist];
}
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";

const TOPICS = [
  { value: "all", label: "All Topics" },
  { value: "linear algebra", label: "Linear Algebra" },
  { value: "probability and statistics", label: "Probability & Stats" },
  { value: "calculus and derivatives", label: "Calculus" },
  { value: "optimization", label: "Optimization" },
  { value: "information theory", label: "Information Theory" },
];

const STEPS = [
  { key: "learn", label: "Learn", color: "bg-amber-500" },
  { key: "math", label: "Math", color: "bg-violet-500" },
  { key: "proof", label: "Proof", color: "bg-blue-500" },
  { key: "application", label: "ML Application", color: "bg-emerald-500" },
];

/* ─── Shared Markdown renderer with LaTeX support ──── */

function MathText({ children, className = "" }) {
  if (!children) return null;
  return (
    <div className={`prose prose-invert prose-sm max-w-none
                     prose-headings:text-gray-100 prose-p:my-1.5 prose-li:my-0
                     prose-ul:my-1 prose-ol:my-1
                     prose-code:text-indigo-300 prose-code:bg-gray-800 prose-code:px-1 prose-code:rounded
                     prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700
                     prose-strong:text-gray-100 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default function MLMathDrill() {
  const [topic, setTopic] = usePersistedState("mlMath_topic", "all");
  const [question, setQuestion] = usePersistedState("mlMath_question", null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = usePersistedState("mlMath_step", "learn");
  const [mathAnswer, setMathAnswer] = usePersistedState("mlMath_mathAnswer", null);
  const [mathRevealed, setMathRevealed] = usePersistedState("mlMath_mathRevealed", false);
  const [proofAnswer, setProofAnswer] = usePersistedState("mlMath_proofAnswer", null);
  const [proofRevealed, setProofRevealed] = usePersistedState("mlMath_proofRevealed", false);
  const [stats, setStats] = usePersistedState("mlMath_stats", { total: 0, mathCorrect: 0, proofCorrect: 0 });
  const { addToast } = useToast();

  const fetchQuestion = async () => {
    setLoading(true);
    setQuestion(null);
    setStep("learn");
    setMathAnswer(null);
    setMathRevealed(false);
    setProofAnswer(null);
    setProofRevealed(false);
    try {
      const res = await fetch(`/api/ml-math?topic=${encodeURIComponent(topic)}`);
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      if (data.question && data.question.math_question) {
        setQuestion(data.question);
      } else {
        addToast("Failed to generate a valid question. Try again.", "warning");
      }
    } catch (err) {
      addToast("Failed to generate question. Check your connection.", "error");
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

  const goToMath = () => {
    setStep("math");
  };

  const goToProof = () => {
    setStep("proof");
  };

  const goToApplication = () => {
    const mathOk = mathAnswer === question.math_question.correct;
    const proofOk = proofAnswer === question.proof_question.correct;
    setStats((prev) => ({
      total: prev.total + 1,
      mathCorrect: prev.mathCorrect + (mathOk ? 1 : 0),
      proofCorrect: prev.proofCorrect + (proofOk ? 1 : 0),
    }));
    setStep("application");
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
    }).catch(() => {
      addToast("Failed to save drill results", "warning");
    });
  };

  const stepIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">ML Math Drill</h2>
      <p className="text-gray-400 mb-6 text-sm">
        Learn → Math → Proof → ML Application. Infinite drill loop.
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

          {/* STEP 0: Learn */}
          {step === "learn" && question.concept_explanation && (
            <LearnStep concept={question.concept_explanation} onNext={goToMath} />
          )}

          {/* STEP 0 fallback: skip Learn if no concept_explanation */}
          {step === "learn" && !question.concept_explanation && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5 space-y-4">
              <p className="text-sm text-gray-400">No concept explanation available for this question.</p>
              <button
                onClick={goToMath}
                className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-500 transition-colors"
              >
                Skip to Math Question →
              </button>
            </div>
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
              addToast={addToast}
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
              addToast={addToast}
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

/* ─── Learn Step ─────────────────────────────────────── */

function LearnStep({ concept, onNext }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5 space-y-5">
      <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wide">
        Concept Explanation
      </h3>

      {/* Core concept */}
      <div className="space-y-1">
        <span className="text-xs text-gray-400 uppercase font-medium">What is it?</span>
        <div className="bg-gray-900/60 rounded-lg p-4 border border-gray-700/50">
          <MathText className="text-gray-200">{concept.concept}</MathText>
        </div>
      </div>

      {/* Analogy */}
      {concept.analogy && (
        <div className="space-y-1">
          <span className="text-xs text-gray-400 uppercase font-medium">Intuition / Analogy</span>
          <div className="bg-amber-900/15 rounded-lg p-4 border border-amber-700/30">
            <MathText className="text-amber-200/90">{concept.analogy}</MathText>
          </div>
        </div>
      )}

      {/* Simple example */}
      {concept.simple_example && (
        <div className="space-y-1">
          <span className="text-xs text-emerald-400 uppercase font-medium">Simple Example</span>
          <div className="bg-emerald-900/15 rounded-lg p-4 border border-emerald-700/30">
            <MathText className="text-gray-200">{concept.simple_example}</MathText>
          </div>
        </div>
      )}

      {/* Harder example */}
      {concept.harder_example && (
        <div className="space-y-1">
          <span className="text-xs text-orange-400 uppercase font-medium">Harder Example</span>
          <div className="bg-orange-900/15 rounded-lg p-4 border border-orange-700/30">
            <MathText className="text-gray-200">{concept.harder_example}</MathText>
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-500 transition-colors"
      >
        Ready — Show Me the Question →
      </button>
    </div>
  );
}

/* ─── Math Step ──────────────────────────────────────── */

function MathStep({ q, answer, revealed, onSelect, onCheck, onNext, addToast }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wide">Math Problem</h3>
        {revealed && <ReportButton quizType="ml_math" questionData={{ part: "math", ...q }} addToast={addToast} />}
      </div>
      <MathText>{q.question}</MathText>

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
            {q.solution && (
              <div className="mt-2">
                <MathText>{q.solution}</MathText>
              </div>
            )}
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

function ProofStep({ q, answer, revealed, onSelect, onCheck, onNext, addToast }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">Proof Insertion</h3>
        {revealed && <ReportButton quizType="ml_math" questionData={{ part: "proof", ...q }} addToast={addToast} />}
      </div>
      <MathText>{q.question}</MathText>

      {/* Proof context with missing step */}
      {q.context && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
          <MathText>{q.context}</MathText>
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
            {q.explanation && (
              <div className="mt-2">
                <MathText>{q.explanation}</MathText>
              </div>
            )}
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
          <MathText>{app.explanation}</MathText>
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
            <MathText>{option}</MathText>
          </button>
        );
      })}
    </div>
  );
}
