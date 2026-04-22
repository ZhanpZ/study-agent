from crewai import Agent, Task
from backend.config import MODEL_PROFESSOR
from backend.utils import format_history, skill_level_label


def create_professor_agent() -> Agent:
    return Agent(
        role="Senior SDE/MLE Professor",
        goal=(
            "Explain CS and ML concepts clearly for SDE/MLE engineers. "
            "Be precise and concise — no filler words, no redundant sentences. "
            "Every sentence must teach something. "
            "Use real production systems as examples. Adapt depth to skill level."
        ),
        backstory=(
            "Staff Engineer from FAANG with deep SDE and MLE experience. "
            "You teach by connecting concepts to real engineering decisions — "
            "system design trade-offs, scaling, and production gotchas. "
            "You never pad explanations with fluff."
        ),
        llm=MODEL_PROFESSOR,
        verbose=False,
        allow_delegation=False,
    )


def explain_concept(
    agent: Agent, topic: str, skill_level: float, context: str = ""
) -> str:
    skill_desc = skill_level_label(skill_level)

    style_rule = (
        "STYLE: Be precise and concise. No filler phrases like 'Let me explain', "
        "'In this section', 'It's worth noting'. Jump straight into the content. "
        "Every sentence must convey information. Use short paragraphs."
    )

    description = (
        f"Explain '{topic}' for a {skill_desc} SDE/MLE ({skill_level}/100).\n\n"
        "Structure your explanation as follows:\n"
        "1. Problem understanding — what the problem is asking\n"
        "2. Brute force approach — naive solution with time/space complexity\n"
        "3. Optimal approach — the canonical solution with full Python code\n"
        "4. 1-2 alternative approaches with trade-offs and complexity\n"
        "5. Pattern classification (e.g. sliding window, two pointers, BFS/DFS, DP, union-find)\n"
        "6. Common pitfalls and edge cases\n\n"
        "IMPORTANT: Explicitly state the time and space complexity for every approach. "
        "This grounding is used later to evaluate the student's understanding.\n\n"
        "Use Python. Markdown code blocks.\n\n"
        f"{style_rule}"
    )
    if context:
        description += f"\nPrior session context: {context}"

    task = Task(
        description=description,
        expected_output="Algorithm explanation with canonical solutions, complexity analysis, and patterns.",
        agent=agent,
    )
    result = agent.execute_task(task)
    return str(result)


def answer_followup(
    agent: Agent, topic: str, question: str,
    conversation_history: list[dict], skill_level: float,
) -> str:
    history_text = format_history(conversation_history)
    skill_desc = skill_level_label(skill_level)

    task = Task(
        description=(
            f"Teaching '{topic}' to a {skill_desc} SDE/MLE ({skill_level}/100).\n\n"
            f"Conversation so far:\n{history_text}\n\n"
            f"Follow-up question: \"{question}\"\n\n"
            "Answer directly. Don't repeat prior explanation. "
            "Use algorithm examples and complexity analysis.\n\n"
            "STYLE: Be precise and concise. No filler. Every sentence must teach."
        ),
        expected_output="Direct answer to the follow-up question.",
        agent=agent,
    )
    return str(agent.execute_task(task))


def generate_summary(
    agent: Agent, topic: str, conversation_history: list[dict],
) -> str:
    history_text = format_history(conversation_history, limit=None)

    task = Task(
        description=(
            f"Generate study notes for '{topic}' from this session:\n\n"
            f"{history_text}\n\n"
            "Format as markdown with these REQUIRED sections:\n"
            "## Algorithm Pattern\n"
            "## Time/Space Complexity\n"
            "## Key Design Choices\n"
            "## Tricks & Insights\n"
            "## Edge Cases\n\n"
            "Use bullet points, headers, code blocks. "
            "Under 500 words. No filler — only key takeaways."
        ),
        expected_output="Concise markdown study notes.",
        agent=agent,
    )
    return str(agent.execute_task(task))
