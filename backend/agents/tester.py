import json
import hashlib
import logging
import time
from collections import OrderedDict
from crewai import Agent, Task
from backend.config import MODEL_STRONG, MODEL_FAST, MASTERY_SCORE_THRESHOLD, LLM_COMPREHENSION, MCQ_CACHE_TTL, MCQ_CACHE_MAX_SIZE
from backend.models.schemas import TesterEvaluation
from backend.utils import extract_json, format_history

logger = logging.getLogger(__name__)

# Bounded LRU cache for comprehension MCQs
_mcq_cache: OrderedDict[str, tuple[float, list[dict]]] = OrderedDict()


def create_tester_agent() -> Agent:
    return Agent(
        role="SDE/MLE Knowledge Evaluator",
        goal=(
            "Evaluate understanding of CS/ML concepts from an SDE/MLE readiness perspective. "
            "Assess whether the user could explain this in a design review or interview. "
            "Provide accurate scores, specific gaps, and mastery determination."
        ),
        backstory=(
            "Rigorous but fair tech lead who evaluates by analyzing teaching quality — "
            "not recall. You check: accuracy, completeness, 'why' not just 'what', "
            "edge cases, correct terminology. Always give specific, actionable feedback."
        ),
        llm=MODEL_STRONG,
        verbose=False,
        allow_delegation=False,
    )


def evaluate_understanding(
    agent: Agent,
    topic: str,
    conversation_history: list[dict],
    previous_score: float,
) -> TesterEvaluation:
    history_text = format_history(conversation_history, limit=None)

    task = Task(
        description=(
            f"Evaluate understanding of '{topic}' from this teaching session.\n\n"
            f"Conversation:\n{history_text}\n\n"
            f"Previous score: {previous_score}/100.\n\n"
            "Criteria:\n"
            "1. Factual accuracy\n"
            "2. Completeness\n"
            "3. Depth ('why' not just 'what')\n"
            "4. Edge cases and nuances\n"
            "5. Correct terminology\n"
            "6. SDE/MLE applicability\n\n"
            "Respond with ONLY valid JSON:\n"
            '{"score": <0-100>, "gaps": ["gap1", "gap2"], "mastered": <true/false>, "feedback": "..."}\n\n'
            "mastered=true only if score >= 80 with no critical gaps. "
            "Be specific in gaps — name exact sub-topics or misconceptions."
        ),
        expected_output='Valid JSON: {"score": <number>, "gaps": [...], "mastered": <bool>, "feedback": "..."}',
        agent=agent,
    )
    result = str(agent.execute_task(task))
    return _parse_evaluation(result, previous_score)


def generate_code_challenge(
    agent: Agent,
    topic: str,
    conversation_history: list[dict],
    difficulty: str = "medium",
) -> dict:
    from backend.services.leetcode_fetcher import fetch_leetcode_problem

    real_problem = fetch_leetcode_problem(topic, difficulty=difficulty)
    if real_problem:
        logger.info(
            "Using real LeetCode problem: %s (%s)",
            real_problem.get("title"), real_problem.get("difficulty"),
        )
        return real_problem

    logger.warning("Failed to fetch real LeetCode problem for '%s', falling back to generated", topic)

    # Fallback: generate a problem aligned with the session's canonical solutions
    history_text = format_history(conversation_history, limit=10)

    task = Task(
        description=(
            f"Create a LeetCode-style coding problem about '{topic}' "
            f"at {difficulty} difficulty, aligned with the approaches discussed in the session.\n\n"
            f"Session context:\n{history_text}\n\n"
            "Requirements:\n"
            "- Apply algorithm patterns from the session\n"
            "- Clear problem statement with input/output format and examples\n"
            "- Solvable in 10-30 lines of Python\n\n"
            "Respond with ONLY valid JSON:\n"
            '{"problem": "Full problem statement...", "hints": ["hint1", "hint2"]}'
        ),
        expected_output='Valid JSON: {"problem": "...", "hints": ["..."]}',
        agent=agent,
    )
    result = str(agent.execute_task(task))

    data = extract_json(result)
    if data and isinstance(data, dict):
        return {
            "problem": data.get("problem", f"Write a solution related to {topic}"),
            "hints": data.get("hints", []),
        }

    logger.warning("Failed to parse code challenge JSON for '%s' | raw: %s", topic, result[:200])
    return {
        "problem": f"Write a complete implementation of {topic} in Python.",
        "hints": ["Think about edge cases", "Consider time complexity"],
    }


