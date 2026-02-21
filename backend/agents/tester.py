import json
from crewai import Agent, Task
from backend.config import MODEL_STRONG
from backend.models.schemas import TesterEvaluation


def create_tester_agent() -> Agent:
    return Agent(
        role="Knowledge Evaluator",
        goal=(
            "Evaluate the user's understanding of CS concepts by analyzing their "
            "teaching explanations. Provide accurate skill scores, identify specific "
            "knowledge gaps, and determine whether the user has achieved mastery."
        ),
        backstory=(
            "You are a rigorous but fair academic evaluator. You assess understanding "
            "by analyzing how well someone can teach a concept — not just recall facts. "
            "You look for: accuracy, completeness, ability to explain 'why' not just 'what', "
            "handling of edge cases, and use of correct terminology. "
            "You always provide constructive, specific feedback."
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
            f"Evaluate the user's understanding of '{topic}' based on their teaching session.\n\n"
            f"Full conversation:\n{history_text}\n\n"
            f"Previous skill score: {previous_score}/100.\n\n"
            "Analyze the user's explanations for:\n"
            "1. Factual accuracy\n"
            "2. Completeness (did they cover key aspects?)\n"
            "3. Depth of understanding (can they explain 'why', not just 'what'?)\n"
            "4. Handling of edge cases and nuances\n"
            "5. Use of correct terminology\n\n"
            "You MUST respond with ONLY valid JSON in this exact format:\n"
            '{"score": <0-100>, "gaps": ["gap1", "gap2"], "mastered": <true/false>, "feedback": "..."}\n\n'
            "Set mastered=true only if score >= 80 and no critical gaps remain. "
            "Be specific in gaps — name the exact sub-topics or misconceptions."
        ),
        expected_output=(
            'Valid JSON: {"score": <number>, "gaps": [<strings>], "mastered": <bool>, "feedback": "<string>"}'
        ),
        agent=agent,
    )
    result = str(agent.execute_task(task))
    return _parse_evaluation(result, previous_score)


def generate_mcq(
    agent: Agent,
    topic: str,
    conversation_history: list[dict],
) -> list[dict]:
    """Generate multiple-choice questions for concept mode evaluation."""
    history_text = "\n".join(
        f"[{m.get('agent', 'unknown')}]: {m['content']}" for m in conversation_history[-10:]
    )

    task = Task(
        description=(
            f"Based on the teaching session about '{topic}', generate 4 multiple-choice questions "
            "to test the user's conceptual understanding.\n\n"
            f"Session context:\n{history_text}\n\n"
            "Each question should test a different aspect of the concept discussed. "
            "Include one question that tests understanding of 'why' (not just 'what'). "
            "Include one question about a common misconception.\n\n"
            "You MUST respond with ONLY valid JSON in this exact format:\n"
            '{"questions": [\n'
            '  {"question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct": "A"},\n'
            '  ...\n'
            "]}"
        ),
        expected_output="Valid JSON with 4 multiple-choice questions.",
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
    """Score MCQ answers and return a TesterEvaluation."""
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

    feedback = f"You got {correct}/{total} questions correct."
    if mastered:
        feedback += " Great job — you have a solid understanding!"
    elif score >= 50:
        feedback += " Good effort, but review the missed areas."
    else:
        feedback += " You should revisit this topic for better understanding."

    return TesterEvaluation(
        score=score, gaps=gaps, mastered=mastered, feedback=feedback,
    )


def generate_code_challenge(
    agent: Agent,
    topic: str,
    conversation_history: list[dict],
) -> dict:
    """Generate a coding challenge that applies patterns from the session."""
    history_text = "\n".join(
        f"[{m.get('agent', 'unknown')}]: {m['content']}" for m in conversation_history[-10:]
    )

    task = Task(
        description=(
            f"Based on the teaching session about '{topic}', create a coding problem "
            "that requires the user to apply the patterns discussed.\n\n"
            f"Session context:\n{history_text}\n\n"
            "The problem should:\n"
            "- Require applying the code patterns/templates discussed in the session\n"
            "- Include a clear problem statement\n"
            "- Possibly include a twist or variation from the standard template\n"
            "- Be solvable in 10-30 lines of code\n\n"
            "You MUST respond with ONLY valid JSON in this exact format:\n"
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
) -> TesterEvaluation:
    """Evaluate user's code submission against the challenge."""
    task = Task(
        description=(
            f"Evaluate the user's code solution for this problem about '{topic}':\n\n"
            f"Problem: {challenge.get('problem', topic)}\n\n"
            f"User's code:\n```\n{user_code}\n```\n\n"
            "Evaluate for:\n"
            "1. Correctness — does it solve the stated problem?\n"
            "2. Edge case handling — does it handle empty input, large input, etc.?\n"
            "3. Code quality — is it clean, readable, well-structured?\n"
            "4. Complexity — is the time/space complexity reasonable?\n"
            "5. Pattern application — does it correctly apply the discussed patterns?\n\n"
            "You MUST respond with ONLY valid JSON in this exact format:\n"
            '{"score": <0-100>, "gaps": ["gap1", "gap2"], "mastered": <true/false>, "feedback": "..."}\n\n'
            "Set mastered=true only if score >= 80 and no critical issues."
        ),
        expected_output=(
            'Valid JSON: {"score": <number>, "gaps": [<strings>], "mastered": <bool>, "feedback": "<string>"}'
        ),
        agent=agent,
    )
    result = str(agent.execute_task(task))
    return _parse_evaluation(result, 0)


def _parse_evaluation(result: str, fallback_score: float) -> TesterEvaluation:
    """Parse JSON evaluation response with fallback."""
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
    gaps_text = ", ".join(known_gaps) if known_gaps else "no specific gaps recorded"

    task = Task(
        description=(
            f"Generate 3 smart review questions for the topic '{topic}'.\n"
            f"User's skill level: {skill_level}/100.\n"
            f"Known weak areas: {gaps_text}.\n\n"
            "Create questions that:\n"
            "- Test APPLICATION of knowledge, not just recall\n"
            "- Target the known weak areas if any\n"
            "- Include at least one 'explain why X is wrong' style question\n"
            "- Include at least one scenario/edge-case question\n"
            "- Are appropriate for the user's skill level\n\n"
            "Format each question clearly numbered 1-3."
        ),
        expected_output="3 numbered review questions targeting the user's weak areas.",
        agent=agent,
    )
    result = agent.execute_task(task)
    return str(result)
