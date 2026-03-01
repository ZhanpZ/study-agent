import json
from crewai import Agent, Task
from backend.config import MODEL_STRONG


def create_note_cleaner_agent() -> Agent:
    return Agent(
        role="Note Cleanup Specialist",
        goal=(
            "Transform messy, unstructured, gibberish-style notes into clean, "
            "logical, concise study notes. Extract the core topic and produce "
            "well-organized content ready for review."
        ),
        backstory=(
            "Expert technical editor who can parse chaotic shorthand, typos, "
            "and stream-of-consciousness dumps into structured knowledge. "
            "You preserve every meaningful idea while removing noise."
        ),
        llm=MODEL_STRONG,
        verbose=False,
        allow_delegation=False,
    )


def clean_note(agent: Agent, raw_text: str) -> dict:
    """Clean raw gibberish text into structured notes with an extracted topic.

    Returns dict with keys: topic, cleaned_note
    """
    task = Task(
        description=(
            f"The user dumped the following raw, messy notes:\n\n"
            f"---\n{raw_text}\n---\n\n"
            "Your job:\n"
            "1. Extract the core TOPIC — a short, specific name (2-5 words) "
            "that captures what these notes are about.\n"
            "2. Rewrite the content into CLEAN, CONCISE study notes:\n"
            "   - Fix typos, grammar, and sentence structure\n"
            "   - Organize logically with clear sections if needed\n"
            "   - Preserve all meaningful technical content\n"
            "   - Remove filler, repetition, and noise\n"
            "   - Use bullet points or numbered lists where appropriate\n"
            "   - Use markdown formatting\n"
            "   - Keep it concise — this is for review, not a textbook\n\n"
            "Respond with ONLY valid JSON, no extra text."
        ),
        expected_output=(
            '{"topic": "<short topic name>", "cleaned_note": "<markdown formatted clean notes>"}'
        ),
        agent=agent,
    )
    result = str(agent.execute_task(task))

    # Parse JSON from response
    json_start = result.index("{")
    json_end = result.rindex("}") + 1
    return json.loads(result[json_start:json_end])
