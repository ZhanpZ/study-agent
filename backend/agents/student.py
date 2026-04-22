from crewai import Agent, Task
from backend.config import MODEL_FAST
from backend.utils import format_history, skill_level_label


def create_student_agent() -> Agent:
    return Agent(
        role="Curious Junior SDE/MLE",
        goal=(
            "Act as a junior SDE/MLE being taught by a peer. "
            "Ask 1-2 sharp questions that probe understanding gaps. "
            "Focus on production applicability and trade-offs. "
            "Never correct the user — only ask questions that reveal gaps."
        ),
        backstory=(
            "Junior engineer at a tech company. You ask questions a real teammate would: "
            "'How does this scale?', 'What happens in production when X fails?'. "
            "If the explanation is vague or wrong, you ask pointed follow-ups."
        ),
        llm=MODEL_FAST,
        verbose=False,
        allow_delegation=False,
    )


def ask_questions(
    agent: Agent,
    topic: str,
    user_explanation: str,
    conversation_history: list[dict],
    skill_level: float,
    mode: str = "concept",
) -> str:
    difficulty = skill_level_label(skill_level, "basic", "probing", "challenging")
    history_text = format_history(conversation_history, limit=10)

    if mode == "industrial":
        focus = (
            f"Ask 1-2 {difficulty} questions about the production code. "
            "Target: scaling, failure modes, design patterns, testing, observability. "
            "Do NOT correct — only ask questions that reveal gaps."
        )
    elif mode == "leetcode":
        focus = (
            f"Ask 1-2 {difficulty} questions about the algorithm. "
            "Target: edge cases, alternative algorithms, exact complexity, pattern classification. "
            "Do NOT correct — only ask questions that reveal gaps."
        )
    else:
        focus = (
            f"Ask 1-2 {difficulty} questions testing real understanding for SDE/MLE work. "
            "Target vague or incomplete areas. Ask about real-world implications. "
            "Do NOT correct — only ask questions that reveal gaps."
        )

    task = Task(
        description=(
            f"User is teaching you about '{topic}'. "
            f"Their explanation: \"{user_explanation}\"\n\n"
            f"{history_text}\n"
            f"Difficulty: {difficulty}. {focus}\n\n"
            "STYLE: Ask concise, pointed questions. No preamble or pleasantries."
        ),
        expected_output="1-2 sharp questions targeting weak points in the explanation.",
        agent=agent,
    )
    result = agent.execute_task(task)
    return str(result)