def evaluate_code(
    agent: Agent,
    topic: str,
    challenge: dict,
    user_code: str,
    conversation_history: list[dict],
) -> TesterEvaluation:
    # Extract the professor's canonical explanation (first assistant message) to ground evaluation
    canonical = next(
        (m["content"] for m in conversation_history
         if m.get("agent") == "professor" and m.get("role") == "assistant"),
        ""
    )
    canonical_section = (
        f"Canonical approaches and complexity (from the professor's explanation):\n{canonical[:2000]}\n\n"
        if canonical else ""
    )

    task = Task(
        description=(
            f"Evaluate this code solution for '{topic}'.\n\n"
            f"{canonical_section}"
            f"Problem: {challenge.get('problem', topic)}\n\n"
            f"Student's code:\n```python\n{user_code}\n```\n\n"
            "Evaluation criteria:\n"
            "1. Correctness — does it solve the problem?\n"
            "2. Complexity — does it match or approach the optimal time/space complexity "
            "stated in the canonical explanation above?\n"
            "3. Edge case handling\n"
            "4. Code quality and readability\n"
            "5. Pattern application — does the student use the right algorithmic pattern?\n\n"
            "Respond with ONLY valid JSON:\n"
            '{"score": <0-100>, "gaps": ["gap1", "gap2"], "mastered": <true/false>, "feedback": "..."}\n\n'
            "mastered=true only if score >= 80 with no critical issues. "
            "Be specific in gaps — name the exact complexity, pattern, or sub-problem missed."
        ),
        expected_output='Valid JSON: {"score": <number>, "gaps": [...], "mastered": <bool>, "feedback": "..."}',
        agent=agent,
    )
    result = str(agent.execute_task(task))
    return _parse_evaluation(result, 0)


_comprehension_agent: Agent | None = None


def _get_comprehension_agent() -> Agent:
    """Lazily create a lightweight agent for comprehension MCQs (uses LLM_COMPREHENSION with tuned temperature)."""
    global _comprehension_agent
    if _comprehension_agent is None:
        _comprehension_agent = Agent(
            role="Comprehension Check Generator",
            goal="Generate comprehension-check MCQs from explanations.",
            backstory="Educator who creates quick comprehension checks for SDE/MLE topics.",
            llm=LLM_COMPREHENSION,
            verbose=False,
            allow_delegation=False,
        )
    return _comprehension_agent


def generate_comprehension_mcqs(
    agent: Agent,
    topic: str,
    explanation: str,
) -> list[dict]:
    # Check cache by topic + explanation hash (bounded LRU)
    cache_key = hashlib.md5(f"{topic}:{explanation}".encode()).hexdigest()
    now = time.time()
    if cache_key in _mcq_cache:
        cached_time, cached_result = _mcq_cache[cache_key]
        if now - cached_time < MCQ_CACHE_TTL:
            _mcq_cache.move_to_end(cache_key)
            return cached_result
        else:
            del _mcq_cache[cache_key]

    comprehension_agent = _get_comprehension_agent()
    explanation_len = len(explanation)
    if explanation_len < 500:
        num_questions = 2
    elif explanation_len < 1500:
        num_questions = 3
    else:
        num_questions = min(5, 3 + (explanation_len - 1500) // 1000)

    task = Task(
        description=(
            f"Generate {num_questions} comprehension-check MCQs for '{topic}' "
            f"based on this explanation:\n\n{explanation}\n\n"
            "These are comprehension checks, not evaluation. "
            "Test understanding of specific points from the explanation. "
            "Straightforward but not trivial. SDE/MLE context.\n\n"
            "Respond with ONLY valid JSON:\n"
            '{"questions": [\n'
            '  {"question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], '
            '"correct": "A", "explanation": "Why this is correct"},\n'
            "  ...\n]}"
        ),
        expected_output=f"Valid JSON with {num_questions} comprehension MCQs.",
        agent=comprehension_agent,
    )
    result = str(comprehension_agent.execute_task(task))

    data = extract_json(result)
    if data and isinstance(data, dict):
        questions = data.get("questions", [])
        if questions:
            _mcq_cache[cache_key] = (now, questions)
            # Evict oldest entries if over capacity
            while len(_mcq_cache) > MCQ_CACHE_MAX_SIZE:
                _mcq_cache.popitem(last=False)
        return questions

    logger.warning("Failed to parse comprehension MCQ JSON for '%s' | raw: %s", topic, result[:200])
    return []


def _parse_evaluation(result: str, fallback_score: float) -> TesterEvaluation:
    data = extract_json(result)
    if data and isinstance(data, dict):
        return TesterEvaluation(
            score=max(0, min(100, float(data.get("score", 0)))),
            gaps=data.get("gaps", []),
            mastered=data.get("mastered", False),
            feedback=data.get("feedback", ""),
        )

    logger.warning("Failed to parse evaluation JSON | raw: %s", result[:200])
    return TesterEvaluation(
        score=fallback_score,
        gaps=["Unable to parse evaluation — please continue teaching"],
        mastered=False,
        feedback=result,
    )


