import { describe, it, expect, beforeEach } from "vitest";
import { loadSessionState, persistSessionState } from "../utils/sessionStorage";

describe("sessionStorage utils", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe("loadSessionState", () => {
    it("returns parsed stored value", () => {
      sessionStorage.setItem("key", JSON.stringify({ a: 1 }));
      expect(loadSessionState("key", null)).toEqual({ a: 1 });
    });

    it("returns fallback when key is missing", () => {
      expect(loadSessionState("nonexistent", "default")).toBe("default");
    });

    it("returns fallback on invalid JSON", () => {
      sessionStorage.setItem("key", "not valid json{{{");
      expect(loadSessionState("key", "fallback")).toBe("fallback");
    });
  });

  describe("persistSessionState", () => {
    it("stores serialized value", () => {
      persistSessionState("key", { x: 1 });
      expect(sessionStorage.getItem("key")).toBe('{"x":1}');
    });
  });

  describe("round-trip", () => {
    it("persist then load returns same value", () => {
      const data = { messages: [1, 2, 3], phase: "explain" };
      persistSessionState("session", data);
      expect(loadSessionState("session", null)).toEqual(data);
    });
  });
});
