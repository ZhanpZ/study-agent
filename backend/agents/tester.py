import json
import hashlib
import logging
import time
from collections import OrderedDict
from crewai import Agent, Task
from backend.config import MODEL_STRONG, MODEL_FAST, MASTERY_SCORE_THRESHOLD, LLM_COMPREHENSION
from backend.models.schemas import TesterEvaluation, MCQResponse, CodeChallengeResponse
from backend.utils import extract_json, parse_and_validate
from backend.services.llm_guard import (
    call_agent_task, LLMCallFailedError, check_circuit, record_success, record_failure,
    LLMCircuitOpenError,
)

logger = logging.getLogger(__name__)

# Bounded LRU cache for comprehension MCQs (max 128 entries, 24h TTL)
_mcq_cache: OrderedDict[str, tuple[float, list[dict]]] = OrderedDict()
_MCQ_CACHE_TTL = 86400  # 24 hours
_MCQ_CACHE_MAX_SIZE = 128


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
    history_text = ""
    for msg in conversation_history:
        role = msg.get("agent", msg.get("role", "unknown"))
        history_text += f"[{role}]: {msg['content']}\n"

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
    try:
        result = call_agent_task(agent, task)
    except LLMCallFailedError as e:
        logger.warning("evaluate_understanding LLM call failed for '%s': %s", topic, e)
        result = ""
    return _parse_evaluation(result, previous_score)


def generate_mcq(
    agent: Agent,
    topic: str,
    conversation_history: list[dict],
) -> list[dict]:
    history_text = "\n".join(
        f"[{m.get('agent', 'unknown')}]: {m['content']}" for m in conversation_history[-10:]
    )

    task = Task(
        description=(
            f"Generate 4 MCQs to test understanding of '{topic}' for SDE/MLE.\n\n"
            f"Session context:\n{history_text}\n\n"
            "Requirements:\n"
            "- Each tests a different aspect\n"
            "- One tests 'why' (not just 'what')\n"
            "- One tests a common misconception in production/interviews\n"
            "- Frame as real engineering decisions\n\n"
            "Respond with ONLY valid JSON:\n"
            '{"questions": [\n'
            '  {"question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct": "A"},\n'
            "  ...\n]}"
        ),
        expected_output="Valid JSON with 4 MCQs.",
        agent=agent,
    )
    try:
        result = call_agent_task(agent, task)
    except LLMCallFailedError as e:
        logger.warning("generate_mcq LLM call failed for topic '%s': %s", topic, e)
        result = ""

    validated = parse_and_validate(result, MCQResponse)
    if validated is not None:
        return [q.model_dump() for q in validated.questions]

    logger.warning("Failed to parse/validate MCQ JSON for topic '%s' | raw: %s", topic, result[:200])
    return [
        {
            "question": f"What is the key concept behind {topic}?",
            "options": [
                "A) It is a fundamental CS concept",
                "B) It is not related to CS",
                "C) It is only theoretical",
                "D) None of the above",
            ],
            "correct": "A",
        }
    ]


def score_mcq(questions: list[dict], answers: list[str]) -> TesterEvaluation:
    if not questions:
        return TesterEvaluation(
            score=0, gaps=["No questions available"], mastered=False,
            feedback="Could not generate questions.",
        )

    correct = 0
    total = len(questions)
    gaps = []

    for i, q in enumerate(questions):
        user_answer = answers[i] if i < len(answers) else ""
        expected = q.get("correct", "")
        if user_answer.upper().strip() == expected.upper().strip():
            correct += 1
        else:
            gaps.append(f"Missed: {q['question']}")

    score = round((correct / total) * 100)
    mastered = score >= MASTERY_SCORE_THRESHOLD and len(gaps) <= 1

    feedback = f"You got {correct}/{total} correct."
    if mastered:
        feedback += " Solid understanding."
    elif score >= 50:
        feedback += " Review the missed areas."
    else:
        feedback += " Revisit this topic."

    return TesterEvaluation(
        score=score, gaps=gaps, mastered=mastered, feedback=feedback,
    )


