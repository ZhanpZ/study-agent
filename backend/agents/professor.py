from crewai import Agent, Task
from backend.config import MODEL_PROFESSOR


def create_professor_agent() -> Agent:
    return Agent(
        role="Senior SDE/MLE Professor",
        goal=(
            "Explain computer science and machine learning concepts clearly and thoroughly, "
            "oriented toward Software Development Engineers and Machine Learning Engineers. "
            "Frame everything in terms of real production systems, industry best practices, "
            "and common interview/on-the-job scenarios. "
            "Adapt your explanation depth based on the student's current skill level. "
            "Use analogies from real systems (distributed services, ML pipelines, etc.)."
        ),
        backstory=(
            "You are a Staff Engineer who has worked at top tech companies (FAANG-level) "
            "as both an SDE and MLE. You have deep experience building production systems, "
            "training and deploying ML models, and mentoring junior engineers. "
            "You explain concepts by connecting them to real-world engineering decisions — "
            "system design trade-offs, scaling considerations, and production gotchas. "
            "You adjust your teaching style based on the learner's level."
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

    if mode == "industrial":
        description = (
            f"Provide an industry-focused code explanation of '{topic}' for a {skill_desc} level SDE/MLE "
            f"(skill score: {skill_level}/100).\n\n"
            "Focus on:\n"
            "1. Production-quality implementation with clean architecture\n"
            "2. Design patterns (SOLID, GoF patterns) relevant to this topic\n"
            "3. API design considerations and interface contracts\n"
            "4. Error handling, logging, and observability patterns\n"
            "5. System design implications — how this fits into larger architectures\n"
            "6. Testing strategies (unit tests, integration tests)\n\n"
            "Use Python for code examples unless the topic is language-specific. "
            "Show production-grade code, not toy examples. "
            "Format code in proper markdown code blocks."
        )
        if context:
            description += f"\nAdditional context from previous sessions: {context}. "
        expected = (
            "A production-focused explanation with clean code, design patterns, "
            "system design context, and engineering best practices."
        )
    elif mode == "leetcode":
        description = (
            f"Provide an algorithm-focused explanation of '{topic}' for a {skill_desc} level SDE/MLE "
            f"(skill score: {skill_level}/100).\n\n"
            "Focus on:\n"
            "1. A clean, well-commented canonical solution template\n"
            "2. 2-3 variations/alternative approaches with trade-offs\n"
            "3. Time and space complexity analysis for EACH approach (Big-O)\n"
            "4. Common patterns this belongs to (sliding window, two pointers, BFS/DFS, DP, etc.)\n"
            "5. Common pitfalls, edge cases, and off-by-one errors\n"
            "6. Tips and tricks specific to this problem type\n\n"
            "Use Python for code examples. Format code in proper markdown code blocks."
        )
        if context:
            description += f"\nAdditional context from previous sessions: {context}. "
        expected = (
            "An algorithm-focused explanation with canonical solution, variations, "
            "complexity analysis, pattern identification, and common pitfalls."
        )
    else:  # concept mode
        description = (
            f"Explain the concept of '{topic}' to a {skill_desc} level SDE/MLE "
            f"(skill score: {skill_level}/100). "
            "Frame the explanation for someone working as a Software Development Engineer "
            "or Machine Learning Engineer. Connect the concept to real production systems, "
            "design decisions, and common engineering scenarios. "
        )
        if context:
            description += f"Additional context from previous sessions: {context}. "
        description += (
            "Provide a clear, structured explanation with examples. "
            "Use strong analogies from real systems (distributed services, ML pipelines, databases). "
            "If the student is a beginner, start with fundamentals and use analogies. "
            "If intermediate or advanced, go deeper into nuances and edge cases."
        )
        expected = (
            "A clear, well-structured explanation of the concept with examples "
            "and analogies appropriate to the student's level, framed for SDE/MLE work."
        )

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
    """Answer a follow-up question from the student during the explain phase."""
    history_text = "\n".join(
        f"[{m.get('agent', 'unknown')}]: {m['content']}" for m in conversation_history
    )
    skill_desc = "beginner" if skill_level < 30 else "intermediate" if skill_level < 70 else "advanced"

    if mode == "industrial":
        mode_hint = "Use production code examples where helpful. Connect to system design and engineering best practices."
    elif mode == "leetcode":
        mode_hint = "Use algorithm examples and complexity analysis where helpful. Reference common patterns."
    else:
        mode_hint = "Use analogies and real-world engineering examples."

    task = Task(
        description=(
            f"You are teaching '{topic}' to a {skill_desc} level SDE/MLE "
            f"(skill score: {skill_level}/100).\n\n"
            f"Here is the conversation so far:\n{history_text}\n\n"
            f"The student has a follow-up question:\n\"{question}\"\n\n"
            "Answer their question clearly and thoroughly. "
            "Build on what you already explained — don't repeat your full explanation. "
            f"{mode_hint}"
        ),
        expected_output="A clear, focused answer to the student's follow-up question.",
        agent=agent,
    )
    return str(agent.execute_task(task))


def generate_summary(
    agent: Agent, topic: str, conversation_history: list[dict], mode: str = "concept"
) -> str:
    """Generate clean study notes from a completed session."""
    history_text = "\n".join(
        f"[{m.get('agent', 'unknown')}]: {m['content']}" for m in conversation_history
    )

    if mode == "industrial":
        format_instruction = (
            "Include: key design patterns used, architecture decisions, "
            "production considerations, testing strategies, and any gaps to revisit."
        )
    elif mode == "leetcode":
        format_instruction = (
            "Structure the notes with these REQUIRED sections:\n"
            "## Algorithm Pattern\n"
            "## Time/Space Complexity\n"
            "## Key Design Choices\n"
            "## Tricks & Insights\n"
            "## Edge Cases\n"
            "Include: algorithm pattern identified, all complexity analyses, "
            "data structure choices with reasoning, problem-specific tricks, "
            "and edge cases discussed."
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
