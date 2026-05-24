import json
import re
import math
import logging
from crewai import Agent, Task, LLM
from backend.config import LLM_QUIZ, LLM_MATH, LLM_VERIFY
from backend.utils import extract_json

logger = logging.getLogger(__name__)


# ─── Pydantic models for structured output (Idea 4) ──────────────
from pydantic import BaseModel, Field


class AlgorithmQuizQuestion(BaseModel):
    problem: str
    example: str
    constraints: str
    variables: dict[str, str]
    options: list[str] = Field(min_length=4, max_length=4)
    correct: str
    explanation: str
    reasoning: str = ""           # CoT (Idea 7) — stripped before frontend
    why_wrong: dict[str, str] = Field(default_factory=dict)  # Adversarial (Idea 8)


class AlgorithmQuizResponse(BaseModel):
    questions: list[AlgorithmQuizQuestion]


class ConstraintQuizQuestion(BaseModel):
    keywords: list[str]
    problem: str
    example: str
    variables: dict[str, str]
    constraints: str
    options: list[str] = Field(min_length=6, max_length=6)
    correct: list[str]
    explanation: str
    solution_hints: dict[str, str]
    reasoning: str = ""
    why_wrong: dict[str, str] = Field(default_factory=dict)


class ConstraintQuizResponse(BaseModel):
    questions: list[ConstraintQuizQuestion]


class MathQuestionPart(BaseModel):
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    correct: str
    solution: str
    reasoning: str = ""


class ProofQuestionPart(BaseModel):
    question: str
    context: str
    options: list[str] = Field(min_length=4, max_length=4)
    correct: str
    explanation: str
    reasoning: str = ""


class ConceptExplanation(BaseModel):
    concept: str
    analogy: str
    simple_example: str
    harder_example: str


class MLApplication(BaseModel):
    algorithm: str
    explanation: str
    related_algorithms: list[str]


class MLMathResponse(BaseModel):
    topic: str
    concept_explanation: ConceptExplanation
    math_question: MathQuestionPart
    proof_question: ProofQuestionPart
    ml_application: MLApplication


# ─── Reference data for RAG-lite grounding (Idea 9) ─────────────

ALGORITHM_REFERENCE = """
ALGORITHM REFERENCE (use this to ensure correct answers):
- Sliding Window: contiguous subarray/substring with sum/length constraints, O(n)
- Two Pointers: sorted array pair finding, partitioning, merging, O(n)
- Binary Search: sorted search, answer-space search, O(log n)
- BFS: shortest path in unweighted graphs, level-order traversal, O(V+E)
- DFS: graph traversal, cycle detection, connected components, O(V+E)
- Dijkstra: shortest path in weighted graphs (non-negative), O(E log V)
- Bellman-Ford: shortest path with negative weights, O(VE)
- Floyd-Warshall: all-pairs shortest path, O(V^3)
- Dynamic Programming: overlapping subproblems + optimal substructure
- Greedy: locally optimal choices, interval scheduling, Huffman
- Backtracking: constraint satisfaction, permutations, N-Queens
- Union-Find: connected components, cycle detection in undirected graphs, O(n α(n)) ≈ O(n)
- Topological Sort: DAG ordering, prerequisite scheduling, O(V+E)
- Monotonic Stack: next greater/smaller element, histogram problems, O(n)
- Trie: prefix matching, autocomplete, word search
- Segment Tree: range queries with updates, O(log n) per query
- Prefix Sum: range sum queries (static), O(1) per query after O(n) build
- KMP/Rabin-Karp: pattern matching in strings, O(n+m)
- Kruskal/Prim: minimum spanning tree
"""

ML_MATH_REFERENCE = """
ML MATH REFERENCE (use this to ensure correct mappings):
- Eigenvalues/Eigenvectors → PCA, spectral clustering, PageRank
- SVD (Singular Value Decomposition) → dimensionality reduction, recommender systems, LSA
- Matrix multiplication → neural network forward pass, attention mechanism
- Gradient descent / partial derivatives → backpropagation, all neural net training
- Chain rule → backpropagation
- Jacobian/Hessian → optimization, second-order methods (L-BFGS, Newton's method)
- Bayes' theorem → Naive Bayes, Bayesian networks, posterior inference
- MLE/MAP → logistic regression, language models, parameter estimation
- KL divergence → VAEs, knowledge distillation, policy gradient
- Cross-entropy → classification loss functions
- Information gain / entropy → decision trees (ID3, C4.5)
- Convexity → SVM (dual), logistic regression convergence guarantees
- Lagrange multipliers → SVM (support vector machines), constrained optimization
- Probability distributions → GMMs, Bayesian methods, generative models
- Norms (L1, L2) → regularization (Lasso, Ridge), distance metrics
"""

