/**
 * Derive math/proof accuracy stats from ML math quiz history.
 * @param {Array} quizzes - Array of quiz history objects
 * @returns {{ mathPct: number|null, proofPct: number|null, topics: string[] }}
 */
export function deriveMlMathStats(quizzes) {
  let mathCorrect = 0,
    mathTotal = 0,
    proofCorrect = 0,
    proofTotal = 0;
  const topicSet = new Set();

  quizzes.forEach((q) => {
    const question = q.questions?.[0];
    if (!question) return;

    if (question.topic) topicSet.add(question.topic);

    if (question.math_question) {
      mathTotal++;
      if (q.answers?.math === question.math_question.correct) mathCorrect++;
    }
    if (question.proof_question) {
      proofTotal++;
      if (q.answers?.proof === question.proof_question.correct) proofCorrect++;
    }
  });

  return {
    mathPct: mathTotal ? Math.round((mathCorrect / mathTotal) * 100) : null,
    proofPct: proofTotal ? Math.round((proofCorrect / proofTotal) * 100) : null,
    topics: [...topicSet],
  };
}
