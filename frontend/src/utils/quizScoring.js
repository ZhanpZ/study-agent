/**
 * Score a constraint quiz question by comparing user selections to correct answers.
 * @param {string[]} correctAnswers - Array of correct option letters (e.g. ["A", "C", "D"])
 * @param {Set<string>|string[]} userSelections - User's selected option letters
 * @returns {{ correctPicks: number, wrongPicks: number, missed: number, total: number }}
 */
export function getConstraintScore(correctAnswers, userSelections) {
  const correctSet = new Set(correctAnswers);
  const userSet = userSelections instanceof Set ? userSelections : new Set(userSelections);
  const correctPicks = [...userSet].filter((l) => correctSet.has(l)).length;
  const wrongPicks = [...userSet].filter((l) => !correctSet.has(l)).length;
  const missed = [...correctSet].filter((l) => !userSet.has(l)).length;
  return { correctPicks, wrongPicks, missed, total: correctSet.size };
}
