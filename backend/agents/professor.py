from crewai import Agent, Task
from backend.config import MODEL_PROFESSOR


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
    agent: Agent, topic: str, skill_level: float,
    context: str = "", mode: str = "concept"
) -> str:
    skill_desc = "beginner" if skill_level < 30 else "intermediate" if skill_level < 70 else "advanced"

    style_rule = (
        "STYLE: Be precise and concise. No filler phrases like 'Let me explain', "
        "'In this section', 'It's worth noting'. Jump straight into the content. "
        "Every sentence must convey information. Use short paragraphs."
    )

    if mode == "industrial":
        description = (
            f"Explain '{topic}' for a {skill_desc} SDE/MLE ({skill_level}/100).\n\n"
            "Cover:\n"
            "1. Production-quality implementation with clean architecture\n"
            "2. Relevant design patterns (SOLID, GoF)\n"
            "3. API design and interface contracts\n"
            "4. Error handling and observability\n"
            "5. How this fits into larger system architectures\n"
            "6. Testing strategies\n\n"
            "Use Python. Show production-grade code, not toy examples. "
            f"Use markdown code blocks.\n\n{style_rule}"
        )
        if context:
            description += f"\nPrior session context: {context}"
        expected = "Production-focused explanation with clean code and design patterns."

    elif mode == "leetcode":
        description = (
            f"Explain '{topic}' for a {skill_desc} SDE/MLE ({skill_level}/100).\n\n"
            "Cover:\n"
            "1. Clean canonical solution\n"
            "2. 2-3 alternative approaches with trade-offs\n"
            "3. Time/space complexity for EACH approach\n"
            "4. Pattern classification (sliding window, two pointers, BFS/DFS, DP, etc.)\n"
            "5. Common pitfalls and edge cases\n"
            "6. Problem-specific tricks\n\n"
            f"Use Python. Markdown code blocks.\n\n{style_rule}"
        )
        if context:
            description += f"\nPrior session context: {context}"
        expected = "Algorithm explanation with solutions, complexity analysis, and patterns."

    else:  # concept
        description = (
            f"Explain '{topic}' for a {skill_desc} SDE/MLE ({skill_level}/100). "
            "Connect to real production systems, design decisions, and engineering scenarios. "
        )
        if context:
            description += f"Prior session context: {context}. "
        description += (
            "Use analogies from real systems (distributed services, ML pipelines, databases). "
            "Beginners: start with fundamentals + analogies. "
            f"Intermediate/advanced: go into nuances and edge cases.\n\n{style_rule}"
        )
        expected = "Clear concept explanation with examples, framed for SDE/MLE work."

    task = Task(
        description=description,
        expected_output=expected,
        agent=agent,
    )
    result = agent.execute_task(task)
    return str(result)


def answer_followup(
    agent: Agent, topic: str, question: str,
    conversation_history: list[dict], skill_level: float, mode: str = "concept"
) -> str:
    history_text = "\n".join(
        f"[{m.get('agent', 'unknown')}]: {m['content']}" for m in conversation_history
    )
    skill_desc = "beginner" if skill_level < 30 else "intermediate" if skill_level < 70 else "advanced"

    if mode == "industrial":
        mode_hint = "Use production code examples. Connect to system design."
    elif mode == "leetcode":
        mode_hint = "Use algorithm examples and complexity analysis."
    else:
        mode_hint = "Use analogies and real-world engineering examples."

    task = Task(
        description=(
            f"Teaching '{topic}' to a {skill_desc} SDE/MLE ({skill_level}/100).\n\n"
            f"Conversation so far:\n{history_text}\n\n"
            f"Follow-up question: \"{question}\"\n\n"
            "Answer directly. Don't repeat prior explanation. "
            f"{mode_hint}\n\n"
            "STYLE: Be precise and concise. No filler. Every sentence must teach."
        ),
        expected_output="Direct answer to the follow-up question.",
        agent=agent,
    )
    return str(agent.execute_task(task))


def generate_summary(
    agent: Agent, topic: str, conversation_history: list[dict], mode: str = "concept"
) -> str:
    history_text = "\n".join(
        f"[{m.get('agent', 'unknown')}]: {m['content']}" for m in conversation_history
    )

    if mode == "industrial":
        format_instruction = (
            "Include: design patterns used, architecture decisions, "
            "production considerations, testing strategies, gaps to revisit."
        )
    elif mode == "leetcode":
        format_instruction = (
            "REQUIRED sections:\n"
            "## Algorithm Pattern\n"
            "## Time/Space Complexity\n"
            "## Key Design Choices\n"
            "## Tricks & Insights\n"
            "## Edge Cases"
        )
    else:
        format_instruction = (
            "Include: key concepts, analogies used, important relationships, "
            "gaps to revisit."
        )

    task = Task(
        description=(
            f"Generate study notes for '{topic}' from this session:\n\n"
            f"{history_text}\n\n"
            f"Format as markdown. {format_instruction}\n"
            "Use bullet points, headers, code blocks. "
            "Under 500 words. No filler — only key takeaways."
        ),
        expected_output="Concise markdown study notes.",
        agent=agent,
    )
    return str(agent.execute_task(task))
