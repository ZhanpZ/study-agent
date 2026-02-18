import { useState, useEffect } from "react";

export default function Review() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reviews/due")
      .then((res) => res.json())
      .then((data) => {
        setReviews(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center text-gray-400 mt-20">Loading reviews...</div>;
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-5xl mb-4">&#127881;</div>
        <h2 className="text-2xl font-bold text-white mb-2">No reviews due!</h2>
        <p className="text-gray-400">
          All caught up. Go learn something new on the Study page.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Due for Review</h2>
      <div className="space-y-3">
        {reviews.map((review) => (
          <div
            key={review.concept_id}
            className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 flex items-center justify-between"
          >
            <div>
              <h3 className="text-white font-medium">{review.concept_name}</h3>
              <p className="text-xs text-gray-400 mt-1">
                Review #{review.repetitions + 1} &middot; Interval:{" "}
                {Math.round(review.interval_days)} days
              </p>
            </div>
            <button
              onClick={() => {
                // Start a review session — navigates to Study with this topic
                window.location.href = `/?topic=${encodeURIComponent(review.concept_name)}`;
              }}
              className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg
                         hover:bg-orange-500 transition-colors"
            >
              Start Review
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
