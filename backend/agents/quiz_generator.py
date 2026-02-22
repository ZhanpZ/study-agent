import json
from crewai import Agent, Task
from backend.config import MODEL_STRONG


def create_quiz_agent() -> Agent:
    return Agent(
        role="Algorithm Selection Quiz Master",
        goal=(
            "Generate algorithm selection quiz questions where the user must "
            "identify the correct algorithm/approach for a given problem description. "
            "Create realistic problem descriptions with constraints, like real "
            "coding interview or Leetcode problems."
        ),
        backstory=(
            "You are an expert competitive programmer and tech interviewer who designs "
            "algorithm selection problems. You create problem descriptions that are "
            "realistic, have clear constraints, and require the solver to identify "
            "the best algorithmic approach. You know all common patterns: sliding window, "
            "two pointers, BFS/DFS, DP, binary search, greedy, union find, etc."
        ),
        llm=MODEL_STRONG,
        verbose=False,
        allow_delegation=False,
    )


def generate_algorithm_quiz(
    agent: Agent,
    topic_scope: str = "all",
    num_questions: int = 5,
) -> list[dict]:
    """Generate algorithm selection quiz questions.

    Each question presents a problem and asks which algorithm to use.
    """
    scope_text = (
        "covering all algorithm/data structure topics"
        if topic_scope == "all"
        else f"focused on {topic_scope} algorithms and patterns"
    )

    task = Task(
        description=(
            f"Generate {num_questions} algorithm selection quiz questions {scope_text}.\n\n"
            "For each question, provide:\n"
            "1. A problem description (like a leetcode problem statement)\n"
            "2. An example with input/output\n"
            "3. Constraints (input size, value ranges)\n"
            "4. 4 algorithm/approach choices\n"
            "5. The correct answer letter\n"
            "6. An explanation of why that algorithm is the best fit\n\n"
            "The choices should include plausible-but-wrong approaches that a student "
            "might mistakenly choose. Make the problems varied in difficulty.\n\n"
            "You MUST respond with ONLY valid JSON in this format:\n"
            '{"questions": [\n'
            '  {\n'
            '    "problem": "Full problem description...",\n'
            '    "example": "Input: ... Output: ...",\n'
            '    "constraints": "1 <= n <= 10^5, ...",\n'
            '    "options": ["A) BFS", "B) Binary Search", "C) DP", "D) Greedy"],\n'
            '    "correct": "B",\n'
            '    "explanation": "Why this is the best approach..."\n'
            "  }\n"
            "]}"
        ),
        expected_output=f"Valid JSON with {num_questions} algorithm selection quiz questions.",
        agent=agent,
    )
    result = str(agent.execute_task(task))

    try:
        json_start = result.index("{")
        json_end = result.rindex("}") + 1
        data = json.loads(result[json_start:json_end])
        return data.get("questions", [])
    except (json.JSONDecodeError, ValueError):
        return []
