import json
import logging

from pydantic import BaseModel, ValidationError

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


def parse_and_validate(text: str, model: type[BaseModel]) -> BaseModel | None:
    """Extract JSON from LLM output and validate it against a Pydantic model.

    Returns None (logging a warning) if extraction fails or the shape doesn't
    match — callers should apply their own fallback, same as extract_json().
    """
    data = extract_json(text)
    if data is None:
        return None
    try:
        return model.model_validate(data)
    except ValidationError as e:
        logger.warning("LLM output failed %s validation: %s | raw: %s", model.__name__, e, text[:200])
        return None
