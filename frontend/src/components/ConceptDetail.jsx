import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MODE_BADGE = {
  concept: "bg-blue-900/40 text-blue-400",
  industrial: "bg-emerald-900/40 text-emerald-400",
  leetcode: "bg-amber-900/40 text-amber-400",
};

const MODE_LABEL = {
  concept: "Concept",
  industrial: "Industrial",
  leetcode: "Leetcode",
};

export default function ConceptDetail({ conceptId, conceptName, score, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState(null);
  const [summaryContent, setSummaryContent] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    fetch(`/api/concepts/${conceptId}/sessions`)
      .then((r) => r.json())
      .then((data) => {
        setSessions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [conceptId]);

  const handleSessionClick = (session) => {
    if (expandedSession === session.id) {
      setExpandedSession(null);
      setSummaryContent(null);
      return;
    }

    setExpandedSession(session.id);
    if (session.has_summary) {
      setLoadingSummary(true);
      fetch(`/api/session/${session.id}/summary`)
        .then((r) => r.json())
        .then((data) => {
          setSummaryContent(data.summary);
          setLoadingSummary(false);
        })
        .catch(() => {
          setSummaryContent(null);
          setLoadingSummary(false);
        });
    } else {
      setSummaryContent(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-white">{conceptName}</h2>
            {score !== undefined && (
              <span className="text-sm text-gray-400">Score: {Math.round(score)}/100</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl px-2"
          >
            &times;
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center text-gray-500">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-gray-500">No sessions found.</div>
          ) : (
            sessions.map((session) => (
              <div key={session.id}>
                <button
                  onClick={() => handleSessionClick(session)}
                  className={`w-full text-left bg-gray-800/60 border rounded-lg p-3 transition-colors ${
                    expandedSession === session.id
                      ? "border-indigo-500"
                      : "border-gray-700 hover:border-gray-500"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        MODE_BADGE[session.mode] || MODE_BADGE.concept
                      }`}>
                        {MODE_LABEL[session.mode] || session.mode}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        session.phase === "complete"
                          ? "bg-purple-900/40 text-purple-400"
                          : "bg-gray-700 text-gray-400"
                      }`}>
                        {session.phase}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {session.started_at
                        ? new Date(session.started_at).toLocaleDateString()
                        : "---"}
                    </span>
                  </div>
                  {!session.has_summary && (
                    <p className="text-xs text-gray-500 mt-1">No summary available</p>
                  )}
                  {session.has_summary && (
                    <p className="text-xs text-gray-400 mt-1">
                      {expandedSession === session.id ? "Click to collapse" : "Click to view notes"}
                    </p>
                  )}
                </button>

                {/* Expanded summary */}
                {expandedSession === session.id && session.has_summary && (
                  <div className="mt-2 bg-gray-800/40 border border-gray-700 rounded-lg p-4">
                    {loadingSummary ? (
                      <div className="text-sm text-gray-500">Loading notes...</div>
                    ) : summaryContent ? (
                      <div>
                        {session.mode === "leetcode" && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            <span className="text-xs px-2 py-1 rounded-full bg-amber-900/40 text-amber-400 border border-amber-700/50">
                              Leetcode Session
                            </span>
                          </div>
                        )}
                        <div className="text-sm text-gray-200 prose prose-invert prose-sm max-w-none
                                        prose-headings:text-gray-100 prose-headings:mb-2 prose-headings:mt-3
                                        prose-p:my-1 prose-li:my-0 prose-ul:my-1 prose-ol:my-1
                                        prose-code:text-indigo-300 prose-code:bg-gray-800 prose-code:px-1 prose-code:rounded
                                        prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700
                                        prose-strong:text-gray-100">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {summaryContent}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No notes found.</div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
