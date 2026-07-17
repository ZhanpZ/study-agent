import logging
from crewai import Agent, Task
from backend.config import MODEL_STRONG
from backend.models.schemas import NoteCleanResult
from backend.utils import parse_and_validate
from backend.services.llm_guard import call_agent_task, LLMCallFailedError

logger = logging.getLogger(__name__)


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
    try:
        result = call_agent_task(agent, task)
    except LLMCallFailedError as e:
        logger.warning("clean_note LLM call failed: %s", e)
        result = ""

    validated = parse_and_validate(result, NoteCleanResult)
    if validated is not None:
        return validated.model_dump()
    return {"topic": "Untitled Note", "cleaned_note": result}
