import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MCQPanel from "../components/MCQPanel";

const questions = [
  {
    question: "What is the time complexity of binary search?",
    options: ["A) O(n)", "B) O(log n)", "C) O(n^2)"],
    correct: "B",
  },
  {
    question: "Which data structure backs a hash map?",
    options: ["A) Array", "B) Linked list", "C) Bucket array"],
    correct: "C",
  },
];

describe("MCQPanel — interactive quiz mode", () => {
  it("disables submit until every question is answered", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<MCQPanel questions={questions} onSubmit={onSubmit} submittedAnswers={null} />);

    const submitBtn = screen.getByRole("button", { name: /submit answers/i });
    expect(submitBtn).toBeDisabled();

    await user.click(screen.getByText("O(log n)"));
    expect(submitBtn).toBeDisabled();

    await user.click(screen.getByText("Bucket array"));
    expect(submitBtn).toBeEnabled();
  });

  it("calls onSubmit with the selected letter for each question in order", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<MCQPanel questions={questions} onSubmit={onSubmit} submittedAnswers={null} />);

    await user.click(screen.getByText("O(log n)"));
    await user.click(screen.getByText("Bucket array"));
    await user.click(screen.getByRole("button", { name: /submit answers/i }));

    expect(onSubmit).toHaveBeenCalledWith(["B", "C"]);
  });

  it("shows the answered count as selections are made", async () => {
    const user = userEvent.setup();
    render(<MCQPanel questions={questions} onSubmit={vi.fn()} submittedAnswers={null} />);

    expect(screen.getByText("0/2 answered")).toBeInTheDocument();
    await user.click(screen.getByText("O(log n)"));
    expect(screen.getByText("1/2 answered")).toBeInTheDocument();
  });
});

describe("MCQPanel — results mode", () => {
  it("shows the correct score and disables option buttons", () => {
    render(
      <MCQPanel
        questions={questions}
        onSubmit={vi.fn()}
        submittedAnswers={{ 0: "B", 1: "A" }}
      />
    );

    expect(screen.getByText("1/2 correct")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit answers/i })).not.toBeInTheDocument();
    for (const btn of screen.getAllByRole("button")) {
      expect(btn).toBeDisabled();
    }
  });

  it("labels the user's wrong answer distinctly from the correct answer", () => {
    render(
      <MCQPanel
        questions={questions}
        onSubmit={vi.fn()}
        submittedAnswers={{ 0: "B", 1: "A" }}
      />
    );

    expect(screen.getByText("Your answer")).toBeInTheDocument();
    expect(screen.getByText("Correct answer")).toBeInTheDocument();
  });
});
