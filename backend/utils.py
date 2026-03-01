import json
import logging

logger = logging.getLogger(__name__)


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