COMPLEXITY_REFERENCE = """
COMPLEXITY CEILING REFERENCE (n → max feasible complexity for ~10^7 ops in Python):
- n <= 10:    O(n!), O(2^n * n) — brute-force permutations, all subsets
- n <= 20:    O(2^n) — bitmask DP, subset enumeration, meet-in-the-middle
- n <= 50:    O(n^4), O(2^(n/2)) — meet-in-the-middle, matrix DP
- n <= 100:   O(n^3) — Floyd-Warshall, matrix chain, interval DP, Gaussian elimination
- n <= 500:   O(n^3) tight — Hungarian algorithm, dense Bellman-Ford
- n <= 1000:  O(n^2) — quadratic DP (LIS naive, edit distance), brute pairwise
- n <= 5000:  O(n^2) tight — 2D DP (knapsack, LCS), dense Dijkstra
- n <= 10^5:  O(n log n) — merge sort, segment tree, BIT, Dijkstra (heap), Kruskal
- n <= 5*10^5: O(n log n) tight — segment tree + lazy, HLD, suffix array
- n <= 10^6:  O(n) — two pointers, sliding window, prefix sums, hashing, union-find, BFS/DFS
- n <= 10^7:  O(n) tight — sieve, linear selection, radix sort
- n <= 10^8+: O(log n), O(sqrt(n)), O(1) — binary search, math, matrix exponentiation

KEY RULE: An algorithm is feasible ONLY if its complexity * n fits within ~10^7 operations.
Example: n=10^5, O(n^2) = 10^10 → TOO SLOW. O(n log n) = 10^5 * 17 ≈ 1.7*10^6 → FEASIBLE.
"""


# ─── Agent factories ─────────────────────────────────────────────

_quiz_agent: Agent | None = None


def create_quiz_agent() -> Agent:
    """Return a singleton quiz agent (created once, reused across requests)."""
    global _quiz_agent
    if _quiz_agent is None:
        _quiz_agent = Agent(
            role="Algorithm Selection Quiz Master",
            goal=(
                "Generate algorithm selection quiz questions. "
                "Create realistic LeetCode-style problem descriptions "
                "that do NOT reveal which algorithm to use — the user must "
                "recognize the pattern purely from the problem structure."
            ),
            backstory=(
                "Expert competitive programmer and tech interviewer. "
                "You design problems that test pattern recognition without "
                "giving away the answer. You never use algorithm names or "
                "technique keywords in the problem description."
            ),
            llm=LLM_QUIZ,
            verbose=False,
            allow_delegation=False,
        )
    return _quiz_agent


_ml_math_agent: Agent | None = None


def create_ml_math_agent() -> Agent:
    """Return a singleton ML math agent (created once, reused across requests)."""
    global _ml_math_agent
    if _ml_math_agent is not None:
        return _ml_math_agent
    _ml_math_agent = Agent(
        role="ML Math Drill Instructor",
        goal=(
            "Generate math questions tied to machine learning. "
            "Each question bundle has: a computation problem, a proof-insertion problem, "
            "and an explanation of where this math appears in ML algorithms."
        ),
        backstory=(
            "PhD-level ML researcher who teaches the mathematical foundations "
            "of machine learning. You design problems that connect abstract math "
            "to concrete ML algorithms: linear algebra for PCA/SVD, probability for "
            "Bayesian methods, calculus for backpropagation, optimization for training."
        ),
        llm=LLM_MATH,
        verbose=False,
        allow_delegation=False,
    )
    return _ml_math_agent


# ─── Verification agent (Idea 3) ────────────────────────────────

_verify_agent: Agent | None = None


def _get_verify_agent() -> Agent:
    """Lazy singleton for the verification agent."""
    global _verify_agent
    if _verify_agent is None:
        _verify_agent = Agent(
            role="Quiz Answer Verifier",
            goal="Independently solve quiz questions and verify correctness of provided answers.",
            backstory=(
                "Meticulous code reviewer who independently solves each problem "
                "to verify the answer key is correct. You never trust — you verify."
            ),
            llm=LLM_VERIFY,
            verbose=False,
            allow_delegation=False,
        )
    return _verify_agent


# ─── Self-verification pass (Idea 3) ────────────────────────────


def _verify_algorithm_questions(questions: list[dict]) -> list[dict]:
    """Independently verify each algorithm quiz question's answer."""
    if not questions:
        return questions

    agent = _get_verify_agent()
    verified = []

    for q in questions:
        try:
            task = Task(
                description=(
                    "Solve this algorithm problem and determine the correct answer.\n\n"
                    f"Problem: {q.get('problem', '')}\n"
                    f"Example: {q.get('example', '')}\n"
                    f"Constraints: {q.get('constraints', '')}\n"
                    f"Options:\n" + "\n".join(q.get("options", [])) + "\n\n"
                    "Think step by step. Which option is correct and why?\n"
                    "Respond with ONLY valid JSON: {\"correct\": \"<letter>\", \"reasoning\": \"...\"}"
                ),
                expected_output='JSON with correct answer letter.',
                agent=agent,
            )
            result = str(agent.execute_task(task))
            data = extract_json(result)
            if data and isinstance(data, dict):
                verifier_answer = data.get("correct", "").strip().upper()

                if verifier_answer and verifier_answer == q.get("correct", "").strip().upper():
                    q["verified"] = True
                else:
                    logger.warning(
                        "Verification mismatch: generated=%s verifier=%s | problem: %s",
                        q.get("correct"), verifier_answer, q.get("problem", "")[:80],
                    )
                    q["verified"] = False
            else:
                q["verified"] = False
            verified.append(q)
        except Exception as e:
            logger.warning("Verification failed for question: %s", e)
            q["verified"] = False
            verified.append(q)

    return verified


