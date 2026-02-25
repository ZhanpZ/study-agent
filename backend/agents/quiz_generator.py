import json
import logging
from crewai import Agent, Task
from backend.config import MODEL_FAST

logger = logging.getLogger(__name__)


_quiz_agent: Agent | None = None


def create_quiz_agent() -> Agent:
    """Return a singleton quiz agent (created once, reused across requests)."""
    global _quiz_agent
    if _quiz_agent is None:
        _quiz_agent = Agent(
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
            llm=MODEL_FAST,
            verbose=False,
            allow_delegation=False,
        )
    return _quiz_agent


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
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("Failed to parse algorithm quiz JSON: %s | raw: %s", e, result[:200])
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
            "2. problem: a 1-2 sentence problem description, like a mini LeetCode problem "
            "statement (e.g. 'Given a weighted directed graph with n nodes and m edges, "
            "find the shortest path from node 1 to node n.')\n"
            "3. example: a short input/output example that makes the problem concrete "
            "(e.g. 'Input: n=4, edges=[[1,2,3],[2,4,1],[1,3,7],[3,4,2]] → Output: 4 "
            "(path 1→2→4 with cost 3+1)')\n"
            "4. variables: an object mapping EVERY variable used in the constraints to a "
            "plain-English description (e.g. {\"n\": \"number of nodes in the graph\", "
            "\"edges\": \"number of edges in the graph\"}). Every variable that appears in "
            "the constraints string MUST have an entry here.\n"
            "5. constraints: the input size constraint (e.g. '1 <= n <= 10^5')\n"
            "6. options: 6 algorithms/approaches as choices (labeled A-F)\n"
            "7. correct: list of ALL correct answer letters (multiple can be correct)\n"
            "8. explanation: for EACH correct answer, why it works within the constraint; "
            "for EACH wrong answer, why it's too slow or doesn't fit\n"
            "9. solution_hints: an object mapping EACH correct answer letter to a 2-3 sentence "
            "description of how to solve the problem using that algorithm. Describe the approach "
            "step by step (e.g. {\"A\": \"Build an adjacency list. Run Dijkstra from node 1 using "
            "a min-heap. Relax edges greedily — the first time node n is popped, that distance is "
            "the answer.\"})\n\n"
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
            '    "variables": {"n": "number of nodes in the graph", "edges": "number of edges in the graph"},\n'
            '    "constraints": "1 <= n <= 10^5, 1 <= edges <= 10^5",\n'
            '    "options": ["A) Dijkstra O(E log V)", "B) Bellman-Ford O(VE)", '
            '"C) Floyd-Warshall O(V^3)", "D) BFS O(V+E)", '
            '"E) DFS O(V+E)", "F) A* O(E log V)"],\n'
            '    "correct": ["A", "F"],\n'
            '    "explanation": "A) Dijkstra runs in O(E log V) ≈ 10^5 * 17 ≈ feasible. '
            'F) A* similar complexity. B) Bellman-Ford O(VE) = 10^10 too slow. '
            'C) Floyd-Warshall O(V^3) = 10^15 too slow. '
            'D,E) BFS/DFS don\'t handle weighted edges correctly.",\n'
            '    "solution_hints": {"A": "Build an adjacency list from the edge list. Run Dijkstra from node 1 using a min-heap (heapq). Relax edges greedily — the first time node n is popped, that distance is the answer.", '
            '"F": "Similar to Dijkstra but use a heuristic function (e.g. Euclidean distance if coordinates are given) to guide the search toward node n, reducing the number of nodes explored."}\n'
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
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("Failed to parse constraint quiz JSON: %s | raw: %s", e, result[:200])
        return []


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
        llm=MODEL_FAST,
        verbose=False,
        allow_delegation=False,
    )
    return _ml_math_agent


def generate_ml_math_question(agent: Agent, topic: str = "all") -> dict:
    """Generate a single ML math question bundle with 4 parts:
    concept explanation, math MC, proof insertion MC, and ML application context.
    """
    scope = (
        "any ML-related math topic (linear algebra, probability, calculus, optimization, information theory)"
        if topic == "all"
        else f"the topic of {topic}"
    )

    task = Task(
        description=(
            f"Generate ONE math question bundle about {scope} for an MLE.\n\n"
            "IMPORTANT FORMATTING RULES:\n"
            "- Use LaTeX notation for ALL math expressions: wrap inline math in $...$ "
            "and display/block math in $$...$$.\n"
            "- Examples: $\\nabla f(x)$, $\\mathbf{A}^T\\mathbf{A}$, "
            "$$\\frac{\\partial L}{\\partial w} = \\frac{1}{n}\\sum_{i=1}^n ...$$\n"
            "- Use LaTeX for matrices, summations, integrals, fractions, greek letters, etc.\n"
            "- Never use plaintext math like sqrt(x) or a^T*b. Always use LaTeX.\n\n"
            "The bundle has 4 parts:\n\n"
            "PART 0 - CONCEPT EXPLANATION (teach first!):\n"
            "Before any questions, teach the concept thoroughly:\n"
            "a) concept: A clear 3-5 sentence explanation of the core math concept. "
            "Define what it is, why it matters, and the key formula/theorem.\n"
            "b) analogy: A real-world analogy that makes the concept intuitive "
            "(e.g., eigenvalues are like the natural axes a shape wants to stretch along).\n"
            "c) simple_example: A fully worked easy example with step-by-step solution. "
            "Use small numbers. Show every step.\n"
            "d) harder_example: A more challenging worked example that builds on the simple one. "
            "Still show every step but introduce a twist or higher dimension.\n\n"
            "PART 1 - MATH QUESTION (computation):\n"
            "A concrete math problem requiring calculation. 4 options, one correct.\n"
            "Include the full worked solution. Difficulty should be between the simple and harder examples.\n\n"
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
            '  "concept_explanation": {\n'
            '    "concept": "Clear explanation of the concept with LaTeX math...",\n'
            '    "analogy": "Real-world analogy to build intuition...",\n'
            '    "simple_example": "Step 1: ...\\nStep 2: ...\\nAnswer: ...",\n'
            '    "harder_example": "Step 1: ...\\nStep 2: ...\\nAnswer: ..."\n'
            "  },\n"
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
        expected_output="Valid JSON with concept_explanation, math_question, proof_question, and ml_application.",
        agent=agent,
    )
    result = str(agent.execute_task(task))

    try:
        json_start = result.index("{")
        json_end = result.rindex("}") + 1
        return json.loads(result[json_start:json_end])
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("Failed to parse ML math question JSON: %s | raw: %s", e, result[:200])
        return {}