def generate_code_challenge(
    agent: Agent,
    topic: str,
    conversation_history: list[dict],
    mode: str = "leetcode",
) -> dict:
    # For leetcode mode, fetch a real LeetCode problem first
    if mode == "leetcode":
        from backend.services.leetcode_fetcher import fetch_leetcode_problem

        real_problem = fetch_leetcode_problem(topic)
        if real_problem:
            logger.info(
                "Using real LeetCode problem: %s (%s)",
                real_problem.get("title"), real_problem.get("difficulty"),
            )
            return real_problem

        logger.warning("Failed to fetch real LeetCode problem for '%s', falling back to generated", topic)

    # Fallback: generate a problem (always used for industrial mode)
    history_text = "\n".join(
        f"[{m.get('agent', 'unknown')}]: {m['content']}" for m in conversation_history[-10:]
    )

    if mode == "industrial":
        problem_instruction = (
            "Requirements:\n"
            "- Design a clean class, API, or module\n"
            "- Test understanding of discussed design patterns\n"
            "- Include error handling and edge cases\n"
            "- Solvable in 20-40 lines of production code\n"
        )
    else:  # leetcode fallback
        problem_instruction = (
            "Requirements:\n"
            "- Apply algorithm patterns from the session\n"
            "- Clear problem statement with input/output format\n"
            "- Include a twist from the standard template\n"
            "- Solvable in 10-30 lines\n"
        )

    task = Task(
        description=(
            f"Create a coding problem about '{topic}' based on the session.\n\n"
            f"Session context:\n{history_text}\n\n"
            f"{problem_instruction}\n"
            "Respond with ONLY valid JSON:\n"
            '{"problem": "Full problem statement...", "hints": ["hint1", "hint2"]}'
        ),
        expected_output='Valid JSON: {"problem": "...", "hints": ["..."]}',
        agent=agent,
    )
    try:
        result = call_agent_task(agent, task)
    except LLMCallFailedError as e:
        logger.warning("generate_code_challenge LLM call failed for topic '%s': %s", topic, e)
        result = ""

    validated = parse_and_validate(result, CodeChallengeResponse)
    if validated is not None:
        return validated.model_dump()

    logger.warning("Failed to parse/validate code challenge JSON for '%s' | raw: %s", topic, result[:200])
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
    mode: str = "leetcode",
    language: str = "python",
) -> TesterEvaluation:
    if mode == "industrial":
        criteria = (
            "1. Correctness\n"
            "2. Architecture and abstractions\n"
            "3. Design patterns (SOLID, etc.)\n"
            "4. Error handling\n"
            "5. Production readiness\n"
        )
    else:  # leetcode
        criteria = (
            "1. Correctness\n"
            "2. Edge case handling\n"
            "3. Code quality\n"
            "4. Time/space complexity optimality\n"
            "5. Pattern application\n"
        )

    task = Task(
        description=(
            f"Evaluate {language} code solution for '{topic}':\n\n"
            f"Problem: {challenge.get('problem', topic)}\n\n"
            f"Code ({language}):\n```{language}\n{user_code}\n```\n\n"
            f"Criteria:\n{criteria}\n"
            "Respond with ONLY valid JSON:\n"
            '{"score": <0-100>, "gaps": ["gap1", "gap2"], "mastered": <true/false>, "feedback": "..."}\n\n'
            "mastered=true only if score >= 80 with no critical issues."
        ),
        expected_output='Valid JSON: {"score": <number>, "gaps": [...], "mastered": <bool>, "feedback": "..."}',
        agent=agent,
    )
    try:
        result = call_agent_task(agent, task)
    except LLMCallFailedError as e:
        logger.warning("evaluate_code LLM call failed for topic '%s': %s", topic, e)
        result = ""
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


def detect_critical_errors(
    topic: str,
    user_explanation: str,
) -> list[str]:
    """Quickly detect factual errors in a teach-back explanation using a lightweight LLM call."""
    from openai import OpenAI
    client = OpenAI()
    prompt = (
        f"A student is teaching back '{topic}'. Check their explanation for critical factual errors only.\n\n"
        f"Explanation: \"{user_explanation}\"\n\n"
        "Return ONLY a JSON array of critical errors found. Empty array [] if none.\n"
        "Only flag clear factual mistakes (wrong complexity, wrong definition, inverted logic). "
        "Do NOT flag vagueness, simplification, or missing details.\n"
        "Example: [\"Binary search requires O(n) space — actually O(1) iteratively\", "
        "\"BFS uses a stack — actually a queue\"]\n"
        "Respond with ONLY valid JSON array."
    )
    try:
        check_circuit()
    except LLMCircuitOpenError as e:
        logger.warning("detect_critical_errors skipped — circuit open: %s", e)
        return []
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=300,
        )
        raw = response.choices[0].message.content or "[]"
        record_success()
        data = extract_json(raw)
        if isinstance(data, list):
            return [str(e) for e in data if e]
    except Exception as e:
        record_failure()
        logger.warning("detect_critical_errors failed: %s", e)
    return []


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
        if now - cached_time < _MCQ_CACHE_TTL:
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
    try:
        result = call_agent_task(comprehension_agent, task)
    except LLMCallFailedError as e:
        logger.warning("generate_comprehension_mcqs LLM call failed for '%s': %s", topic, e)
        result = ""

    data = extract_json(result)
    if data and isinstance(data, dict):
        questions = data.get("questions", [])
        if questions:
            _mcq_cache[cache_key] = (now, questions)
            # Evict oldest entries if over capacity
            while len(_mcq_cache) > _MCQ_CACHE_MAX_SIZE:
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