def _verify_constraint_questions(questions: list[dict]) -> list[dict]:
    """Independently verify each constraint quiz question's answers."""
    if not questions:
        return questions

    agent = _get_verify_agent()
    verified = []

    for q in questions:
        try:
            task = Task(
                description=(
                    "Given this problem and constraints, determine which algorithms are feasible.\n\n"
                    f"Problem: {q.get('problem', '')}\n"
                    f"Constraints: {q.get('constraints', '')}\n"
                    f"Options:\n" + "\n".join(q.get("options", [])) + "\n\n"
                    "Rule: ~10^7 operations is the ceiling in Python.\n"
                    "For each option, check: (1) Does it solve the problem type? "
                    "(2) Is its complexity feasible for the given n?\n\n"
                    "Respond with ONLY valid JSON: {\"correct\": [\"A\", \"B\", ...], \"reasoning\": \"...\"}"
                ),
                expected_output='JSON with list of correct answer letters.',
                agent=agent,
            )
            result = str(agent.execute_task(task))
            data = extract_json(result)
            if not data or not isinstance(data, dict):
                q["verified"] = False
                verified.append(q)
                continue
            verifier_answers = set(l.strip().upper() for l in data.get("correct", []))
            generated_answers = set(l.strip().upper() for l in q.get("correct", []))

            if verifier_answers == generated_answers:
                q["verified"] = True
            else:
                logger.warning(
                    "Constraint verification mismatch: generated=%s verifier=%s | problem: %s",
                    generated_answers, verifier_answers, q.get("problem", "")[:80],
                )
                q["verified"] = False
            verified.append(q)
        except Exception as e:
            logger.warning("Constraint verification failed: %s", e)
            q["verified"] = False
            verified.append(q)

    return verified


def _verify_ml_math(question: dict) -> dict:
    """Verify ML math question answers independently."""
    if not question:
        return question

    agent = _get_verify_agent()

    for part_key, q_key in [("math_question", "question"), ("proof_question", "question")]:
        part = question.get(part_key)
        if not part:
            continue
        try:
            context_str = ""
            if part_key == "proof_question" and part.get("context"):
                context_str = f"\nProof context:\n{part['context']}\n"

            task = Task(
                description=(
                    f"Solve this {part_key.replace('_', ' ')}:\n\n"
                    f"{part.get(q_key, '')}\n{context_str}\n"
                    f"Options:\n" + "\n".join(part.get("options", [])) + "\n\n"
                    "Work through it step by step. Which option is correct?\n"
                    "Respond with ONLY valid JSON: {\"correct\": \"<letter>\", \"reasoning\": \"...\"}"
                ),
                expected_output='JSON with correct answer letter.',
                agent=agent,
            )
            result = str(agent.execute_task(task))
            data = extract_json(result)
            if not data or not isinstance(data, dict):
                question[f"{part_key}_verified"] = False
                continue
            verifier_answer = data.get("correct", "").strip().upper()
            generated_answer = part.get("correct", "").strip().upper()

            if verifier_answer and verifier_answer != generated_answer:
                logger.warning(
                    "ML math verification mismatch on %s: generated=%s verifier=%s",
                    part_key, generated_answer, verifier_answer,
                )
                question[f"{part_key}_verified"] = False
            else:
                question[f"{part_key}_verified"] = True
        except Exception as e:
            logger.warning("ML math verification failed for %s: %s", part_key, e)
            question[f"{part_key}_verified"] = False

    return question


# ─── Constraint answer validation (Idea 6) ──────────────────────

# Map complexity strings to approximate operation counts as a function of n
_COMPLEXITY_PATTERNS = [
    (r"O\(1\)", lambda n: 1),
    (r"O\(log\s*n\)", lambda n: math.log2(n) if n > 0 else 0),
    (r"O\(√n\)|O\(sqrt\s*n\)|O\(n\^?\(?1/2\)?\)", lambda n: math.sqrt(n)),
    (r"O\(n\)", lambda n: n),
    (r"O\(n\s*log\s*n\)", lambda n: n * math.log2(n) if n > 0 else 0),
    (r"O\(n\^2\)|O\(n²\)", lambda n: n * n),
    (r"O\(n\^3\)|O\(n³\)", lambda n: n ** 3),
    (r"O\(n\^4\)|O\(n⁴\)", lambda n: n ** 4),
    (r"O\(2\^n\)", lambda n: 2 ** n),
    (r"O\(n!\)", lambda n: math.factorial(min(int(n), 20))),
    (r"O\(n\s*[αα]\s*\(n\)\)", lambda n: n),  # inverse Ackermann ≈ O(n)
    (r"O\(V\+E\)|O\(V\s*\+\s*E\)", lambda n: 2 * n),  # approx V+E ~ 2n
    (r"O\(E\s*log\s*V\)", lambda n: n * math.log2(n) if n > 0 else 0),
    (r"O\(VE\)|O\(V\s*\*?\s*E\)", lambda n: n * n),  # worst case V*E ~ n^2
    (r"O\(V\^3\)|O\(V³\)", lambda n: n ** 3),
]

