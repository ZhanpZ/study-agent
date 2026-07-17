"""
Centralized timeout, retry, and circuit-breaker wrapper for LLM calls.

Every CrewAI agent.execute_task() call in this codebase is blocking with no
timeout and no retry — a hung or failing OpenAI call blocks indefinitely and
callers have no shared way to back off once OpenAI starts failing repeatedly.
call_agent_task() bounds each attempt with a timeout, retries transient
failures with backoff, and short-circuits further calls once a breaker_key
(default: "openai", shared across all callers) has failed too many times in
a row — mirroring the retry shape already used in
backend/services/leetcode_fetcher.py for the (non-LLM) LeetCode fetch.
"""
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

import openai
from crewai import Agent, Task
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

_RETRYABLE_EXCEPTIONS = (
    openai.RateLimitError,
    openai.APITimeoutError,
    openai.APIConnectionError,
    openai.InternalServerError,
    FutureTimeoutError,
)


class LLMCallFailedError(Exception):
    """Raised when an LLM call exhausts retries. Callers should catch this one type."""


class LLMCircuitOpenError(LLMCallFailedError):
    """Raised when the circuit breaker is open and the call was short-circuited."""


class _CircuitBreaker:
    """Opens after `failure_threshold` consecutive failures, half-opens after `reset_after` seconds."""

    def __init__(self, failure_threshold: int = 5, reset_after: float = 30.0):
        self._failure_threshold = failure_threshold
        self._reset_after = reset_after
        self._lock = threading.Lock()
        self._consecutive_failures = 0
        self._opened_at: float | None = None

    def before_call(self, key: str) -> None:
        with self._lock:
            if self._opened_at is None:
                return
            if time.monotonic() - self._opened_at < self._reset_after:
                raise LLMCircuitOpenError(
                    f"Circuit breaker open for '{key}' — too many recent LLM failures"
                )
            # reset_after has elapsed: half-open, let this call through as a trial.

    def record_success(self) -> None:
        with self._lock:
            self._consecutive_failures = 0
            self._opened_at = None

    def record_failure(self) -> None:
        with self._lock:
            self._consecutive_failures += 1
            if self._consecutive_failures >= self._failure_threshold:
                self._opened_at = time.monotonic()


_breakers: dict[str, _CircuitBreaker] = {}
_breakers_lock = threading.Lock()


def _get_breaker(key: str) -> _CircuitBreaker:
    with _breakers_lock:
        if key not in _breakers:
            _breakers[key] = _CircuitBreaker()
        return _breakers[key]


def check_circuit(breaker_key: str = "openai") -> None:
    """For raw (non-CrewAI) call sites: raises LLMCircuitOpenError if the breaker is open."""
    _get_breaker(breaker_key).before_call(breaker_key)


def record_success(breaker_key: str = "openai") -> None:
    _get_breaker(breaker_key).record_success()


def record_failure(breaker_key: str = "openai") -> None:
    _get_breaker(breaker_key).record_failure()


_executor = ThreadPoolExecutor(max_workers=8, thread_name_prefix="llm-call")


def call_agent_task(
    agent: Agent,
    task: Task,
    *,
    timeout: float = 45.0,
    max_retries: int = 2,
    breaker_key: str = "openai",
) -> str:
    """Run agent.execute_task(task) with a timeout, retry-with-backoff, and a shared circuit breaker.

    Raises LLMCallFailedError (or its LLMCircuitOpenError subclass) instead of letting
    raw OpenAI/timeout exceptions escape, so callers only need to handle one exception type.
    Non-retryable errors (auth, bad request, etc.) are not retried and fail fast.
    """
    breaker = _get_breaker(breaker_key)
    breaker.before_call(breaker_key)

    @retry(
        retry=retry_if_exception_type(_RETRYABLE_EXCEPTIONS),
        stop=stop_after_attempt(max_retries + 1),
        wait=wait_exponential(multiplier=1.0, min=1.0),
        reraise=True,
    )
    def _attempt() -> str:
        future = _executor.submit(agent.execute_task, task)
        try:
            return str(future.result(timeout=timeout))
        except FutureTimeoutError:
            logger.warning("LLM call timed out after %.1fs (breaker_key=%s)", timeout, breaker_key)
            raise

    try:
        result = _attempt()
    except Exception as e:
        breaker.record_failure()
        raise LLMCallFailedError(f"LLM call failed after retries: {e}") from e

    breaker.record_success()
    return result
