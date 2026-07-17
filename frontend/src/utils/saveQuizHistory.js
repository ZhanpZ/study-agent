import fetchWithTimeout from "./fetchWithTimeout";

export default function saveQuizHistory(quiz_type, topic, questions, answers, score, addToast) {
  return fetchWithTimeout("/api/quiz-history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quiz_type, topic, questions, answers, score }),
  }).catch(() => {
    if (addToast) addToast("Failed to save quiz results", "warning");
  });
}