_CONSTRAINT_OPS_CEILING = 1e7


def _parse_max_n(constraints_str: str) -> float | None:
    """Extract the largest n value from a constraint string like 'n <= 10^5'."""
    # Match patterns like: n <= 10^5, n <= 100000, n <= 10^6, 1 <= n <= 10^5
    patterns = [
        r"<=?\s*(\d+)\s*\*?\s*10\s*\^\s*(\d+)",  # 5*10^5 or 10^5
        r"<=?\s*10\s*\^\s*(\d+)",                  # 10^5
        r"<=?\s*(\d+)",                             # 100000
    ]
    max_n = 0
    for pat in patterns:
        for match in re.finditer(pat, constraints_str):
            groups = match.groups()
            if len(groups) == 2:
                val = int(groups[0]) * (10 ** int(groups[1]))
            elif len(groups) == 1:
                try:
                    val = 10 ** int(groups[0]) if "^" in match.group() else int(groups[0])
                except ValueError:
                    continue
            else:
                continue
            max_n = max(max_n, val)
    return max_n if max_n > 0 else None


def _extract_complexity(option_str: str) -> str | None:
    """Extract O(...) complexity from an option string, handling nested parens like O(n α(n))."""
    # Find 'O(' then match balanced parentheses
    start = option_str.find("O(")
    if start == -1:
        return None
    depth = 0
    for i in range(start + 1, len(option_str)):
        if option_str[i] == "(":
            depth += 1
        elif option_str[i] == ")":
            depth -= 1
            if depth == 0:
                return option_str[start:i + 1]
    return None


def _is_feasible(complexity_str: str, n: float) -> bool | None:
    """Check if a complexity is feasible for given n (within ~10^7 ops)."""
    for pattern, func in _COMPLEXITY_PATTERNS:
        if re.search(pattern, complexity_str, re.IGNORECASE):
            try:
                ops = func(n)
                return ops <= _CONSTRAINT_OPS_CEILING
            except (OverflowError, ValueError):
                return False
    return None  # unknown complexity — can't determine


def _validate_constraint_answers(questions: list[dict]) -> list[dict]:
    """Programmatically validate constraint quiz answers against the reference table."""
    for q in questions:
        max_n = _parse_max_n(q.get("constraints", ""))
        if max_n is None:
            continue

        validated_correct = []
        for option in q.get("options", []):
            letter = option[0] if option else ""
            if letter not in q.get("correct", []):
                continue  # not marked correct by LLM — skip
            complexity = _extract_complexity(option)
            if complexity is None:
                # Can't parse complexity — trust LLM answer
                validated_correct.append(letter)
                continue
            feasible = _is_feasible(complexity, max_n)
            if feasible is None:
                # Unknown complexity pattern — trust LLM answer
                logger.info(
                    "Constraint validation: unknown pattern %s for %s — keeping LLM answer",
                    complexity, letter,
                )
                validated_correct.append(letter)
            elif feasible:
                validated_correct.append(letter)
            else:
                logger.info(
                    "Constraint validation: removing %s (%s) — too slow for n=%s",
                    letter, complexity, max_n,
                )

        # Only override if we successfully validated at least some answers
        if validated_correct:
            removed = set(q.get("correct", [])) - set(validated_correct)
            if removed:
                logger.info("Constraint validation removed infeasible answers: %s", removed)
            q["correct"] = validated_correct

    return questions


# ─── Quiz generation functions ───────────────────────────────────


