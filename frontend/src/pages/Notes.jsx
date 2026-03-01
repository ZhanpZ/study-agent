import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Notes() {
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleCleanAndSave = async () => {
    if (!rawText.trim()) {
      addToast("Please enter some text first.", "warning");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/notes/clean-and-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: rawText }),
      });

      if (!res.ok) throw new Error("Failed to clean note");

      const data = await res.json();
      setResult(data);
      addToast(`Saved "${data.topic}" for review!`, "success");
    } catch {
      addToast("Failed to process notes. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setRawText("");
    setResult(null);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Note Cleanup</h2>
          <p className="text-sm text-focus-text-muted mt-1">
            Paste messy notes and let AI clean them into concise study material
          </p>
        </div>
      </div>

      {!result ? (
        <div className="space-y-4">
          <div className="bg-focus-surface border border-focus-border rounded-xl p-5">
            <label
              htmlFor="raw-notes"
              className="block text-sm font-medium text-focus-text-muted mb-2"
            >
              Raw Notes
            </label>
            <textarea
              id="raw-notes"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste your messy notes here... typos, shorthand, stream of consciousness — all welcome"
              rows={12}
              maxLength={10000}
              disabled={loading}
              className="w-full bg-focus-bg border border-focus-border rounded-lg px-4 py-3
                         text-focus-text placeholder-focus-text-dim text-sm leading-relaxed
                         focus:border-focus-teal focus:ring-1 focus:ring-focus-teal/20 focus:outline-none
                         resize-y disabled:opacity-50 transition-colors"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-focus-text-dim">
                {rawText.length.toLocaleString()} / 10,000 characters
              </span>
              <button
                onClick={handleCleanAndSave}
                disabled={loading || !rawText.trim()}
                className="px-5 py-2.5 bg-focus-teal text-white text-sm font-medium rounded-xl
                           hover:bg-focus-teal-light transition-all shadow-lg shadow-focus-teal/10
                           disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                    Cleaning...
                  </>
                ) : (
                  "Clean & Save"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Topic header */}
          <div className="bg-focus-surface border border-focus-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-focus-teal/10 border border-focus-teal/20 flex items-center justify-center shrink-0">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-focus-teal"
                >
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">{result.topic}</h3>
                <p className="text-xs text-focus-text-dim">
                  Scheduled for review
                  {result.next_review &&
                    ` \u2014 ${new Date(result.next_review).toLocaleDateString()}`}
                </p>
              </div>
            </div>

            {/* Cleaned note */}
            <div className="prose prose-invert prose-sm max-w-none mt-4 text-focus-text leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result.cleaned_note}
              </ReactMarkdown>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="px-5 py-2.5 bg-focus-surface border border-focus-border text-focus-text-muted
                         text-sm font-medium rounded-xl hover:border-focus-border-light
                         hover:text-focus-text transition-colors"
            >
              Clean Another
            </button>
            <button
              onClick={() => navigate("/review")}
              className="px-5 py-2.5 bg-focus-teal text-white text-sm font-medium rounded-xl
                         hover:bg-focus-teal-light transition-all shadow-lg shadow-focus-teal/10"
            >
              Go to Reviews
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
