import json
from crewai import Agent, Task
from backend.config import MODEL_STRONG
from backend.models.schemas import TesterEvaluation


def create_tester_agent() -> Agent:
    return Agent(
        role="SDE/MLE Knowledge Evaluator",
        goal=(
            "Evaluate understanding of CS/ML concepts from an SDE/MLE readiness perspective. "
            "Assess whether the user could explain this in a design review or interview. "
            "Provide accurate scores, specific gaps, and mastery determination."
        ),
        backstory=(
            "Rigorous but fair tech lead who evaluates by analyzing teaching quality — "
            "not recall. You check: accuracy, completeness, 'why' not just 'what', "
            "edge cases, correct terminology. Always give specific, actionable feedback."
        ),
        llm=MODEL_STRONG,
        verbose=False,
        allow_delegation=False,
    )


def evaluate_understanding(
    agent: Agent,
    topic: str,
    conversation_history: list[dict],
    previous_score: float,
) -> TesterEvaluation:
    history_text = ""
    for msg in conversation_history:
        role = msg.get("agent", msg.get("role", "unknown"))
        history_text += f"[{role}]: {msg['content']}\n"

    task = Task(
        description=(
            f"Evaluate understanding of '{topic}' from this teaching session.\n\n"
            f"Conversation:\n{history_text}\n\n"
            f"Previous score: {previous_score}/100.\n\n"
            "Criteria:\n"
            "1. Factual accuracy\n"
            "2. Completeness\n"
            "3. Depth ('why' not just 'what')\n"
            "4. Edge cases and nuances\n"
            "5. Correct terminology\n"
            "6. SDE/MLE applicability\n\n"
            "Respond with ONLY valid JSON:\n"
            '{"score": <0-100>, "gaps": ["gap1", "gap2"], "mastered": <true/false>, "feedback": "..."}\n\n'
            "mastered=true only if score >= 80 with no critical gaps. "
            "Be specific in gaps — name exact sub-topics or misconceptions."
        ),
        expected_output='Valid JSON: {"score": <number>, "gaps": [...], "mastered": <bool>, "feedback": "..."}',
        agent=agent,
    )
    result = str(agent.execute_task(task))
    return _parse_evaluation(result, previous_score)


def generate_mcq(
    agent: Agent,
    topic: str,
    conversation_history: list[dict],
) -> list[dict]:
    history_text = "\n".join(
        f"[{m.get('agent', 'unknown')}]: {m['content']}" for m in conversation_history[-10:]
    )

    task = Task(
        description=(
            f"Generate 4 MCQs to test understanding of '{topic}' for SDE/MLE.\n\n"
            f"Session context:\n{history_text}\n\n"
            "Requirements:\n"
            "- Each tests a different aspect\n"
            "- One tests 'why' (not just 'what')\n"
            "- One tests a common misconception in production/interviews\n"
            "- Frame as real engineering decisions\n\n"
            "Respond with ONLY valid JSON:\n"
            '{"questions": [\n'
            '  {"question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct": "A"},\n'
            "  ...\n]}"
        ),
        expected_output="Valid JSON with 4 MCQs.",
        agent=agent,
    )
    result = str(agent.execute_task(task))

    try:
        json_start = result.index("{")
        json_end = result.rindex("}") + 1
        data = json.loads(result[json_start:json_end])
        return data.get("questions", [])
    except (json.JSONDecodeError, ValueError):
        return [
            {
                "question": f"What is the key concept behind {topic}?",
                "options": [
                    "A) It is a fundamental CS concept",
                    "B) It is not related to CS",
                    "C) It is only theoretical",
                    "D) None of the above",
                ],
                "correct": "A",
            }
        ]


def score_mcq(questions: list[dict], answers: list[str]) -> TesterEvaluation:
    if not questions:
        return TesterEvaluation(
            score=0, gaps=["No questions available"], mastered=False,
            feedback="Could not generate questions.",
        )

    correct = 0
    total = len(questions)
    gaps = []

    for i, q in enumerate(questions):
        user_answer = answers[i] if i < len(answers) else ""
        expected = q.get("correct", "")
        if user_answer.upper().strip() == expected.upper().strip():
            correct += 1
        else:
            gaps.append(f"Missed: {q['question']}")

    score = round((correct / total) * 100)
    mastered = score >= 80 and len(gaps) <= 1

    feedback = f"You got {correct}/{total} correct."
    if mastered:
        feedback += " Solid understanding."
    elif score >= 50:
        feedback += " Review the missed areas."
    else:
        feedback += " Revisit this topic."

    return TesterEvaluation(
        score=score, gaps=gaps, mastered=mastered, feedback=feedback,
    )