def generate_algorithm_quiz(
    agent: Agent,
    num_questions: int = 5,
    bias_toward: list[str] | None = None,
) -> list[dict]:
    bias_instruction = ""
    if bias_toward:
        names = ", ".join(bias_toward)
        bias_instruction = (
            f"\nFOCUS REQUIREMENT: At least {min(2, num_questions)} of the {num_questions} questions "
            f"MUST have the correct answer be one of these algorithms: {names}. "
            "These are areas where the user has struggled — design problems that specifically test "
            "these patterns.\n"
        )
    task = Task(
        description=(
            f"Generate {num_questions} algorithm selection quiz questions from a random mix "
            "of topics (graphs, DP, arrays, trees, strings, sorting, greedy, etc.).\n\n"
            + bias_instruction
            + ALGORITHM_REFERENCE
            + "\n\n"
            "CRITICAL RULES FOR PROBLEM DESCRIPTIONS:\n"
            "- Write a realistic LeetCode-style problem statement\n"
            "- The problem description must NOT contain any algorithm names, technique names, "
            "or obvious pattern keywords. NEVER use words like: 'sliding window', 'two pointers', "
            "'dynamic programming', 'DP', 'BFS', 'DFS', 'binary search', 'greedy', 'backtracking', "
            "'divide and conquer', 'union find', 'topological sort', 'memoization', 'prefix sum', "
            "'monotonic stack', 'trie', 'segment tree', etc.\n"
            "- Describe the problem in terms of WHAT needs to be computed, not HOW to compute it\n"
            "- The user should have to recognize the pattern from the problem structure alone\n\n"
            "CHAIN OF THOUGHT (Idea 7): Before choosing the correct answer, reason through the problem "
            "in a 'reasoning' field. Analyze the problem structure, consider each option, and determine "
            "the best algorithm based on your analysis.\n\n"
            "DISTRACTOR VALIDATION (Idea 8): For each WRONG option, include an entry in 'why_wrong' "
            "mapping the letter to a 1-sentence explanation of why it doesn't work. If you cannot "
            "explain why an option is wrong, it may be correct — reconsider.\n\n"
            "For each question provide:\n"
            "1. problem: a LeetCode-style problem description (2-4 sentences). Must not leak "
            "the algorithm.\n"
            "2. example: a concrete input/output example (e.g. 'Input: nums = [2,3,1,2,4,3], "
            "target = 7 → Output: 2')\n"
            "3. constraints: input size constraints (e.g. '1 <= n <= 10^5')\n"
            "4. variables: an object mapping each variable in the constraints to a plain-English "
            "description (e.g. {\"n\": \"length of the array\", \"target\": \"target sum\"})\n"
            "5. options: 4 algorithm/approach choices labeled A-D. Each option should include "
            "the algorithm name AND a brief description of the approach "
            "(e.g. 'A) Binary Search — binary search on the answer space for the minimum length')\n"
            "IMPORTANT: The 4 options must be clearly distinct algorithms — never include two options "
            "that describe the same underlying algorithm with different names.\n"
            "6. reasoning: your step-by-step analysis of the problem before choosing the answer\n"
            "7. correct: the correct answer letter\n"
            "8. explanation: why the correct algorithm fits, and why each wrong option doesn't work "
            "or is suboptimal\n"
            "9. why_wrong: an object mapping each wrong option letter to why it's wrong "
            "(e.g. {\"B\": \"Sorting breaks contiguity\", \"C\": \"O(n^2) unnecessary\", \"D\": \"Works but slower\"})\n\n"
            "Vary difficulty across questions. Respond with ONLY valid JSON:\n"
            '{"questions": [\n'
            '  {\n'
            '    "problem": "Given an array of positive integers and a target sum, find the '
            'length of the shortest contiguous subarray whose sum is greater than or equal to '
            'the target. If no such subarray exists, return 0.",\n'
            '    "example": "Input: nums = [2,3,1,2,4,3], target = 7 → Output: 2 (subarray [4,3] has sum 7)",\n'
            '    "constraints": "1 <= n <= 10^5, 1 <= target <= 10^9",\n'
            '    "variables": {"n": "length of the array", "target": "required minimum sum"},\n'
            '    "options": [\n'
            '      "A) Sliding Window — expand/shrink a window tracking the running sum",\n'
            '      "B) Sorting + Two Pointers — sort then scan from both ends",\n'
            '      "C) Dynamic Programming — build a table of subarray sums",\n'
            '      "D) Prefix Sum + Binary Search — prefix sums then binary search for each start"\n'
            '    ],\n'
            '    "reasoning": "The problem asks for a shortest contiguous subarray with sum >= target. '
            'Key observations: (1) contiguous subarray means order matters — sorting would break this. '
            '(2) All positive integers, so extending the window always increases sum. '
            '(3) This is a classic sliding window pattern: expand right to meet target, shrink left to minimize. '
            'O(n) which fits n <= 10^5.",\n'
            '    "correct": "A",\n'
            '    "explanation": "A) Sliding window runs in O(n) — expand right to meet target, '
            'shrink left to minimize length. B) Sorting breaks contiguity. C) DP is O(n^2) and '
            'unnecessary. D) Works in O(n log n) but sliding window is simpler and faster.",\n'
            '    "why_wrong": {"B": "Sorting breaks contiguity — the problem requires contiguous subarrays", '
            '"C": "O(n^2) DP is unnecessary when O(n) sliding window exists", '
            '"D": "Prefix sum + binary search works in O(n log n) but is slower than O(n) sliding window"}\n'
            "  },\n"
            '  {\n'
            '    "problem": "Given a list of courses where each course has a duration and a deadline, '
            'find the maximum number of courses you can take. You can only take one course at a time '
            'and must finish each course before its deadline.",\n'
            '    "example": "Input: courses = [[100,200],[200,1300],[1000,1250],[2000,3200]] → Output: 3",\n'
            '    "constraints": "1 <= n <= 10^4, 1 <= duration <= 10^4, 1 <= deadline <= 10^4",\n'
            '    "variables": {"n": "number of courses"},\n'
            '    "options": [\n'
            '      "A) Greedy + Heap — sort by deadline, use max-heap to drop longest course when over",\n'
            '      "B) DFS — explore all orderings recursively",\n'
            '      "C) Two Pointers — scan from both ends after sorting",\n'
            '      "D) BFS — level-order scheduling of courses"\n'
            '    ],\n'
            '    "reasoning": "This is a scheduling problem: maximize items selected under deadline constraints. '
            'Sort by deadline, greedily add courses. If total time exceeds deadline, remove the longest '
            'course so far (max-heap). This is the classic greedy interval scheduling variant.",\n'
            '    "correct": "A",\n'
            '    "explanation": "A) Sort by deadline, add courses greedily, use heap to swap out longest '
            'when time exceeds deadline. B) DFS explores all orderings = O(n!) too slow. '
            'C) Two pointers doesn\'t apply to scheduling. D) BFS has no applicable graph structure here.",\n'
            '    "why_wrong": {"B": "Exploring all orderings is O(n!) — far too slow for n=10^4", '
            '"C": "Two pointers is for sorted pair-finding, not scheduling", '
            '"D": "BFS requires a graph structure which doesn\'t exist here"}\n'
            "  },\n"
            '  {\n'
            '    "problem": "Given a string, find the length of the longest substring that contains '
            'at most k distinct characters.",\n'
            '    "example": "Input: s = \\"eceba\\", k = 2 → Output: 3 (substring \\"ece\\")",\n'
            '    "constraints": "1 <= n <= 10^5, 1 <= k <= 26",\n'
            '    "variables": {"n": "length of the string", "k": "max distinct characters allowed"},\n'
            '    "options": [\n'
            '      "A) Sliding Window — expand/shrink window tracking character count with hashmap",\n'
            '      "B) Dynamic Programming — dp[i][j] = longest valid substring ending at i with j distinct",\n'
            '      "C) Divide and Conquer — split string and merge results",\n'
            '      "D) Trie — build prefix tree of all substrings"\n'
            '    ],\n'
            '    "reasoning": "We need the longest contiguous substring with <= k distinct chars. '
            'Sliding window with a hashmap counting character frequencies: expand right, and when '
            'distinct count exceeds k, shrink left until valid again. O(n) time.",\n'
            '    "correct": "A",\n'
            '    "explanation": "A) Sliding window with hashmap tracking frequencies — O(n). '
            'B) DP would be O(n*26) at best, overcomplicates a window problem. '
            'C) Divide and conquer can\'t merge substring results correctly. '
            'D) Trie builds all prefixes which is O(n^2) space and time.",\n'
            '    "why_wrong": {"B": "DP is O(n*26) at best and overcomplicates a problem solvable with a window", '
            '"C": "Divide and conquer cannot correctly merge substring results across the split point", '
            '"D": "Trie builds all prefixes requiring O(n^2) space — completely overkill"}\n'
            "  }\n"
            "]}"
        ),
        expected_output=f"Valid JSON with {num_questions} algorithm selection quiz questions.",
        agent=agent,
    )
    result = str(agent.execute_task(task))

    data = extract_json(result)
    if not data or not isinstance(data, dict):
        logger.warning("Failed to parse algorithm quiz JSON | raw: %s", result[:200])
        return []
    questions = data.get("questions", [])

    # Self-verification pass (Idea 3)
    questions = _verify_algorithm_questions(questions)

    return questions


