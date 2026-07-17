import json
import logging
import random
from crewai import Agent, Task
from pydantic import BaseModel, Field
from backend.config import LLM_MATH  # temp=0.2, good for code evaluation
from backend.utils import parse_and_validate
from backend.services.llm_guard import call_agent_task, LLMCallFailedError

logger = logging.getLogger(__name__)


# ─── Pydantic model for evaluation response ──────────────────────
class TemplateEvaluation(BaseModel):
    overall_score: float = 0
    structural_correctness: float = 0
    algorithmic_correctness: float = 0
    complexity_correctness: float = 0
    edge_case_handling: float = 0
    code_quality: float = 0
    missing_methods: list[str] = Field(default_factory=list)
    bugs: list[str] = Field(default_factory=list)
    feedback: str = ""
    corrected_code: str = ""


# ─── Static Template Catalog ─────────────────────────────────────
DSA_TEMPLATES = [
    # ── Data Structures ──────────────────────────────────────────
    {
        "id": "trie",
        "name": "Trie (Prefix Tree)",
        "category": "data_structure",
        "difficulty": "medium",
        "description": "Implement a Trie that supports inserting words, searching for exact matches, and checking if any stored word starts with a given prefix.",
        "required_methods": [
            "__init__(self)",
            "insert(self, word: str) -> None",
            "search(self, word: str) -> bool",
            "starts_with(self, prefix: str) -> bool",
        ],
        "expected_complexity": {
            "insert": "O(m) where m = word length",
            "search": "O(m)",
            "starts_with": "O(m)",
        },
        "reference_implementation": """class Trie:
    def __init__(self):
        self.children = {}
        self.is_end = False

    def insert(self, word: str) -> None:
        node = self
        for ch in word:
            if ch not in node.children:
                node.children[ch] = Trie()
            node = node.children[ch]
        node.is_end = True

    def search(self, word: str) -> bool:
        node = self._find(word)
        return node is not None and node.is_end

    def starts_with(self, prefix: str) -> bool:
        return self._find(prefix) is not None

    def _find(self, prefix: str):
        node = self
        for ch in prefix:
            if ch not in node.children:
                return None
            node = node.children[ch]
        return node""",
        "tags": ["string", "tree", "prefix"],
    },
    {
        "id": "union_find",
        "name": "Union-Find (Disjoint Set Union)",
        "category": "data_structure",
        "difficulty": "medium",
        "description": "Implement Union-Find with path compression and union by rank. Support find(x) to get the root representative and union(x, y) to merge two sets.",
        "required_methods": [
            "__init__(self, n: int)",
            "find(self, x: int) -> int",
            "union(self, x: int, y: int) -> bool",
        ],
        "expected_complexity": {
            "find": "O(α(n)) amortized",
            "union": "O(α(n)) amortized",
        },
        "reference_implementation": """class UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x: int) -> int:
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x: int, y: int) -> bool:
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1
        return True""",
        "tags": ["graph", "connectivity"],
    },
    {
        "id": "segment_tree",
        "name": "Segment Tree (Range Sum Query)",
        "category": "data_structure",
        "difficulty": "hard",
        "description": "Implement a Segment Tree that supports point updates and range sum queries on an array of integers.",
        "required_methods": [
            "__init__(self, nums: list[int])",
            "update(self, index: int, val: int) -> None",
            "query(self, left: int, right: int) -> int",
        ],
        "expected_complexity": {
            "build": "O(n)",
            "update": "O(log n)",
            "query": "O(log n)",
        },
        "reference_implementation": """class SegmentTree:
    def __init__(self, nums: list[int]):
        self.n = len(nums)
        self.tree = [0] * (2 * self.n)
        for i in range(self.n):
            self.tree[self.n + i] = nums[i]
        for i in range(self.n - 1, 0, -1):
            self.tree[i] = self.tree[2 * i] + self.tree[2 * i + 1]

    def update(self, index: int, val: int) -> None:
        pos = index + self.n
        self.tree[pos] = val
        while pos > 1:
            pos //= 2
            self.tree[pos] = self.tree[2 * pos] + self.tree[2 * pos + 1]

    def query(self, left: int, right: int) -> int:
        res = 0
        l, r = left + self.n, right + self.n + 1
        while l < r:
            if l & 1:
                res += self.tree[l]
                l += 1
            if r & 1:
                r -= 1
                res += self.tree[r]
            l >>= 1
            r >>= 1
        return res""",
        "tags": ["array", "range-query", "tree"],
    },
    {
        "id": "fenwick_tree",
        "name": "Binary Indexed Tree (Fenwick Tree)",
        "category": "data_structure",
        "difficulty": "medium",
        "description": "Implement a Fenwick Tree (BIT) that supports point updates and prefix sum queries on an array of integers.",
        "required_methods": [
            "__init__(self, n: int)",
            "update(self, index: int, delta: int) -> None",
            "query(self, index: int) -> int",
            "range_query(self, left: int, right: int) -> int",
        ],
        "expected_complexity": {
            "update": "O(log n)",
            "query": "O(log n)",
        },
        "reference_implementation": """class FenwickTree:
    def __init__(self, n: int):
        self.n = n
        self.tree = [0] * (n + 1)

    def update(self, index: int, delta: int) -> None:
        i = index + 1
        while i <= self.n:
            self.tree[i] += delta
            i += i & (-i)

    def query(self, index: int) -> int:
        s = 0
        i = index + 1
        while i > 0:
            s += self.tree[i]
            i -= i & (-i)
        return s

    def range_query(self, left: int, right: int) -> int:
        return self.query(right) - (self.query(left - 1) if left > 0 else 0)""",
        "tags": ["array", "prefix-sum", "tree"],
    },
    {
        "id": "min_heap",
        "name": "Min Heap (Priority Queue)",
        "category": "data_structure",
        "difficulty": "medium",
        "description": "Implement a Min Heap from scratch (do NOT use heapq). Support push, pop (extract min), and peek operations using a list-based binary heap.",
        "required_methods": [
            "__init__(self)",
            "push(self, val: int) -> None",
            "pop(self) -> int",
            "peek(self) -> int",
            "_sift_up(self, i: int) -> None",
            "_sift_down(self, i: int) -> None",
        ],
        "expected_complexity": {
            "push": "O(log n)",
            "pop": "O(log n)",
            "peek": "O(1)",
        },
        "reference_implementation": """class MinHeap:
    def __init__(self):
        self.heap = []

    def push(self, val: int) -> None:
        self.heap.append(val)
        self._sift_up(len(self.heap) - 1)

    def pop(self) -> int:
        if not self.heap:
            raise IndexError("pop from empty heap")
        self.heap[0], self.heap[-1] = self.heap[-1], self.heap[0]
        val = self.heap.pop()
        if self.heap:
            self._sift_down(0)
        return val

    def peek(self) -> int:
        if not self.heap:
            raise IndexError("peek from empty heap")
        return self.heap[0]

    def _sift_up(self, i: int) -> None:
        while i > 0:
            parent = (i - 1) // 2
            if self.heap[i] < self.heap[parent]:
                self.heap[i], self.heap[parent] = self.heap[parent], self.heap[i]
                i = parent
            else:
                break

    def _sift_down(self, i: int) -> None:
        n = len(self.heap)
        while 2 * i + 1 < n:
            smallest = i
            left, right = 2 * i + 1, 2 * i + 2
            if left < n and self.heap[left] < self.heap[smallest]:
                smallest = left
            if right < n and self.heap[right] < self.heap[smallest]:
                smallest = right
            if smallest == i:
                break
            self.heap[i], self.heap[smallest] = self.heap[smallest], self.heap[i]
            i = smallest""",
        "tags": ["heap", "priority-queue"],
    },
    {
        "id": "lru_cache",
        "name": "LRU Cache",
        "category": "data_structure",
        "difficulty": "medium",
        "description": "Implement an LRU (Least Recently Used) Cache with O(1) get and put operations using a hash map and doubly linked list.",
        "required_methods": [
            "__init__(self, capacity: int)",
            "get(self, key: int) -> int",
            "put(self, key: int, value: int) -> None",
        ],
        "expected_complexity": {
            "get": "O(1)",
            "put": "O(1)",
        },
        "reference_implementation": """class Node:
    def __init__(self, key=0, val=0):
        self.key = key
        self.val = val
        self.prev = None
        self.next = None

class LRUCache:
    def __init__(self, capacity: int):
        self.cap = capacity
        self.cache = {}
        self.head = Node()
        self.tail = Node()
        self.head.next = self.tail
        self.tail.prev = self.head

    def _remove(self, node):
        node.prev.next = node.next
        node.next.prev = node.prev

    def _add_to_front(self, node):
        node.next = self.head.next
        node.prev = self.head
        self.head.next.prev = node
        self.head.next = node

    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        node = self.cache[key]
        self._remove(node)
        self._add_to_front(node)
        return node.val

    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            self._remove(self.cache[key])
        node = Node(key, value)
        self.cache[key] = node
        self._add_to_front(node)
        if len(self.cache) > self.cap:
            lru = self.tail.prev
            self._remove(lru)
            del self.cache[lru.key]""",
        "tags": ["hash-map", "linked-list", "design"],
    },
    {
        "id": "monotonic_stack",
        "name": "Monotonic Stack",
        "category": "data_structure",
        "difficulty": "easy",
        "description": "Implement a function that uses a monotonic stack to find the next greater element for each element in an array. Return an array where result[i] is the next element greater than nums[i], or -1 if none exists.",
        "required_methods": [
            "next_greater_element(nums: list[int]) -> list[int]",
        ],
        "expected_complexity": {
            "next_greater_element": "O(n)",
        },
        "reference_implementation": """def next_greater_element(nums: list[int]) -> list[int]:
    n = len(nums)
    result = [-1] * n
    stack = []  # stores indices
    for i in range(n):
        while stack and nums[i] > nums[stack[-1]]:
            result[stack.pop()] = nums[i]
        stack.append(i)
    return result""",
        "tags": ["stack", "array"],
    },
    {
        "id": "monotonic_deque",
        "name": "Monotonic Deque (Sliding Window Maximum)",
        "category": "data_structure",
        "difficulty": "medium",
        "description": "Implement a function that uses a monotonic deque to find the maximum value in every sliding window of size k across an array.",
        "required_methods": [
            "max_sliding_window(nums: list[int], k: int) -> list[int]",
        ],
        "expected_complexity": {
            "max_sliding_window": "O(n)",
        },
        "reference_implementation": """from collections import deque

def max_sliding_window(nums: list[int], k: int) -> list[int]:
    dq = deque()  # stores indices, front = max
    result = []
    for i, num in enumerate(nums):
        # Remove elements outside window
        while dq and dq[0] < i - k + 1:
            dq.popleft()
        # Maintain decreasing order
        while dq and nums[dq[-1]] <= num:
            dq.pop()
        dq.append(i)
        if i >= k - 1:
            result.append(nums[dq[0]])
    return result""",
        "tags": ["deque", "sliding-window"],
    },
    # ── Algorithm Templates ──────────────────────────────────────
    {
        "id": "binary_search_lower",
        "name": "Binary Search (Lower Bound / bisect_left)",
        "category": "algorithm",
        "difficulty": "easy",
        "description": "Implement binary search to find the leftmost insertion point for a target in a sorted array (equivalent to bisect_left). Returns the index of the first element >= target.",
        "required_methods": [
            "bisect_left(nums: list[int], target: int) -> int",
        ],
        "expected_complexity": {
            "bisect_left": "O(log n)",
        },
        "reference_implementation": """def bisect_left(nums: list[int], target: int) -> int:
    lo, hi = 0, len(nums)
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo""",
        "tags": ["binary-search", "array"],
    },
    {
        "id": "binary_search_upper",
        "name": "Binary Search (Upper Bound / bisect_right)",
        "category": "algorithm",
        "difficulty": "easy",
        "description": "Implement binary search to find the rightmost insertion point for a target in a sorted array (equivalent to bisect_right). Returns the index of the first element > target.",
        "required_methods": [
            "bisect_right(nums: list[int], target: int) -> int",
        ],
        "expected_complexity": {
            "bisect_right": "O(log n)",
        },
        "reference_implementation": """def bisect_right(nums: list[int], target: int) -> int:
    lo, hi = 0, len(nums)
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] <= target:
            lo = mid + 1
        else:
            hi = mid
    return lo""",
        "tags": ["binary-search", "array"],
    },
    {
        "id": "sliding_window_variable",
        "name": "Sliding Window (Variable Size)",
        "category": "algorithm",
        "difficulty": "medium",
        "description": "Implement the variable-size sliding window template: find the length of the longest substring without repeating characters.",
        "required_methods": [
            "length_of_longest_substring(s: str) -> int",
        ],
        "expected_complexity": {
            "length_of_longest_substring": "O(n)",
        },
        "reference_implementation": """def length_of_longest_substring(s: str) -> int:
    seen = {}
    left = 0
    max_len = 0
    for right, ch in enumerate(s):
        if ch in seen and seen[ch] >= left:
            left = seen[ch] + 1
        seen[ch] = right
        max_len = max(max_len, right - left + 1)
    return max_len""",
        "tags": ["sliding-window", "string", "hash-map"],
    },
    {
        "id": "sliding_window_fixed",
        "name": "Sliding Window (Fixed Size)",
        "category": "algorithm",
        "difficulty": "easy",
        "description": "Implement the fixed-size sliding window template: find the maximum sum of any contiguous subarray of size k.",
        "required_methods": [
            "max_sum_subarray(nums: list[int], k: int) -> int",
        ],
        "expected_complexity": {
            "max_sum_subarray": "O(n)",
        },
        "reference_implementation": """def max_sum_subarray(nums: list[int], k: int) -> int:
    if len(nums) < k:
        return 0
    window_sum = sum(nums[:k])
    max_sum = window_sum
    for i in range(k, len(nums)):
        window_sum += nums[i] - nums[i - k]
        max_sum = max(max_sum, window_sum)
    return max_sum""",
        "tags": ["sliding-window", "array"],
    },
    {
        "id": "two_pointers",
        "name": "Two Pointers (Sorted Two Sum)",
        "category": "algorithm",
        "difficulty": "easy",
        "description": "Implement the two-pointer technique on a sorted array: given a sorted array and a target, return the indices of two numbers that add up to the target. Assume exactly one solution exists.",
        "required_methods": [
            "two_sum_sorted(nums: list[int], target: int) -> list[int]",
        ],
        "expected_complexity": {
            "two_sum_sorted": "O(n)",
        },
        "reference_implementation": """def two_sum_sorted(nums: list[int], target: int) -> list[int]:
    left, right = 0, len(nums) - 1
    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return [left, right]
        elif total < target:
            left += 1
        else:
            right -= 1
    return []""",
        "tags": ["two-pointers", "array"],
    },
    {
        "id": "bfs_template",
        "name": "BFS (Breadth-First Search)",
        "category": "algorithm",
        "difficulty": "easy",
        "description": "Implement BFS to find the shortest path distance from a source node to all other nodes in an unweighted graph represented as an adjacency list. Return a dict mapping each node to its distance (-1 if unreachable).",
        "required_methods": [
            "bfs(graph: dict[int, list[int]], source: int) -> dict[int, int]",
        ],
        "expected_complexity": {
            "bfs": "O(V + E)",
        },
        "reference_implementation": """from collections import deque

def bfs(graph: dict[int, list[int]], source: int) -> dict[int, int]:
    dist = {node: -1 for node in graph}
    dist[source] = 0
    queue = deque([source])
    while queue:
        node = queue.popleft()
        for neighbor in graph[node]:
            if dist[neighbor] == -1:
                dist[neighbor] = dist[node] + 1
                queue.append(neighbor)
    return dist""",
        "tags": ["graph", "bfs", "shortest-path"],
    },
    {
        "id": "dfs_template",
        "name": "DFS (Depth-First Search)",
        "category": "algorithm",
        "difficulty": "easy",
        "description": "Implement iterative DFS to find all nodes reachable from a source in a graph represented as an adjacency list. Return the set of visited nodes.",
        "required_methods": [
            "dfs(graph: dict[int, list[int]], source: int) -> set[int]",
        ],
        "expected_complexity": {
            "dfs": "O(V + E)",
        },
        "reference_implementation": """def dfs(graph: dict[int, list[int]], source: int) -> set[int]:
    visited = set()
    stack = [source]
    while stack:
        node = stack.pop()
        if node in visited:
            continue
        visited.add(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                stack.append(neighbor)
    return visited""",
        "tags": ["graph", "dfs"],
    },
    {
        "id": "topological_sort",
        "name": "Topological Sort (Kahn's Algorithm)",
        "category": "algorithm",
        "difficulty": "medium",
        "description": "Implement Kahn's algorithm for topological sorting of a DAG. Given the number of nodes and a list of directed edges, return a valid topological order or an empty list if a cycle exists.",
        "required_methods": [
            "topological_sort(num_nodes: int, edges: list[list[int]]) -> list[int]",
        ],
        "expected_complexity": {
            "topological_sort": "O(V + E)",
        },
        "reference_implementation": """from collections import deque

def topological_sort(num_nodes: int, edges: list[list[int]]) -> list[int]:
    graph = [[] for _ in range(num_nodes)]
    in_degree = [0] * num_nodes
    for u, v in edges:
        graph[u].append(v)
        in_degree[v] += 1
    queue = deque(i for i in range(num_nodes) if in_degree[i] == 0)
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in graph[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)
    return order if len(order) == num_nodes else []""",
        "tags": ["graph", "topological-sort", "bfs"],
    },
    {
        "id": "dijkstra",
        "name": "Dijkstra's Algorithm",
        "category": "algorithm",
        "difficulty": "medium",
        "description": "Implement Dijkstra's shortest path algorithm. Given a weighted graph as an adjacency list (node -> [(neighbor, weight)]), a source, and a total number of nodes, return the shortest distance from source to all nodes (infinity if unreachable).",
        "required_methods": [
            "dijkstra(graph: dict[int, list[tuple[int, int]]], source: int, n: int) -> list[int | float]",
        ],
        "expected_complexity": {
            "dijkstra": "O((V + E) log V)",
        },
        "reference_implementation": """import heapq

def dijkstra(graph: dict[int, list[tuple[int, int]]], source: int, n: int) -> list[int | float]:
    dist = [float('inf')] * n
    dist[source] = 0
    heap = [(0, source)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:
            continue
        for v, w in graph.get(u, []):
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                heapq.heappush(heap, (dist[v], v))
    return dist""",
        "tags": ["graph", "shortest-path", "heap"],
    },
    {
        "id": "kmp",
        "name": "KMP String Matching",
        "category": "algorithm",
        "difficulty": "hard",
        "description": "Implement the KMP (Knuth-Morris-Pratt) string matching algorithm. Build the failure/prefix function, then use it to find the first occurrence of pattern in text. Return the starting index, or -1 if not found.",
        "required_methods": [
            "build_lps(pattern: str) -> list[int]",
            "kmp_search(text: str, pattern: str) -> int",
        ],
        "expected_complexity": {
            "build_lps": "O(m)",
            "kmp_search": "O(n + m)",
        },
        "reference_implementation": """def build_lps(pattern: str) -> list[int]:
    m = len(pattern)
    lps = [0] * m
    length = 0
    i = 1
    while i < m:
        if pattern[i] == pattern[length]:
            length += 1
            lps[i] = length
            i += 1
        elif length > 0:
            length = lps[length - 1]
        else:
            lps[i] = 0
            i += 1
    return lps

def kmp_search(text: str, pattern: str) -> int:
    if not pattern:
        return 0
    lps = build_lps(pattern)
    n, m = len(text), len(pattern)
    i = j = 0
    while i < n:
        if text[i] == pattern[j]:
            i += 1
            j += 1
            if j == m:
                return i - j
        elif j > 0:
            j = lps[j - 1]
        else:
            i += 1
    return -1""",
        "tags": ["string", "pattern-matching"],
    },
]


