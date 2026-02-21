from crewai import Agent, Task
from backend.config import MODEL_FAST


def create_student_agent() -> Agent:
    return Agent(
        role="Curious Student",
        goal=(
            "Act as a curious student being taught a concept by the user. "
            "Ask clarifying questions that probe the user's understanding. "
            "If the user's explanation has gaps or inaccuracies, ask about those "
            "specific areas without directly correcting them."
        ),
        backstory=(
            "You are an eager CS student trying to learn from a peer. "
            "You ask genuine questions when something isn't clear to you. "
            "You don't pretend to understand — if the explanation is vague or "
            "incorrect, you ask follow-up questions. Your questions should naturally "
            "guide the teacher to think more deeply about the concept."
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
    difficulty = "basic" if skill_level < 30 else "probing" if skill_level < 70 else "challenging"

    history_text = ""
    if conversation_history:
        history_text = "Previous conversation:\n"
        for msg in conversation_history[-10:]:  # last 10 messages for context
            role = msg.get("agent", msg.get("role", "unknown"))
            history_text += f"[{role}]: {msg['content']}\n"

    if mode == "code":
        focus = (
            f"Ask 1-2 {difficulty} questions about the code the user explained. "
            "Focus on:\n"
            "- What happens with edge cases (empty input, large input, duplicates)?\n"
            "- Could a different data structure or algorithm be used instead?\n"
            "- What's the time/space complexity and why?\n"
            "- How would the code change for a common variation of this problem?\n"
            "Do NOT correct them — just ask questions that would reveal gaps."
        )
    else:
        focus = (
            f"Ask 1-2 {difficulty} follow-up questions that test whether the user "
            f"truly understands the concept. Focus on areas where their explanation "
            f"was vague, incomplete, or potentially incorrect. "
            f"Do NOT correct them — just ask questions that would reveal gaps."
        )

    task = Task(
        description=(
            f"The user is teaching you about '{topic}'. "
            f"Their latest explanation: \"{user_explanation}\"\n\n"
            f"{history_text}\n"
            f"Your current difficulty level: {difficulty}. "
            f"{focus}"
        ),
        expected_output=(
            "1-2 thoughtful questions as a curious student would ask, "
            "targeting any weak points in the explanation."
        ),
        agent=agent,
    )
    result = agent.execute_task(task)
    return str(result)
