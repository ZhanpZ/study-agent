import { describe, it, expect } from "vitest";
import { getConstraintScore } from "../utils/quizScoring";

describe("getConstraintScore", () => {
  it("returns perfect score when all correct selected", () => {
    const result = getConstraintScore(["A", "B"], new Set(["A", "B"]));
    expect(result.correctPicks).toBe(2);
    expect(result.wrongPicks).toBe(0);
    expect(result.missed).toBe(0);
    expect(result.total).toBe(2);
  });

  it("handles partial correct with extra wrong picks", () => {
    const result = getConstraintScore(["A", "B"], new Set(["A", "C"]));
    expect(result.correctPicks).toBe(1);
    expect(result.wrongPicks).toBe(1);
    expect(result.missed).toBe(1);
    expect(result.total).toBe(2);
  });

  it("handles nothing selected", () => {
    const result = getConstraintScore(["A", "B"], new Set());
    expect(result.correctPicks).toBe(0);
    expect(result.wrongPicks).toBe(0);
    expect(result.missed).toBe(2);
    expect(result.total).toBe(2);
  });

  it("handles all wrong selections", () => {
    const result = getConstraintScore(["A"], new Set(["B", "C"]));
    expect(result.correctPicks).toBe(0);
    expect(result.wrongPicks).toBe(2);
    expect(result.missed).toBe(1);
    expect(result.total).toBe(1);
  });

  it("accepts array input for userSelections", () => {
    const result = getConstraintScore(["A", "B"], ["A", "B"]);
    expect(result.correctPicks).toBe(2);
    expect(result.wrongPicks).toBe(0);
  });
});
