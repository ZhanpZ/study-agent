"""
Fetch real LeetCode problems via their public GraphQL API.

Maps user-provided topics (e.g. "Binary Search", "Dynamic Programming") to
LeetCode tag slugs and retrieves actual problem statements.
"""

import logging
import random
import time
from collections import OrderedDict
import httpx

logger = logging.getLogger(__name__)

LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql"

# LRU cache for fetched problems (max 64 tag entries, 1h TTL)
_problem_cache: OrderedDict[str, tuple[float, list[dict]]] = OrderedDict()
_PROBLEM_CACHE_TTL = 3600  # 1 hour
_PROBLEM_CACHE_MAX = 64
_MAX_RETRIES = 2

# Map common topic names → LeetCode tag slugs
_TAG_MAP: dict[str, str] = {
    # Data structures
    "array": "array",
    "arrays": "array",
    "string": "string",
    "strings": "string",
    "hash table": "hash-table",
    "hash map": "hash-table",
    "hashmap": "hash-table",
    "linked list": "linked-list",
    "linked lists": "linked-list",
    "stack": "stack",
    "queue": "queue",
    "tree": "tree",
    "trees": "tree",
    "binary tree": "binary-tree",
    "binary trees": "binary-tree",
    "binary search tree": "binary-search-tree",
    "bst": "binary-search-tree",
    "heap": "heap-priority-queue",
    "priority queue": "heap-priority-queue",
    "graph": "graph",
    "graphs": "graph",
    "trie": "trie",
    "matrix": "matrix",
    # Algorithms
    "binary search": "binary-search",
    "two pointers": "two-pointers",
    "two pointer": "two-pointers",
    "sliding window": "sliding-window",
    "sorting": "sorting",
    "sort": "sorting",
    "merge sort": "merge-sort",
    "greedy": "greedy",
    "backtracking": "backtracking",
    "dynamic programming": "dynamic-programming",
    "dp": "dynamic-programming",
    "recursion": "recursion",
    "divide and conquer": "divide-and-conquer",
    "bit manipulation": "bit-manipulation",
    "bitmask": "bitmask",
    "math": "math",
    "dfs": "depth-first-search",
    "depth first search": "depth-first-search",
    "bfs": "breadth-first-search",
    "breadth first search": "breadth-first-search",
    "topological sort": "topological-sort",
    "union find": "union-find",
    "disjoint set": "union-find",
    "shortest path": "shortest-path",
    "dijkstra": "shortest-path",
    "prefix sum": "prefix-sum",
    "monotonic stack": "monotonic-stack",
    "monotonic queue": "monotonic-queue",
    "interval": "interval",
    "intervals": "interval",
    # Common problem names → tags
    "two sum": "hash-table",
    "three sum": "two-pointers",
    "3sum": "two-pointers",
    "subarray": "prefix-sum",
    "subsequence": "dynamic-programming",
    "palindrome": "string",
    "anagram": "hash-table",
    "permutation": "backtracking",
    "combination": "backtracking",
    "knapsack": "dynamic-programming",
}


def _resolve_tag(topic: str) -> str:
    """Resolve a user topic to the closest LeetCode tag slug."""
    normalized = topic.strip().lower()

    # Direct match
    if normalized in _TAG_MAP:
        return _TAG_MAP[normalized]

    # Substring match — find the longest matching key
    best_match = None
    best_len = 0
    for key, slug in _TAG_MAP.items():
        if key in normalized and len(key) > best_len:
            best_match = slug
            best_len = len(key)

    return best_match or "array"  # fallback to array (large pool of problems)


def _build_problemset_query(tag_slug: str, limit: int = 50) -> dict:
    """Build the GraphQL query to fetch problems by tag."""
    return {
        "query": """
            query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
                problemsetQuestionList: questionList(
                    categorySlug: $categorySlug
                    limit: $limit
                    skip: $skip
                    filters: $filters
                ) {
                    total: totalNum
                    questions: data {
                        titleSlug
                        title
                        difficulty
                        frontendQuestionId: questionFrontendId
                        topicTags {
                            slug
                        }
                    }
                }
            }
        """,
        "variables": {
            "categorySlug": "",
            "skip": 0,
            "limit": limit,
            "filters": {"tags": [tag_slug]},
        },
    }


def _build_problem_detail_query(title_slug: str) -> dict:
    """Build the GraphQL query to fetch a single problem's details."""
    return {
        "query": """
            query questionContent($titleSlug: String!) {
                question(titleSlug: $titleSlug) {
                    questionId
                    questionFrontendId
                    title
                    titleSlug
                    content
                    difficulty
                    hints
                    topicTags {
                        name
                        slug
                    }
                    exampleTestcaseList
                    sampleTestCase
                }
            }
        """,
        "variables": {"titleSlug": title_slug},
    }


