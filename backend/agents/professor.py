from crewai import Agent, Task
from backend.config import MODEL_FAST


def create_professor_agent() -> Agent:
    return Agent(
        role="Professor",
        goal=(
            "Explain computer science concepts clearly and thoroughly. "
            "Adapt your explanation depth based on the student's current skill level. "
            "Use analogies, examples, and step-by-step breakdowns."
        ),
        backstory=(
            "You are an experienced CS professor who is passionate about teaching. "
            "You have a gift for making complex topics accessible through clear analogies "
            "and real-world examples. You adjust your teaching style based on the learner's "
            "background and current understanding."
        ),
        llm=MODEL_FAST,
        verbose=False,
        allow_delegation=False,
    )


def explain_concept(
    agent: Agent, topic: str, skill_level: float,
    context: str = "", mode: str = "concept"
) -> str:
    skill_desc = "beginner" if skill_level < 30 else "intermediate" if skill_level < 70 else "advanced"

    if mode == "code":
        description = (
            f"Provide a code-focused explanation of '{topic}' for a {skill_desc} level student "
            f"(skill score: {skill_level}/100).\n\n"
            "Include:\n"
            "1. A clean, well-commented code template showing the standard implementation\n"
            "2. 2-3 common variations for solving related problems\n"
            "3. Time/space complexity analysis for each variation\n"
            "4. Common pitfalls and edge cases in the code\n\n"
            "Use Python for code examples unless the topic is language-specific. "
            "Format code in proper markdown code blocks."
        )
        if context:
            description += f"\nAdditional context from previous sessions: {context}. "
        expected = (
            "A code-focused explanation with clean templates, variations, "
            "complexity analysis, and common pitfalls."
        )
    else:
        description = (
            f"Explain the concept of '{topic}' to a {skill_desc} level student "
            f"(skill score: {skill_level}/100). "
        )
        if context:
            description += f"Additional context from previous sessions: {context}. "
        description += (
            "Provide a clear, structured explanation with examples. "
            "Use strong analogies and real-world comparisons to build intuition. "
            "If the student is a beginner, start with fundamentals and use analogies. "
            "If intermediate or advanced, go deeper into nuances and edge cases."
        )
        expected = (
            "A clear, well-structured explanation of the concept with examples "
            "and analogies appropriate to the student's level."
        )

    task = Task(
        description=description,
        expected_output=expected,
        agent=agent,
    )
    result = agent.execute_task(task)
    return str(result)


def generate_summary(
    agent: Agent, topic: str, conversation_history: list[dict], mode: str = "concept"
) -> str:
    """Generate clean study notes from a completed session."""
    history_text = "\n".join(
        f"[{m.get('agent', 'unknown')}]: {m['content']}" for m in conversation_history
    )

    if mode == "code":
        format_instruction = (
            "Include: key implementation patterns, code snippets with explanations, "
            "complexity analysis, common pitfalls, and edge cases discussed."
        )
    else:
        format_instruction = (
            "Include: key concepts explained, analogies used, important relationships, "
            "and any gaps the student should revisit."
        )

    task = Task(
        description=(
            f"Generate clean, concise study notes for the topic '{topic}' based on this session:\n\n"
            f"{history_text}\n\n"
            f"Format as clean markdown study notes. {format_instruction}\n"
            "Use bullet points, headers, and code blocks where appropriate. "
            "Keep it under 500 words — focus on the most important takeaways."
        ),
        expected_output="Clean markdown study notes summarizing the session.",
        agent=agent,
    )
    return str(agent.execute_task(task))