def generate_constraint_quiz(
    agent: Agent,
    num_questions: int = 5,
) -> list[dict]:
    """Generate keyword + constraint → algorithm matching questions (select all that apply)."""
    task = Task(
        description=(
            f"Generate {num_questions} 'constraint-to-algorithm' quiz questions.\n\n"
            + COMPLEXITY_REFERENCE + "\n\n"
            + ALGORITHM_REFERENCE + "\n\n"
            "CHAIN OF THOUGHT: Before choosing correct answers, reason through each option "
            "in a 'reasoning' field. For each option: (1) Does this algorithm solve this problem type? "
            "(2) What is its complexity? (3) Is that feasible for the given n?\n\n"
            "DISTRACTOR VALIDATION: For each WRONG option, include an entry in 'why_wrong' "
            "explaining why it's wrong (too slow, wrong problem type, etc.).\n\n"
            "For each question provide:\n"
            "1. keywords: 2-4 problem signal words (e.g. 'shortest path', 'subarray sum')\n"
            "2. problem: a 1-2 sentence problem description\n"
            "3. example: a short input/output example\n"
            "4. variables: an object mapping EVERY variable used in the constraints to a "
            "plain-English description. Every variable in constraints MUST have an entry.\n"
            "5. constraints: the input size constraint (e.g. '1 <= n <= 10^5')\n"
            "6. options: 6 algorithms/approaches as choices (labeled A-F), each including "
            "its complexity in the label (e.g. 'A) Dijkstra O(E log V)')\n"
            "7. reasoning: your step-by-step analysis checking each option against the constraint\n"
            "8. correct: list of ALL correct answer letters (2-4 correct)\n"
            "9. explanation: for EACH answer, why it works or doesn't\n"
            "10. solution_hints: an object mapping EACH correct answer letter to a 2-3 sentence "
            "description of how to solve the problem using that algorithm\n"
            "11. why_wrong: an object mapping each wrong letter to why it's wrong\n\n"
            "IMPORTANT RULES:\n"
            "- Each question MUST have 2-4 correct answers out of 6 options\n"
            "- Include algorithms that are technically correct but too slow for the constraint\n"
            "- Include algorithms that are fast enough but don't solve the problem type\n"
            "- Vary the constraint ranges across questions\n"
            "- Mix topics: graphs, DP, arrays, trees, strings\n\n"
            "Respond with ONLY valid JSON:\n"
            '{"questions": [\n'
            '  {\n'
            '    "keywords": ["shortest path", "weighted graph"],\n'
            '    "problem": "Given a weighted directed graph with n nodes and m edges, find the shortest path from node 1 to node n.",\n'
            '    "example": "Input: n=4, edges=[[1,2,3],[2,4,1],[1,3,7],[3,4,2]] → Output: 4 (path 1→2→4 with cost 3+1)",\n'
            '    "variables": {"n": "number of nodes in the graph", "m": "number of edges in the graph"},\n'
            '    "constraints": "1 <= n <= 10^5, 1 <= m <= 10^5",\n'
            '    "options": ["A) Dijkstra O(E log V)", "B) Bellman-Ford O(VE)", '
            '"C) Floyd-Warshall O(V^3)", "D) BFS O(V+E)", '
            '"E) DFS O(V+E)", "F) A* O(E log V)"],\n'
            '    "reasoning": "n=10^5: ceiling is O(n log n). A) Dijkstra O(E log V) ≈ 10^5 * 17 ≈ 1.7M → feasible, '
            'handles weighted non-negative. B) Bellman-Ford O(VE) = 10^10 → too slow. C) Floyd-Warshall O(V^3) = 10^15 '
            '→ too slow. D) BFS doesn\'t handle weighted edges correctly. E) DFS doesn\'t find shortest path in weighted '
            'graphs. F) A* O(E log V) similar to Dijkstra → feasible.",\n'
            '    "correct": ["A", "F"],\n'
            '    "explanation": "A) Dijkstra runs in O(E log V) ≈ feasible, handles weighted edges. '
            'F) A* similar complexity with heuristic. B) Bellman-Ford O(VE) = 10^10 too slow. '
            'C) Floyd-Warshall O(V^3) = 10^15 too slow. '
            'D,E) BFS/DFS don\'t handle weighted edges correctly for shortest path.",\n'
            '    "solution_hints": {"A": "Build adjacency list. Run Dijkstra from node 1 using min-heap. '
            'Relax edges greedily — first time node n is popped, that distance is the answer.", '
            '"F": "Like Dijkstra but use a heuristic to guide search toward node n, reducing explored nodes."},\n'
            '    "why_wrong": {"B": "O(VE) = 10^10 exceeds the 10^7 ceiling", '
            '"C": "O(V^3) = 10^15 far too slow", '
            '"D": "BFS only finds shortest path in unweighted graphs", '
            '"E": "DFS does not find shortest paths in weighted graphs"}\n'
            "  },\n"
            '  {\n'
            '    "keywords": ["connected components", "undirected graph"],\n'
            '    "problem": "Given an undirected graph with n nodes and m edges, count the number of connected components.",\n'
            '    "example": "Input: n=5, edges=[[0,1],[1,2],[3,4]] → Output: 2",\n'
            '    "variables": {"n": "number of nodes", "m": "number of edges"},\n'
            '    "constraints": "1 <= n <= 10^6, 0 <= m <= 10^6",\n'
            '    "options": ["A) Union-Find O(n α(n))", "B) BFS O(V+E)", '
            '"C) DFS O(V+E)", "D) Floyd-Warshall O(V^3)", '
            '"E) Dijkstra O(E log V)", "F) Kruskal O(E log E)"],\n'
            '    "reasoning": "n=10^6: ceiling is O(n). A) Union-Find O(n * α(n)) ≈ O(n) → feasible, '
            'perfect for connected components. B) BFS O(V+E) = O(n) → feasible, run from each unvisited. '
            'C) DFS O(V+E) = O(n) → feasible, same approach. D) Floyd-Warshall O(V^3) → way too slow. '
            'E) Dijkstra solves shortest path, not connected components. F) Kruskal finds MST, not components.",\n'
            '    "correct": ["A", "B", "C"],\n'
            '    "explanation": "A) Union-Find is near-linear and designed for connectivity. '
            'B) BFS from each unvisited node counts components in O(V+E). '
            'C) DFS same approach. D) Floyd-Warshall O(n^3) = 10^18 too slow. '
            'E) Dijkstra solves a different problem. F) Kruskal finds MST, not component count.",\n'
            '    "solution_hints": {"A": "Initialize each node as its own parent. For each edge, union the two nodes. '
            'Count distinct roots at the end.", "B": "Maintain a visited set. For each unvisited node, run BFS and '
            'increment counter.", "C": "Same as BFS but use DFS (recursion or stack) instead."},\n'
            '    "why_wrong": {"D": "O(V^3) = 10^18 far too slow for n=10^6", '
            '"E": "Dijkstra solves shortest path, not connected components", '
            '"F": "Kruskal finds minimum spanning tree, not the number of connected components"}\n'
            "  }\n"
            "]}"
        ),
        expected_output=f"Valid JSON with {num_questions} constraint-to-algorithm questions.",
        agent=agent,
    )
    result = str(agent.execute_task(task))

    data = extract_json(result)
    if not data or not isinstance(data, dict):
        logger.warning("Failed to parse constraint quiz JSON | raw: %s", result[:200])
        return []
    questions = data.get("questions", [])

    # Deterministic constraint validation (Idea 6)
    questions = _validate_constraint_answers(questions)

    # Self-verification pass (Idea 3)
    questions = _verify_constraint_questions(questions)

    return questions


