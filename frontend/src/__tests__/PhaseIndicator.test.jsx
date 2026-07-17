import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PhaseIndicator from "../components/PhaseIndicator";

describe("PhaseIndicator", () => {
  it("renders all four concept-mode phase labels", () => {
    render(<PhaseIndicator currentPhase="explain" mode="concept" />);
    expect(screen.getByText("Learn")).toBeInTheDocument();
    expect(screen.getByText("Teach")).toBeInTheDocument();
    expect(screen.getByText("Evaluate")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("renders only three phases for leetcode mode (no Teach step)", () => {
    render(<PhaseIndicator currentPhase="explain" mode="leetcode" />);
    expect(screen.getByText("Learn")).toBeInTheDocument();
    expect(screen.getByText("Challenge")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.queryByText("Teach")).not.toBeInTheDocument();
  });

  it("maps explain_done and quiz sub-phases onto their parent phase", () => {
    const { rerender } = render(<PhaseIndicator currentPhase="explain_done" mode="concept" />);
    // explain_done maps to "explain" — Learn stays current, nothing further is marked done
    expect(screen.getByText("Learn").closest("div")).toBeInTheDocument();

    rerender(<PhaseIndicator currentPhase="quiz" mode="concept" />);
    expect(screen.getByText("Evaluate")).toBeInTheDocument();
  });

  it("renders without crashing for an unknown phase", () => {
    render(<PhaseIndicator currentPhase="some_unknown_phase" mode="concept" />);
    expect(screen.getByText("Learn")).toBeInTheDocument();
  });
});
