import json
from crewai import Agent, Task
from backend.config import MODEL_STRONG


def create_quiz_agent() -> Agent:
    return Agent(
        role="Algorithm Selection Quiz Master",
        goal=(
            "Generate algorithm selection quiz questions. "
            "Create realistic problem descriptions with constraints "
            "where the user must identify the correct algorithm/approach."
        ),
        backstory=(
            "Expert competitive programmer and tech interviewer. "
            "You design problems requiring pattern recognition: sliding window, "
            "two pointers, BFS/DFS, DP, binary search, greedy, union find, etc."
        ),
        llm=MODEL_STRONG,
        verbose=False,
        allow_delegation=False,
    )


def generate_algorithm_quiz(
    agent: Agent,
    topic_scope: str = "all",
    num_questions: int = 5,
) -> list[dict]:
    scope_text = (
        "covering all algorithm/data structure topics"
        if topic_scope == "all"
        else f"focused on {topic_scope} algorithms"
    )

    task = Task(
        description=(
            f"Generate {num_questions} algorithm selection quiz questions {scope_text}.\n\n"
            "Each question needs:\n"
            "1. Problem description (leetcode-style)\n"
            "2. Example with input/output\n"
            "3. Constraints (input size, value ranges)\n"
            "4. 4 algorithm/approach choices (include plausible-but-wrong options)\n"
            "5. Correct answer letter\n"
            "6. Explanation of why that algorithm fits\n\n"
            "Vary difficulty. Respond with ONLY valid JSON:\n"
            '{"questions": [\n'
            '  {\n'
            '    "problem": "...",\n'
            '    "example": "Input: ... Output: ...",\n'
            '    "constraints": "1 <= n <= 10^5, ...",\n'
            '    "options": ["A) BFS", "B) Binary Search", "C) DP", "D) Greedy"],\n'
            '    "correct": "B",\n'
            '    "explanation": "Why this is the best approach..."\n'
            "  }\n"
            "]}"
        ),
        expected_output=f"Valid JSON with {num_questions} algorithm selection quiz questions.",
        agent=agent,
    )
    result = str(agent.execute_task(task))

    try:
        json_start = result.index("{")
        json_end = result.rindex("}") + 1
        data = json.loads(result[json_start:json_end])
        return data.get("questions", [])
    except (json.JSONDecodeError, ValueError):
        return []


def generate_constraint_quiz(
    agent: Agent,
    num_questions: int = 5,
) -> list[dict]:
    """Generate keyword + constraint → algorithm matching questions (select all that apply).

    The core idea: given problem keywords and input constraints, identify ALL
    algorithms that could run within ~10^7 operations (Python LC ceiling).
    """
    task = Task(
        description=(
            f"Generate {num_questions} 'constraint-to-algorithm' quiz questions.\n\n"
            "CONCEPT: In Python on LeetCode, ~10^7 operations is the practical ceiling.\n"
            "Given input size n, the feasible complexities are:\n"
            "- n <= 10: O(n!), O(2^n * n) — brute-force permutations\n"
            "- n <= 20: O(2^n) — bitmask DP, subset enumeration\n"
            "- n <= 100: O(n^3) — Floyd-Warshall, cubic DP\n"
            "- n <= 1000: O(n^2) — quadratic DP, nested loops\n"
            "- n <= 10^5: O(n log n) — sorting, divide & conquer, segment trees\n"
            "- n <= 10^6: O(n) — linear scan, two pointers, sliding window\n"
            "- n <= 10^8: O(log n) or O(1) — binary search, math\n\n"
            "For each question provide:\n"
            "1. keywords: 2-4 problem signal words (e.g. 'shortest path', 'subarray sum', "
            "'connected components', 'subsequence')\n"
            "2. constraints: the input size constraint (e.g. '1 <= n <= 10^5')\n"
            "3. options: 6 algorithms/approaches as choices (labeled A-F)\n"
            "4. correct: list of ALL correct answer letters (multiple can be correct)\n"
            "5. explanation: for EACH correct answer, why it works within the constraint; "
            "for EACH wrong answer, why it's too slow or doesn't fit\n\n"
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
            '    "constraints": "1 <= n <= 10^5, 1 <= edges <= 10^5",\n'
            '    "options": ["A) Dijkstra O(E log V)", "B) Bellman-Ford O(VE)", '
            '"C) Floyd-Warshall O(V^3)", "D) BFS O(V+E)", '
            '"E) DFS O(V+E)", "F) A* O(E log V)"],\n'
            '    "correct": ["A", "F"],\n'
            '    "explanation": "A) Dijkstra runs in O(E log V) ≈ 10^5 * 17 ≈ feasible. '
            'F) A* similar complexity. B) Bellman-Ford O(VE) = 10^10 too slow. '
            'C) Floyd-Warshall O(V^3) = 10^15 too slow. '
            'D,E) BFS/DFS don\'t handle weighted edges correctly."\n'
            "  }\n"
            "]}"
        ),
        expected_output=f"Valid JSON with {num_questions} constraint-to-algorithm questions.",
        agent=agent,
    )
    result = str(agent.execute_task(task))

    try:
        json_start = result.index("{")
        json_end = result.rindex("}") + 1
        data = json.loads(result[json_start:json_end])
        return data.get("questions", [])
    except (json.JSONDecodeError, ValueError):
        return []


def create_ml_math_agent() -> Agent:
    return Agent(
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
        llm=MODEL_STRONG,
        verbose=False,
        allow_delegation=False,
    )


def generate_ml_math_question(agent: Agent, topic: str = "all") -> dict:
    """Generate a single ML math question bundle with 3 parts:
    math MC, proof insertion MC, and ML application context.
    """
    scope = (
        "any ML-related math topic (linear algebra, probability, calculus, optimization, information theory)"
        if topic == "all"
        else f"the topic of {topic}"
    )

    task = Task(
        description=(
            f"Generate ONE math question bundle about {scope} for an MLE.\n\n"
            "The bundle has 3 parts:\n\n"
            "PART 1 - MATH QUESTION (computation):\n"
            "A concrete math problem requiring calculation. 4 options, one correct.\n"
            "Include the full worked solution.\n\n"
            "PART 2 - PROOF INSERTION:\n"
            "A proof or derivation relevant to the same topic with ONE step replaced by '___'.\n"
            "Show the full proof context (numbered steps). 4 options for the missing step.\n"
            "Include explanation of why the correct step fits.\n\n"
            "PART 3 - ML APPLICATION:\n"
            "Name the ML algorithm where this math is directly used.\n"
            "Explain concisely HOW it's used (not just that it's used).\n"
            "List 2-3 related algorithms that also use this math.\n\n"
            "Respond with ONLY valid JSON:\n"
            "{\n"
            '  "topic": "short topic name",\n'
            '  "math_question": {\n'
            '    "question": "Compute ...",\n'
            '    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],\n'
            '    "correct": "A",\n'
            '    "solution": "Step-by-step solution..."\n'
            "  },\n"
            '  "proof_question": {\n'
            '    "question": "Fill the missing step:",\n'
            '    "context": "1. Start\\n2. ___\\n3. Next step\\n4. Conclusion",\n'
            '    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],\n'
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
        expected_output="Valid JSON with math_question, proof_question, and ml_application.",
        agent=agent,
    )
    result = str(agent.execute_task(task))

    try:
        json_start = result.index("{")
        json_end = result.rindex("}") + 1
        return json.loads(result[json_start:json_end])
    except (json.JSONDecodeError, ValueError):
        return {}
