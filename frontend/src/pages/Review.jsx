import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast";

export default function Review() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    fetch("/api/reviews/due")
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
        <svg className="animate-spin h-5 w-5 text-focus-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-6.219-8.56"/>
        </svg>
        <span className="text-focus-text-muted">Loading reviews...</span>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">All caught up!</h2>
        <p className="text-focus-text-muted text-sm text-center max-w-xs">
          No reviews due right now. Head to the Study page to learn something new.
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Due for Review</h2>
        <span className="text-sm text-focus-amber font-medium">
          {reviews.length} concept{reviews.length !== 1 ? "s" : ""} due
        </span>
      </div>
      <div className="space-y-3">
        {reviews.map((review) => (
          <div
            key={review.concept_id}
            className="bg-focus-surface border border-focus-border rounded-xl p-4 flex items-center justify-between
                       hover:border-focus-border-light transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                </svg>
              </div>
              <div>
                <h3 className="text-white font-medium">{review.concept_name}</h3>
                <p className="text-xs text-focus-text-dim mt-0.5">
                  Review #{review.repetitions + 1} &middot; {Math.round(review.interval_days)} day interval
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                navigate(`/?topic=${encodeURIComponent(review.concept_name)}`);
              }}
              className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg
                         hover:bg-orange-500 transition-all shadow-lg shadow-orange-900/15
                         opacity-80 group-hover:opacity-100"
            >
              Start Review
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