def generate_ml_math_question(agent: Agent, topic: str = "all") -> dict:
    """Generate a single ML math question bundle with 4 parts."""
    scope = (
        "any ML-related math topic (linear algebra, probability, calculus, optimization, information theory)"
        if topic == "all"
        else f"the topic of {topic}"
    )

    task = Task(
        description=(
            f"Generate ONE math question bundle about {scope} for an MLE.\n\n"
            + ML_MATH_REFERENCE + "\n\n"
            "IMPORTANT FORMATTING RULES:\n"
            "- Use LaTeX notation for ALL math expressions: wrap inline math in $...$ "
            "and display/block math in $$...$$.\n"
            "- Examples: $\\nabla f(x)$, $\\mathbf{A}^T\\mathbf{A}$, "
            "$$\\frac{\\partial L}{\\partial w} = \\frac{1}{n}\\sum_{i=1}^n ...$$\n"
            "- Use LaTeX for matrices, summations, integrals, fractions, greek letters, etc.\n"
            "- Never use plaintext math like sqrt(x) or a^T*b. Always use LaTeX.\n\n"
            "CHAIN OF THOUGHT: For both the math_question and proof_question, include a "
            "'reasoning' field where you work through the problem step by step BEFORE "
            "choosing the correct answer. Verify your computation is correct.\n\n"
            "The bundle has 4 parts:\n\n"
            "PART 0 - CONCEPT EXPLANATION (teach first!):\n"
            "Before any questions, teach the concept thoroughly:\n"
            "a) concept: A clear 3-5 sentence explanation of the core math concept. "
            "Define what it is, why it matters, and the key formula/theorem.\n"
            "b) analogy: A real-world analogy that makes the concept intuitive.\n"
            "c) simple_example: A fully worked easy example with step-by-step solution. "
            "Use small numbers. Show every step.\n"
            "d) harder_example: A more challenging worked example. Show every step.\n\n"
            "PART 1 - MATH QUESTION (computation):\n"
            "A concrete math problem requiring calculation. 4 options, one correct.\n"
            "Include 'reasoning' (your step-by-step work) and 'solution' (shown to user).\n"
            "Double-check your arithmetic — verify the answer by substituting back.\n\n"
            "PART 2 - PROOF INSERTION:\n"
            "A proof or derivation with ONE step replaced by '___'.\n"
            "Show full proof context (numbered steps). 4 options for the missing step.\n"
            "Include 'reasoning' (why correct step fits) and 'explanation'.\n\n"
            "PART 3 - ML APPLICATION:\n"
            "Name the ML algorithm where this math is directly used.\n"
            "Explain concisely HOW it's used. List 2-3 related algorithms.\n"
            "Use the ML MATH REFERENCE above to ensure correct mappings.\n\n"
            "Respond with ONLY valid JSON:\n"
            "{\n"
            '  "topic": "short topic name",\n'
            '  "concept_explanation": {\n'
            '    "concept": "Clear explanation with LaTeX math...",\n'
            '    "analogy": "Real-world analogy...",\n'
            '    "simple_example": "Step 1: ...\\nStep 2: ...\\nAnswer: ...",\n'
            '    "harder_example": "Step 1: ...\\nStep 2: ...\\nAnswer: ..."\n'
            "  },\n"
            '  "math_question": {\n'
            '    "question": "Compute ...",\n'
            '    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],\n'
            '    "reasoning": "Step-by-step work: First... Then... Therefore...",\n'
            '    "correct": "A",\n'
            '    "solution": "Step-by-step solution shown to the user..."\n'
            "  },\n"
            '  "proof_question": {\n'
            '    "question": "Fill the missing step:",\n'
            '    "context": "1. Start\\n2. ___\\n3. Next step\\n4. Conclusion",\n'
            '    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],\n'
            '    "reasoning": "The missing step must connect step 1 to step 3 by...",\n'
            '    "correct": "A",\n'
            '    "explanation": "Why this step is correct..."\n'
            "  },\n"
            '  "ml_application": {\n'
            '    "algorithm": "Algorithm Name",\n'
            '    "explanation": "How this math is used in the algorithm...",\n'
            '    "related_algorithms": ["Algo1", "Algo2"]\n'
            "  }\n"
            "}"
        ),
        expected_output="Valid JSON with concept_explanation, math_question, proof_question, and ml_application.",
        agent=agent,
    )
    result = str(agent.execute_task(task))

    question = extract_json(result)
    if not question or not isinstance(question, dict):
        logger.warning("Failed to parse ML math question JSON | raw: %s", result[:200])
        return {}

    # Self-verification pass (Idea 3)
    question = _verify_ml_math(question)

    return question