# ─── Helper functions ────────────────────────────────────────────
def get_all_templates(category: str | None = None) -> list[dict]:
    """Return template catalog without reference implementations."""
    pool = DSA_TEMPLATES
    if category:
        pool = [t for t in pool if t["category"] == category]
    return [
        {k: v for k, v in t.items() if k != "reference_implementation"}
        for t in pool
    ]


def get_template_by_id(template_id: str) -> dict | None:
    """Return full template including reference implementation."""
    for t in DSA_TEMPLATES:
        if t["id"] == template_id:
            return t
    return None


def get_random_template(category: str | None = None) -> dict:
    """Return a random template prompt (no reference implementation)."""
    pool = DSA_TEMPLATES
    if category:
        pool = [t for t in pool if t["category"] == category]
    t = random.choice(pool)
    return {k: v for k, v in t.items() if k != "reference_implementation"}


# ─── Agent factory (singleton) ───────────────────────────────────
_template_eval_agent: Agent | None = None


def create_template_eval_agent() -> Agent:
    global _template_eval_agent
    if _template_eval_agent is None:
        _template_eval_agent = Agent(
            role="DSA Template Code Evaluator",
            goal=(
                "Evaluate user implementations of classic DSA templates "
                "for correctness, completeness, and efficiency by comparing "
                "against a known reference implementation."
            ),
            backstory=(
                "You are a senior competitive programmer and technical "
                "interviewer. You review template implementations with "
                "precision, checking structural completeness, algorithmic "
                "correctness, complexity, edge case handling, and code quality."
            ),
            llm=LLM_MATH,
            verbose=False,
            allow_delegation=False,
        )
    return _template_eval_agent


