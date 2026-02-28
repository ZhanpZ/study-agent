import { describe, it, expect } from "vitest";
import { validateTopic } from "../utils/validation";

describe("validateTopic", () => {
  it("returns error for too-short topic", () => {
    expect(validateTopic("a")).toContain("at least");
  });

  it("returns error for too-long topic", () => {
    expect(validateTopic("a".repeat(101))).toContain("under");
  });

  it("returns error for non-alphanumeric only", () => {
    expect(validateTopic("!!!")).toContain("letters or numbers");
  });

  it("returns empty string for valid topic", () => {
    expect(validateTopic("binary search")).toBe("");
  });

  it("accepts exactly MIN_TOPIC_LENGTH characters", () => {
    expect(validateTopic("ab")).toBe("");
  });

  it("accepts mixed alphanumeric and symbols", () => {
    expect(validateTopic("TCP/IP")).toBe("");
  });

  it("accepts exactly MAX_TOPIC_LENGTH characters", () => {
    expect(validateTopic("a".repeat(100))).toBe("");
  });
});