def generate_code_challenge(
    agent: Agent,
    topic: str,
    conversation_history: list[dict],
    mode: str = "leetcode",
) -> dict:
    history_text = "\n".join(
        f"[{m.get('agent', 'unknown')}]: {m['content']}" for m in conversation_history[-10:]
    )

    if mode == "industrial":
        problem_instruction = (
            "Requirements:\n"
            "- Design a clean class, API, or module\n"
            "- Test understanding of discussed design patterns\n"
            "- Include error handling and edge cases\n"
            "- Solvable in 20-40 lines of production code\n"
        )
    else:  # leetcode
        problem_instruction = (
            "Requirements:\n"
            "- Apply algorithm patterns from the session\n"
            "- Clear problem statement with input/output format\n"
            "- Include a twist from the standard template\n"
            "- Solvable in 10-30 lines\n"
        )

    task = Task(
        description=(
            f"Create a coding problem about '{topic}' based on the session.\n\n"
            f"Session context:\n{history_text}\n\n"
            f"{problem_instruction}\n"
            "Respond with ONLY valid JSON:\n"
            '{"problem": "Full problem statement...", "hints": ["hint1", "hint2"]}'
        ),
        expected_output='Valid JSON: {"problem": "...", "hints": ["..."]}',
        agent=agent,
    )
    result = str(agent.execute_task(task))

    try:
        json_start = result.index("{")
        json_end = result.rindex("}") + 1
        data = json.loads(result[json_start:json_end])
        return {
            "problem": data.get("problem", f"Write a solution related to {topic}"),
            "hints": data.get("hints", []),
        }
    except (json.JSONDecodeError, ValueError):
        return {
            "problem": f"Write a complete implementation of {topic} in Python.",
            "hints": ["Think about edge cases", "Consider time complexity"],
        }


def evaluate_code(
    agent: Agent,
    topic: str,
    challenge: dict,
    user_code: str,
    conversation_history: list[dict],
    mode: str = "leetcode",
) -> TesterEvaluation:
    if mode == "industrial":
        criteria = (
            "1. Correctness\n"
            "2. Architecture and abstractions\n"
            "3. Design patterns (SOLID, etc.)\n"
            "4. Error handling\n"
            "5. Production readiness\n"
        )
    else:  # leetcode
        criteria = (
            "1. Correctness\n"
            "2. Edge case handling\n"
            "3. Code quality\n"
            "4. Time/space complexity optimality\n"
            "5. Pattern application\n"
        )

    task = Task(
        description=(
            f"Evaluate code solution for '{topic}':\n\n"
            f"Problem: {challenge.get('problem', topic)}\n\n"
            f"Code:\n```\n{user_code}\n```\n\n"
            f"Criteria:\n{criteria}\n"
            "Respond with ONLY valid JSON:\n"
            '{"score": <0-100>, "gaps": ["gap1", "gap2"], "mastered": <true/false>, "feedback": "..."}\n\n'
            "mastered=true only if score >= 80 with no critical issues."
        ),
        expected_output='Valid JSON: {"score": <number>, "gaps": [...], "mastered": <bool>, "feedback": "..."}',
        agent=agent,
    )
    result = str(agent.execute_task(task))
    return _parse_evaluation(result, 0)


def generate_comprehension_mcqs(
    agent: Agent,
    topic: str,
    explanation: str,
) -> list[dict]:
    explanation_len = len(explanation)
    if explanation_len < 500:
        num_questions = 2
    elif explanation_len < 1500:
        num_questions = 3
    else:
        num_questions = min(5, 3 + (explanation_len - 1500) // 1000)

    task = Task(
        description=(
            f"Generate {num_questions} comprehension-check MCQs for '{topic}' "
            f"based on this explanation:\n\n{explanation}\n\n"
            "These are comprehension checks, not evaluation. "
            "Test understanding of specific points from the explanation. "
            "Straightforward but not trivial. SDE/MLE context.\n\n"
            "Respond with ONLY valid JSON:\n"
            '{"questions": [\n'
            '  {"question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], '
            '"correct": "A", "explanation": "Why this is correct"},\n'
            "  ...\n]}"
        ),
        expected_output=f"Valid JSON with {num_questions} comprehension MCQs.",
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


def _parse_evaluation(result: str, fallback_score: float) -> TesterEvaluation:
    try:
        json_start = result.index("{")
        json_end = result.rindex("}") + 1
        data = json.loads(result[json_start:json_end])
        return TesterEvaluation(
            score=max(0, min(100, float(data.get("score", 0)))),
            gaps=data.get("gaps", []),
            mastered=data.get("mastered", False),
            feedback=data.get("feedback", ""),
        )
    except (json.JSONDecodeError, ValueError):
        return TesterEvaluation(
            score=fallback_score,
            gaps=["Unable to parse evaluation — please continue teaching"],
            mastered=False,
            feedback=result,
        )


def generate_review_questions(
    agent: Agent,
    topic: str,
    skill_level: float,
    known_gaps: list[str],
) -> str:
    gaps_text = ", ".join(known_gaps) if known_gaps else "none recorded"

    task = Task(
        description=(
            f"Generate 3 review questions for '{topic}'.\n"
            f"Skill: {skill_level}/100. Weak areas: {gaps_text}.\n\n"
            "Requirements:\n"
            "- Test APPLICATION in SDE/MLE contexts, not recall\n"
            "- Target known weak areas\n"
            "- Include one 'explain why X is wrong' question\n"
            "- Include one scenario/edge-case question\n"
            "- Match skill level\n\n"
            "Format: numbered 1-3. Be concise."
        ),
        expected_output="3 numbered review questions targeting weak areas.",
        agent=agent,
    )
    result = agent.execute_task(task)
    return str(result)
