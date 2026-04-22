import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast";
import fetchWithTimeout from "../utils/fetchWithTimeout";
import SpinnerIcon from "../components/SpinnerIcon";

export default function Review() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    fetchWithTimeout("/api/reviews/due")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        setReviews(data);
        setLoading(false);
      })
      .catch(() => {
        addToast("Failed to load reviews. Please try again.", "error");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center mt-20 gap-3">
        <SpinnerIcon className="h-5 w-5 text-focus-text-muted" />
        <span className="text-focus-text-muted">Loading reviews...</span>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-2xl bg-focus-surface border border-focus-border flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-focus-text-muted">
            <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">No concepts yet</h2>
        <p className="text-focus-text-muted text-sm text-center max-w-xs">
          Start studying a topic to build your concept bank.
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-5 px-5 py-2.5 bg-focus-teal text-white text-sm font-medium rounded-xl
                     hover:bg-focus-teal-light transition-colors shadow-lg shadow-focus-teal/10"
        >
          Start Studying
        </button>
      </div>
    );
  }

  const { due: dueItems = [], new: newItems = [], upcoming: upcomingItems = [] } =
    reviews.reduce((acc, r) => {
      (acc[r.status] ??= []).push(r);
      return acc;
    }, {});

  const statusConfig = {
    due: {
      label: "Due for Review",
      badgeColor: "text-focus-amber",
      iconBg: "bg-orange-500/10 border-orange-500/20",
      iconColor: "text-orange-400",
      btnClass: "bg-orange-600 hover:bg-orange-500 shadow-orange-900/15",
      btnText: "Review Now",
    },
    new: {
      label: "New / Not Yet Reviewed",
      badgeColor: "text-focus-teal",
      iconBg: "bg-focus-teal/10 border-focus-teal/20",
      iconColor: "text-focus-teal",
      btnClass: "bg-focus-teal hover:bg-focus-teal-light shadow-focus-teal/10",
      btnText: "Start",
    },
    upcoming: {
      label: "Upcoming",
      badgeColor: "text-focus-text-muted",
      iconBg: "bg-focus-surface border-focus-border",
      iconColor: "text-focus-text-muted",
      btnClass: "bg-focus-surface-alt hover:bg-focus-border shadow-none text-focus-text-muted",
      btnText: "Study Again",
    },
  };

  const renderSection = (items, status) => {
    if (items.length === 0) return null;
    const cfg = statusConfig[status];
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">{cfg.label}</h3>
          <span className={`text-sm font-medium ${cfg.badgeColor}`}>
            {items.length} concept{items.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="space-y-3">
          {items.map((review) => (
            <div
              key={review.concept_id}
              className="bg-focus-surface border border-focus-border rounded-xl p-4 flex items-center justify-between
                         hover:border-focus-border-light transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                  {status === "due" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cfg.iconColor}>
                      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                    </svg>
                  ) : status === "new" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cfg.iconColor}>
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={cfg.iconColor}>
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-white font-medium">{review.concept_name}</h3>
                  <p className="text-xs text-focus-text-dim mt-0.5">
                    {status === "due" && (
                      <>Review #{review.repetitions + 1} &middot; {Math.round(review.interval_days)} day interval</>
                    )}
                    {status === "new" && (
                      <>Score: {Math.round(review.score)} &middot; Not yet reviewed</>
                    )}
                    {status === "upcoming" && review.next_review && (
                      <>Next review: {new Date(review.next_review).toLocaleDateString()} &middot; {Math.round(review.interval_days)} day interval</>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  navigate(`/?topic=${encodeURIComponent(review.concept_name)}`);
                }}
                className={`px-4 py-2 text-white text-sm font-medium rounded-lg
                           transition-all shadow-lg
                           opacity-80 group-hover:opacity-100 ${cfg.btnClass}`}
              >
                {cfg.btnText}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Review</h2>
      {renderSection(dueItems, "due")}
      {renderSection(newItems, "new")}
      {renderSection(upcomingItems, "upcoming")}
    </div>
  );
}