# ─── Evaluation function ─────────────────────────────────────────
def evaluate_template(agent: Agent, template: dict, user_code: str) -> dict:
    """Evaluate user's template implementation against the reference."""
    methods_str = "\n".join(f"  - {m}" for m in template["required_methods"])
    complexity_str = "\n".join(
        f"  - {op}: {c}" for op, c in template["expected_complexity"].items()
    )

    task = Task(
        description=(
            f"Evaluate this Python implementation of '{template['name']}'.\n\n"
            f"REQUIRED METHODS:\n{methods_str}\n\n"
            f"EXPECTED COMPLEXITY:\n{complexity_str}\n\n"
            f"REFERENCE IMPLEMENTATION:\n```python\n{template['reference_implementation']}\n```\n\n"
            f"USER'S CODE:\n```python\n{user_code}\n```\n\n"
            "Evaluate on these 5 axes (score each 0-100):\n"
            "1. structural_correctness: Are all required methods present with correct signatures? "
            "Does the class/function structure match what's expected?\n"
            "2. algorithmic_correctness: Is the core logic correct? Would it produce correct results "
            "for all valid inputs?\n"
            "3. complexity_correctness: Does it achieve the expected time/space complexity?\n"
            "4. edge_case_handling: Does it handle empty inputs, single elements, boundary values?\n"
            "5. code_quality: Is the code clean, readable, and Pythonic?\n\n"
            "Also determine:\n"
            "- missing_methods: list of required method names that are missing\n"
            "- bugs: list of specific bugs or logical errors found\n"
            "- feedback: detailed natural-language feedback explaining what's good and what needs work\n"
            "- corrected_code: if bugs exist, provide a corrected version of the user's code "
            "(not the reference, but their code fixed)\n\n"
            "The overall_score should be a weighted average: "
            "structural 20%, algorithmic 35%, complexity 20%, edge_cases 10%, quality 15%.\n\n"
            "Respond with ONLY valid JSON:\n"
            "{\n"
            '  "overall_score": <number>,\n'
            '  "structural_correctness": <number>,\n'
            '  "algorithmic_correctness": <number>,\n'
            '  "complexity_correctness": <number>,\n'
            '  "edge_case_handling": <number>,\n'
            '  "code_quality": <number>,\n'
            '  "missing_methods": ["..."],\n'
            '  "bugs": ["..."],\n'
            '  "feedback": "...",\n'
            '  "corrected_code": "..."\n'
            "}"
        ),
        expected_output="Valid JSON with evaluation scores and feedback.",
        agent=agent,
    )

    try:
        result = call_agent_task(agent, task)
    except LLMCallFailedError as e:
        logger.warning("evaluate_template LLM call failed: %s", e)
        result = ""

    validated = parse_and_validate(result, TemplateEvaluation)
    if validated is None:
        logger.warning("Failed to parse/validate template evaluation: %s", result[:300])
        return {
            **TemplateEvaluation().model_dump(),
            "feedback": "Failed to evaluate your code. Please try again.",
        }

    return validated.model_dump()
