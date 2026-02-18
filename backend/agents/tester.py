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

    # Parse the JSON response, with fallback
    try:
        # Extract JSON from the response (agent might add extra text)
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
            score=previous_score,
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
