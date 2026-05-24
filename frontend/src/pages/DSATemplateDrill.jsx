import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useToast } from "../components/Toast";
import usePersistedState from "../hooks/usePersistedState";
import saveQuizHistory from "../utils/saveQuizHistory";
import fetchWithTimeout from "../utils/fetchWithTimeout";
import CodeBlock from "../components/CodeBlock";
import CodeEditor from "../components/CodeEditor";

const DIFFICULTY_STYLES = {
  easy: "bg-green-500/15 text-green-400 border-green-500/25",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  hard: "bg-red-500/15 text-red-400 border-red-500/25",
};

export default function DSATemplateDrill() {
  const [templates, setTemplates] = useState(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = usePersistedState("dsaDrill_template", null);
  const [codeInput, setCodeInput] = usePersistedState("dsaDrill_code", "");
  const [evaluation, setEvaluation] = usePersistedState("dsaDrill_eval", null);
  const [evaluating, setEvaluating] = useState(false);
  const [phase, setPhase] = usePersistedState("dsaDrill_phase", "select"); // select | code | result
  const { addToast } = useToast();

  // Fetch template catalog on mount
  useEffect(() => {
    if (!templates) {
      setLoadingTemplates(true);
      fetchWithTimeout("/api/dsa-templates", {}, 15000)
        .then((res) => res.json())
        .then((data) => setTemplates(data.templates || []))
        .catch(() => addToast("Failed to load templates.", "error"))
        .finally(() => setLoadingTemplates(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectTemplate = (t) => {
    setSelectedTemplate(t);
    setCodeInput("");
    setEvaluation(null);
    setPhase("code");
  };

  const handleRandomTemplate = () => {
    if (!templates || templates.length === 0) return;
    const t = templates[Math.floor(Math.random() * templates.length)];
    handleSelectTemplate(t);
  };

  const handleSubmitCode = async () => {
    if (!codeInput.trim() || !selectedTemplate) return;
    setEvaluating(true);
    try {
      const res = await fetchWithTimeout(
        "/api/dsa-templates/evaluate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template_id: selectedTemplate.id, code: codeInput }),
        },
        60000
      );
      if (!res.ok) throw new Error("Evaluation failed");
      const data = await res.json();
      setEvaluation(data);
      setPhase("result");
      // Auto-save to quiz history
      saveQuizHistory(
        "dsa_template",
        selectedTemplate.name,
        [{ template_id: selectedTemplate.id, name: selectedTemplate.name }],
        { code: codeInput },
        data.overall_score,
        addToast
      );
    } catch (err) {
      addToast("Failed to evaluate code. Try again.", "error");
      console.error("Evaluation error:", err);
    } finally {
      setEvaluating(false);
    }
  };

  const handleTryAgain = () => {
    setCodeInput("");
    setEvaluation(null);
    setPhase("code");
  };

  const handlePickAnother = () => {
    setSelectedTemplate(null);
    setCodeInput("");
    setEvaluation(null);
    setPhase("select");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">DSA Template Drill</h2>
          <p className="text-sm text-focus-text-muted mt-1">
            Practice implementing classic data structures & algorithms from memory
          </p>
        </div>
        {phase !== "select" && (
          <button
            onClick={handlePickAnother}
            className="text-sm text-focus-text-muted hover:text-white transition-colors"
          >
            &larr; Back to templates
          </button>
        )}
      </div>

      {phase === "select" && (
        <TemplateSelector
          templates={templates}
          loading={loadingTemplates}
          onSelect={handleSelectTemplate}
          onRandom={handleRandomTemplate}
        />
      )}

      {phase === "code" && selectedTemplate && (
        <CodePhase
          template={selectedTemplate}
          codeInput={codeInput}
          setCodeInput={setCodeInput}
          onSubmit={handleSubmitCode}
          evaluating={evaluating}
        />
      )}

      {phase === "result" && evaluation && (
        <ResultPhase
          evaluation={evaluation}
          onTryAgain={handleTryAgain}
          onPickAnother={handlePickAnother}
        />
      )}
    </div>
  );
}


/* ─── Template Selector ──────────────────────────────────────── */

function TemplateSelector({ templates, loading, onSelect, onRandom }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex items-center gap-3 text-focus-text-muted">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeLinecap="round" className="opacity-25" />
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="45" strokeLinecap="round" />
          </svg>
          Loading templates...
        </div>
      </div>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <div className="text-center text-focus-text-muted py-12">
        No templates available. Check your backend connection.
      </div>
    );
  }

  const dataStructures = templates.filter((t) => t.category === "data_structure");
  const algorithms = templates.filter((t) => t.category === "algorithm");

  return (
    <div>
      {/* Random button */}
      <div className="mb-6">
        <button
          onClick={onRandom}
          className="px-5 py-2.5 bg-focus-teal text-white text-sm font-medium rounded-lg
                     hover:bg-focus-teal/80 transition-colors flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
            <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
            <line x1="4" y1="4" x2="9" y2="9"/>
          </svg>
          Random Template
        </button>
      </div>

      {/* Data Structures */}
      <h3 className="text-lg font-semibold text-white mb-3">Data Structures</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {dataStructures.map((t) => (
          <TemplateCard key={t.id} template={t} onClick={() => onSelect(t)} />
        ))}
      </div>

      {/* Algorithm Templates */}
      <h3 className="text-lg font-semibold text-white mb-3">Algorithm Templates</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {algorithms.map((t) => (
          <TemplateCard key={t.id} template={t} onClick={() => onSelect(t)} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ template, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-xl border border-focus-border bg-focus-surface
                 hover:border-focus-teal/50 hover:bg-focus-surface/80 transition-all group"
    >
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-sm font-semibold text-white group-hover:text-focus-accent transition-colors">
          {template.name}
        </h4>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${DIFFICULTY_STYLES[template.difficulty]}`}>
          {template.difficulty}
        </span>
      </div>
      <p className="text-xs text-focus-text-muted leading-relaxed line-clamp-2">
        {template.description}
      </p>
      <div className="flex flex-wrap gap-1 mt-2.5">
        {template.tags.map((tag) => (
          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}


/* ─── Code Phase ─────────────────────────────────────────────── */

function CodePhase({ template, codeInput, setCodeInput, onSubmit, evaluating }) {
  const lineCount = codeInput.split("\n").length;

  return (
    <div>
      {/* Template prompt */}
      <div className="rounded-xl border border-focus-border bg-focus-surface p-5 mb-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-lg bg-focus-teal/15 flex items-center justify-center border border-focus-teal/25">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-focus-accent">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
          </div>
          <h3 className="text-base font-semibold text-white">{template.name}</h3>
          <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${DIFFICULTY_STYLES[template.difficulty]}`}>
            {template.difficulty}
          </span>
        </div>

        <p className="text-sm text-gray-300 leading-relaxed mb-4">{template.description}</p>

        {/* Required methods */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Required Methods</h4>
          <div className="space-y-1">
            {template.required_methods.map((method, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-emerald-400 font-mono">&bull;</span>
                <code className="text-emerald-300 bg-gray-800/60 px-2 py-0.5 rounded font-mono">
                  {method}
                </code>
              </div>
            ))}
          </div>
        </div>

        {/* Expected complexity */}
        <div className="mt-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Expected Complexity</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(template.expected_complexity).map(([op, c]) => (
              <span key={op} className="text-[11px] text-gray-400 bg-gray-800/40 px-2 py-1 rounded font-mono">
                {op}: <span className="text-amber-400">{c}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Code editor */}
      <div className="rounded-xl overflow-hidden border border-focus-border bg-focus-surface">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/60"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/60"></span>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">solution.py</span>
          </div>
          <span className="text-[11px] text-gray-400">{lineCount} {lineCount === 1 ? "line" : "lines"}</span>
        </div>

        <div className="bg-gray-900/40">
          <CodeEditor
            value={codeInput}
            onChange={setCodeInput}
            language="python"
            minHeight="300px"
            maxHeight="600px"
            disabled={evaluating}
            placeholder="# Write your implementation here..."
          />
        </div>

        {/* Submit footer */}
        <div className="px-4 py-3 border-t border-focus-border bg-focus-surface flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 border border-gray-700 font-mono text-[10px]">Ctrl</kbd>
            +
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 border border-gray-700 font-mono text-[10px]">Enter</kbd>
            <span className="ml-1.5">to submit</span>
          </span>
          <button
            onClick={onSubmit}
            disabled={!codeInput.trim() || evaluating}
            className="px-6 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg
                       hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors flex items-center gap-2"
          >
            {evaluating ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeLinecap="round" className="opacity-25" />
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="45" strokeLinecap="round" />
                </svg>
                Evaluating...
              </>
            ) : (
              "Submit Code"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ─── Result Phase ───────────────────────────────────────────── */

function ResultPhase({ evaluation, onTryAgain, onPickAnother }) {
  const [showRef, setShowRef] = useState(false);

  const scoreColor = evaluation.overall_score >= 80
    ? "text-green-400"
    : evaluation.overall_score >= 50
    ? "text-amber-400"
    : "text-red-400";

  const scoreBg = evaluation.overall_score >= 80
    ? "bg-green-500/10 border-green-500/20"
    : evaluation.overall_score >= 50
    ? "bg-amber-500/10 border-amber-500/20"
    : "bg-red-500/10 border-red-500/20";

  const axes = [
    { label: "Structural", key: "structural_correctness", color: "bg-blue-500" },
    { label: "Algorithmic", key: "algorithmic_correctness", color: "bg-emerald-500" },
    { label: "Complexity", key: "complexity_correctness", color: "bg-violet-500" },
    { label: "Edge Cases", key: "edge_case_handling", color: "bg-amber-500" },
    { label: "Code Quality", key: "code_quality", color: "bg-pink-500" },
  ];

  return (
    <div className="space-y-4">
      {/* Overall score */}
      <div className={`rounded-xl border p-5 ${scoreBg}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Overall Score
            </h3>
            <div className={`text-4xl font-bold ${scoreColor}`}>
              {Math.round(evaluation.overall_score)}
              <span className="text-lg text-gray-500">/100</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-white font-medium">{evaluation.template_name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {evaluation.overall_score >= 80
                ? "Great recall!"
                : evaluation.overall_score >= 50
                ? "Getting there - review the gaps below"
                : "Needs more practice"}
            </p>
          </div>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="rounded-xl border border-focus-border bg-focus-surface p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Score Breakdown</h3>
        <div className="space-y-3">
          {axes.map(({ label, key, color }) => (
            <div key={key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-400">{label}</span>
                <span className="text-white font-medium">{Math.round(evaluation[key] || 0)}</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${color}`}
                  style={{ width: `${evaluation[key] || 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Missing methods */}
      {evaluation.missing_methods && evaluation.missing_methods.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <h3 className="text-sm font-semibold text-red-400 mb-2">Missing Methods</h3>
          <div className="flex flex-wrap gap-2">
            {evaluation.missing_methods.map((m, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-red-500/15 text-red-300 border border-red-500/20 font-mono">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bugs */}
      {evaluation.bugs && evaluation.bugs.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h3 className="text-sm font-semibold text-amber-400 mb-2">Bugs Found</h3>
          <ul className="space-y-1.5">
            {evaluation.bugs.map((bug, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-200/80">
                <span className="text-amber-500 shrink-0 mt-0.5">&#x2022;</span>
                {bug}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Feedback */}
      {evaluation.feedback && (
        <div className="rounded-xl border border-focus-border bg-focus-surface p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Detailed Feedback</h3>
          <div className="text-sm text-gray-300 leading-relaxed prose prose-invert prose-sm max-w-none
                          prose-code:text-indigo-300 prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                          prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700 prose-pre:rounded-lg">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
              {evaluation.feedback}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Reference implementation */}
      {evaluation.reference_implementation && (
        <div className="rounded-xl border border-focus-border bg-focus-surface overflow-hidden">
          <button
            onClick={() => setShowRef(!showRef)}
            className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
          >
            <h3 className="text-sm font-semibold text-white">Reference Implementation</h3>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`text-gray-400 transition-transform ${showRef ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showRef && (
            <div className="px-5 pb-4 border-t border-focus-border pt-3">
              <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto border border-gray-800">
                <code className="text-sm text-emerald-300 font-mono leading-relaxed whitespace-pre">
                  {evaluation.reference_implementation}
                </code>
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onTryAgain}
          className="px-5 py-2.5 bg-focus-surface border border-focus-border text-white text-sm font-medium rounded-lg
                     hover:bg-gray-700/50 transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={onPickAnother}
          className="px-5 py-2.5 bg-focus-teal text-white text-sm font-medium rounded-lg
                     hover:bg-focus-teal/80 transition-colors"
        >
          Pick Another Template
        </button>
      </div>
    </div>
  );
}
