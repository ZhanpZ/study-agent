import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useToast } from "./Toast";
import { MODE_CONFIG } from "../constants/modeConfig";
import fetchWithTimeout from "../utils/fetchWithTimeout";

function stripMarkdownFence(content) {
  if (!content) return content;
  return content.replace(/^```(?:markdown|md)?\r?\n([\s\S]*?)\r?\n```\s*$/m, "$1").trim();
}

export default function ConceptDetail({ conceptId, conceptName, score, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState(null);
  const [summaryContent, setSummaryContent] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [sessionMessages, setSessionMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const { addToast } = useToast();

  useEffect(() => {
    fetchWithTimeout(`/api/concepts/${conceptId}/sessions`)
      .then((r) => r.json())
      .then((data) => {
        setSessions(data);
        setLoading(false);
      })
      .catch(() => {
        addToast("Failed to load session history", "error");
        setLoading(false);
      });
  }, [conceptId]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSessionClick = (session) => {
    if (expandedSession === session.id) {
      setExpandedSession(null);
      setSummaryContent(null);
      setSessionMessages([]);
      return;
    }

    setExpandedSession(session.id);
    setActiveTab(session.has_summary ? "summary" : "conversation");
    setSummaryContent(null);
    setSessionMessages([]);

    if (session.has_summary) {
      setLoadingSummary(true);
      fetchWithTimeout(`/api/session/${session.id}/summary`)
        .then((r) => r.json())
        .then((data) => {
          setSummaryContent(data.summary);
          setLoadingSummary(false);
        })
        .catch(() => {
          setSummaryContent(null);
          setLoadingSummary(false);
        });
    }

    setLoadingMessages(true);
    fetchWithTimeout(`/api/session/${session.id}`)
      .then((r) => r.json())
      .then((data) => {
        setSessionMessages(data.messages || []);
        setLoadingMessages(false);
      })
      .catch(() => {
        setSessionMessages([]);
        setLoadingMessages(false);
      });
  };

  const agentLabel = (agent) => {
    const map = { professor: "Professor", student: "Student", tester: "Tester" };
    return map[agent] || null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-focus-bg-alt border border-focus-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-focus-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-focus-teal/15 border border-focus-teal/25 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-focus-teal">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{conceptName}</h2>
              {score !== undefined && (
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-16 h-1.5 bg-focus-border rounded-full">
                    <div
                      className={`h-1.5 rounded-full ${score >= 80 ? "bg-focus-teal" : score >= 50 ? "bg-focus-amber" : "bg-red-500"}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className="text-xs text-focus-text-muted">{Math.round(score)}/100</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-focus-text-muted hover:text-white hover:bg-focus-surface transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-3 text-focus-text-muted">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-focus-text-dim py-8">No sessions found.</div>
          ) : (
            sessions.map((session) => (
              <div key={session.id}>
                <button
                  onClick={() => handleSessionClick(session)}
                  className={`w-full text-left bg-focus-surface border rounded-xl p-4 transition-all hover:bg-focus-surface-alt ${
                    expandedSession === session.id
                      ? "border-focus-teal/50 ring-1 ring-focus-teal/10"
                      : "border-focus-border hover:border-focus-border-light"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${
                        (MODE_CONFIG[session.mode] || MODE_CONFIG.concept).badgeLight
                      }`}>
                        {(MODE_CONFIG[session.mode] || MODE_CONFIG.concept).label}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${
                        session.phase === "complete"
                          ? "bg-focus-teal/10 text-focus-teal border-focus-teal/25"
                          : "bg-focus-surface text-focus-text-dim border-focus-border"
                      }`}>
                        {session.phase}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-focus-text-dim">
                        {session.started_at
                          ? new Date(session.started_at).toLocaleDateString()
                          : "---"}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-focus-text-dim transition-transform ${expandedSession === session.id ? "rotate-180" : ""}`}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Expanded session detail */}
                {expandedSession === session.id && (
                  <div className="mt-2 bg-focus-surface border border-focus-border rounded-xl overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-focus-border">
                      {session.has_summary && (
                        <button
                          onClick={() => setActiveTab("summary")}
                          className={`px-4 py-2.5 text-xs font-medium transition-colors ${
                            activeTab === "summary"
                              ? "text-focus-teal border-b-2 border-focus-teal bg-focus-teal/5"
                              : "text-focus-text-muted hover:text-focus-text"
                          }`}
                        >
                          Session Notes
                        </button>
                      )}
                      <button
                        onClick={() => setActiveTab("conversation")}
                        className={`px-4 py-2.5 text-xs font-medium transition-colors ${
                          activeTab === "conversation"
                            ? "text-focus-teal border-b-2 border-focus-teal bg-focus-teal/5"
                            : "text-focus-text-muted hover:text-focus-text"
                        }`}
                      >
                        Conversation
                      </button>
                    </div>

                    <div className="p-4 max-h-96 overflow-y-auto">
                      {/* Summary tab */}
                      {activeTab === "summary" && (
                        loadingSummary ? (
                          <div className="flex items-center gap-2 text-sm text-focus-text-muted py-2">
                            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 12a9 9 0 11-6.219-8.56"/>
                            </svg>
                            Loading notes...
                          </div>
                        ) : summaryContent ? (
                          <div className="text-sm text-gray-200 prose prose-invert prose-sm max-w-none
                                          prose-headings:text-gray-100 prose-headings:mb-2 prose-headings:mt-3
                                          prose-p:my-1 prose-li:my-0 prose-ul:my-1 prose-ol:my-1
                                          prose-code:text-focus-teal prose-code:bg-gray-800 prose-code:px-1.5 prose-code:rounded
                                          prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700 prose-pre:rounded-lg
                                          prose-strong:text-gray-100">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {stripMarkdownFence(summaryContent)}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className="text-sm text-focus-text-dim">No notes found.</div>
                        )
                      )}

                      {/* Conversation tab */}
                      {activeTab === "conversation" && (
                        loadingMessages ? (
                          <div className="flex items-center gap-2 text-sm text-focus-text-muted py-2">
                            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 12a9 9 0 11-6.219-8.56"/>
                            </svg>
                            Loading conversation...
                          </div>
                        ) : sessionMessages.length === 0 ? (
                          <div className="text-sm text-focus-text-dim">No messages recorded.</div>
                        ) : (
                          <div className="space-y-3">
                            {sessionMessages.map((msg, i) => (
                              <div
                                key={i}
                                className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}
                              >
                                {msg.role !== "user" && agentLabel(msg.agent) && (
                                  <span className="text-[10px] text-focus-text-dim px-1">{agentLabel(msg.agent)}</span>
                                )}
                                <div
                                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                                    msg.role === "user"
                                      ? "bg-focus-teal/15 text-gray-100 border border-focus-teal/25"
                                      : "bg-focus-bg-alt text-gray-200 border border-focus-border"
                                  }`}
                                >
                                  <div className="prose prose-invert prose-sm max-w-none
                                                  prose-p:my-0.5 prose-headings:my-1
                                                  prose-code:text-focus-teal prose-code:bg-gray-800 prose-code:px-1 prose-code:rounded
                                                  prose-pre:bg-gray-900 prose-pre:my-1 prose-pre:rounded-lg
                                                  prose-ul:my-0.5 prose-ol:my-0.5 prose-li:my-0">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
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
