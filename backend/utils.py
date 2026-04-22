import json
import logging
from backend.config import HISTORY_CONTEXT_WINDOW

logger = logging.getLogger(__name__)


def format_history(messages: list[dict], limit: int | None = HISTORY_CONTEXT_WINDOW) -> str:
    """Format conversation history as [agent]: content lines for LLM prompts."""
    msgs = messages[-limit:] if limit else messages
    return "".join(
        f"[{m.get('agent', m.get('role', 'unknown'))}]: {m['content']}\n"
        for m in msgs
    )


def skill_level_label(
    score: float,
    low: str = "beginner",
    mid: str = "intermediate",
    high: str = "advanced",
) -> str:
    """Map a numeric skill score to a descriptive label using standard thresholds."""
    return low if score < 30 else mid if score < 70 else high


def extract_json(text: str) -> dict | list | None:
    """Safely extract the first JSON object or array from LLM output.

    Handles cases where LLM wraps JSON in markdown fences or extra text.
    Returns None if no valid JSON is found.
    """
    # Try to find a JSON object
    try:
        start = text.index("{")
        end = text.rindex("}") + 1
        return json.loads(text[start:end])
    except (ValueError, json.JSONDecodeError):
        pass

    # Try to find a JSON array
    try:
        start = text.index("[")
        end = text.rindex("]") + 1
        return json.loads(text[start:end])
    except (ValueError, json.JSONDecodeError):
        pass

    logger.warning("No valid JSON found in text: %s", text[:200])
    return None