def _html_to_text(html: str) -> str:
    """Minimal HTML → plain text/markdown conversion for problem statements."""
    import re

    text = html
    # Convert common HTML elements
    text = re.sub(r"<strong>(.*?)</strong>", r"**\1**", text)
    text = re.sub(r"<b>(.*?)</b>", r"**\1**", text)
    text = re.sub(r"<em>(.*?)</em>", r"*\1*", text)
    text = re.sub(r"<code>(.*?)</code>", r"`\1`", text)
    text = re.sub(r"<pre>(.*?)</pre>", r"```\n\1\n```", text, flags=re.DOTALL)
    text = re.sub(r"<li>(.*?)</li>", r"- \1", text)
    text = re.sub(r"<p>", "\n", text)
    text = re.sub(r"</p>", "", text)
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<sup>(.*?)</sup>", r"^\1", text)
    text = re.sub(r"<sub>(.*?)</sub>", r"_\1", text)
    text = re.sub(r"</?ul>", "", text)
    text = re.sub(r"</?ol>", "", text)
    text = re.sub(r"</?div[^>]*>", "", text)
    text = re.sub(r"<img[^>]*/>", "", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&quot;", '"', text)
    text = re.sub(r"&#39;", "'", text)
    # Remove remaining tags
    text = re.sub(r"<[^>]+>", "", text)
    # Clean up excessive whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _fetch_problem_list(client: httpx.Client, tag_slug: str) -> list[dict]:
    """Fetch problem list for a tag, with cache."""
    now = time.time()
    if tag_slug in _problem_cache:
        cached_time, cached_list = _problem_cache[tag_slug]
        if now - cached_time < _PROBLEM_CACHE_TTL:
            _problem_cache.move_to_end(tag_slug)
            return cached_list
        else:
            del _problem_cache[tag_slug]

    list_resp = client.post(
        LEETCODE_GRAPHQL_URL,
        json=_build_problemset_query(tag_slug, limit=50),
        headers={
            "Content-Type": "application/json",
            "Referer": "https://leetcode.com",
        },
    )
    list_resp.raise_for_status()
    list_data = list_resp.json()

    questions = (
        list_data.get("data", {})
        .get("problemsetQuestionList", {})
        .get("questions", [])
    )

    if questions:
        _problem_cache[tag_slug] = (now, questions)
        while len(_problem_cache) > _PROBLEM_CACHE_MAX:
            _problem_cache.popitem(last=False)

    return questions


def fetch_leetcode_problem(topic: str, difficulty: str | None = None) -> dict | None:
    """
    Fetch a real LeetCode problem matching the given topic.

    Returns dict with keys: problem, hints, title, difficulty, url
    Returns None if fetch fails (caller should fall back to generated question).
    Uses retry with exponential backoff and caches problem lists.
    """
    tag_slug = _resolve_tag(topic)
    logger.info("Fetching LeetCode problem for topic='%s' → tag='%s'", topic, tag_slug)

    last_err = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            with httpx.Client(timeout=15.0) as client:
                # Step 1: Get list of problems for this tag (cached)
                questions = _fetch_problem_list(client, tag_slug)

                if not questions:
                    logger.warning("No problems found for tag '%s'", tag_slug)
                    return None

                # Filter by difficulty if specified
                if difficulty:
                    diff_upper = difficulty.capitalize()
                    filtered = [q for q in questions if q.get("difficulty") == diff_upper]
                    if filtered:
                        questions = filtered

                # Pick a random problem from the pool
                chosen = random.choice(questions)
                title_slug = chosen["titleSlug"]

                # Step 2: Fetch full problem details
                detail_resp = client.post(
                    LEETCODE_GRAPHQL_URL,
                    json=_build_problem_detail_query(title_slug),
                    headers={
                        "Content-Type": "application/json",
                        "Referer": "https://leetcode.com",
                    },
                )
                detail_resp.raise_for_status()
                detail_data = detail_resp.json()

                question = detail_data.get("data", {}).get("question")
                if not question or not question.get("content"):
                    logger.warning("No content for problem '%s'", title_slug)
                    return None

                # Convert HTML content to readable markdown
                problem_text = _html_to_text(question["content"])
                frontend_id = question.get("questionFrontendId", "")
                title = question.get("title", "")
                diff = question.get("difficulty", "Medium")

                formatted_problem = (
                    f"**{frontend_id}. {title}** ({diff})\n\n"
                    f"{problem_text}"
                )

                hints = question.get("hints") or []
                hints = [_html_to_text(h) for h in hints]

                return {
                    "problem": formatted_problem,
                    "hints": hints if hints else ["Think about the time complexity", "Consider edge cases"],
                    "title": title,
                    "difficulty": diff,
                    "url": f"https://leetcode.com/problems/{title_slug}/",
                    "leetcode_id": frontend_id,
                }

        except (httpx.TimeoutException, httpx.HTTPStatusError, httpx.ConnectError) as e:
            last_err = e
            if attempt < _MAX_RETRIES:
                delay = 1.0 * (2 ** attempt)
                logger.warning("LeetCode fetch attempt %d failed: %s. Retrying in %.1fs...", attempt + 1, e, delay)
                time.sleep(delay)
            else:
                logger.warning("LeetCode fetch failed after %d attempts: %s", _MAX_RETRIES + 1, e)
        except Exception as e:
            logger.error("Unexpected error fetching LeetCode problem: %s", e, exc_info=True)
            return None

    return None
