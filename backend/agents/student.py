from crewai import Agent, Task
from backend.config import MODEL_FAST


def create_student_agent() -> Agent:
    return Agent(
        role="Curious Junior SDE/MLE",
        goal=(
            "Act as a curious junior SDE/MLE being taught a concept by a peer. "
            "Ask clarifying questions that probe the user's understanding. "
            "Frame your questions around how this applies in production, "
            "what trade-offs exist, or how you'd use this in a real codebase. "
            "If the user's explanation has gaps or inaccuracies, ask about those "
            "specific areas without directly correcting them."
        ),
        backstory=(
            "You are a junior engineer at a tech company, eager to learn from a more "
            "senior colleague. You ask questions a real teammate would ask: "
            "'How does this scale?', 'What happens in production when X?', "
            "'Would this approach work for our ML pipeline?'. "
            "You don't pretend to understand — if the explanation is vague or "
            "incorrect, you ask follow-up questions."
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

    if mode == "industrial":
        focus = (
            f"Ask 1-2 {difficulty} questions about the production code the user explained. "
            "Focus on:\n"
            "- How would this scale to millions of requests?\n"
            "- What happens when this component fails in production?\n"
            "- Are there better design patterns for this use case?\n"
            "- How would you test this in a CI/CD pipeline?\n"
            "- What are the observability/monitoring implications?\n"
            "Do NOT correct them — just ask questions that would reveal gaps."
        )
    elif mode == "leetcode":
        focus = (
            f"Ask 1-2 {difficulty} questions about the algorithm the user explained. "
            "Focus on:\n"
            "- What happens with edge cases (empty input, large input, duplicates)?\n"
            "- Could a different algorithm or data structure give better complexity?\n"
            "- What's the exact time/space complexity and why?\n"
            "- What pattern does this problem belong to?\n"
            "- How would the approach change if the constraints were different?\n"
            "Do NOT correct them — just ask questions that would reveal gaps."
        )
    else:
        focus = (
            f"Ask 1-2 {difficulty} follow-up questions that test whether the user "
            f"truly understands the concept as it applies in SDE/MLE work. "
            f"Focus on areas where their explanation was vague, incomplete, or "
            f"potentially incorrect. Ask about real-world implications, system design "
            f"trade-offs, or production scenarios. "
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
            "1-2 thoughtful questions as a curious junior SDE/MLE would ask, "
            "targeting any weak points in the explanation."
        ),
        agent=agent,
    )
    result = agent.execute_task(task)
    return str(result)
