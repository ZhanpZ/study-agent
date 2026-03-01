import { useState, useEffect, useRef } from "react";

export default function ReportButton({ quizType, questionData, addToast }) {
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
            placeholder="e.g. Wrong answer, ambiguous options..."
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
