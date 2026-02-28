import { describe, it, expect } from "vitest";
import { deriveMlMathStats } from "../utils/statsHelpers";

describe("deriveMlMathStats", () => {
  it("returns nulls for empty input", () => {
    const result = deriveMlMathStats([]);
    expect(result.mathPct).toBeNull();
    expect(result.proofPct).toBeNull();
    expect(result.topics).toEqual([]);
  });

  it("calculates 100% when all correct", () => {
    const quizzes = [
      {
        questions: [
          {
            topic: "PCA",
            math_question: { correct: "A" },
            proof_question: { correct: "B" },
          },
        ],
        answers: { math: "A", proof: "B" },
      },
    ];
    const result = deriveMlMathStats(quizzes);
    expect(result.mathPct).toBe(100);
    expect(result.proofPct).toBe(100);
    expect(result.topics).toEqual(["PCA"]);
  });

  it("calculates mixed results correctly", () => {
    const quizzes = [
      {
        questions: [{ topic: "PCA", math_question: { correct: "A" }, proof_question: { correct: "B" } }],
        answers: { math: "A", proof: "C" },
      },
      {
        questions: [{ topic: "SVD", math_question: { correct: "B" }, proof_question: { correct: "A" } }],
        answers: { math: "C", proof: "A" },
      },
    ];
    const result = deriveMlMathStats(quizzes);
    expect(result.mathPct).toBe(50); // 1/2
    expect(result.proofPct).toBe(50); // 1/2
  });

  it("deduplicates topics", () => {
    const quizzes = [
      { questions: [{ topic: "PCA", math_question: { correct: "A" } }], answers: { math: "A" } },
      { questions: [{ topic: "PCA", math_question: { correct: "B" } }], answers: { math: "B" } },
      { questions: [{ topic: "SVD", math_question: { correct: "A" } }], answers: { math: "A" } },
    ];
    const result = deriveMlMathStats(quizzes);
    expect(result.topics).toHaveLength(2);
    expect(result.topics).toContain("PCA");
    expect(result.topics).toContain("SVD");
  });

  it("handles quizzes with empty questions array", () => {
    const quizzes = [{ questions: [], answers: {} }];
    const result = deriveMlMathStats(quizzes);
    expect(result.mathPct).toBeNull();
    expect(result.proofPct).toBeNull();
  });
});
