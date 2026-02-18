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


def explain_concept(agent: Agent, topic: str, skill_level: float, context: str = "") -> str:
    skill_desc = "beginner" if skill_level < 30 else "intermediate" if skill_level < 70 else "advanced"

    description = (
        f"Explain the concept of '{topic}' to a {skill_desc} level student "
        f"(skill score: {skill_level}/100). "
    )
    if context:
        description += f"Additional context from previous sessions: {context}. "
    description += (
        "Provide a clear, structured explanation with examples. "
        "If the student is a beginner, start with fundamentals and use analogies. "
        "If intermediate or advanced, go deeper into nuances and edge cases."
    )

    task = Task(
        description=description,
        expected_output=(
            "A clear, well-structured explanation of the concept with examples "
            "and analogies appropriate to the student's level."
        ),
        agent=agent,
    )
    result = agent.execute_task(task)
    return str(result)
