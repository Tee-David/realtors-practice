"""LLM provider rotation engine — thread-safe, with proper RPM tracking.

All providers are free-tier, OpenAI-compatible APIs.
Automatically rotates on rate limit errors with proper sliding-window RPM tracking.
Uses asyncio.Lock to prevent race conditions when multiple sites run concurrently.
"""

import os
import json
import time
import asyncio
from collections import deque
from dataclasses import dataclass, field
from typing import Any

import httpx

from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class LLMProvider:
    name: str
    base_url: str
    api_key_env: str
    model: str
    rpm_limit: int = 30
    _fail_count: int = 0
    _cooldown_until: float = 0.0
    # Sliding window of request timestamps for true RPM enforcement
    _request_times: deque = field(default_factory=lambda: deque(maxlen=60))

    @property
    def api_key(self) -> str:
        return os.getenv(self.api_key_env, "")

    @property
    def available(self) -> bool:
        return bool(self.api_key) and time.time() > self._cooldown_until

    @property
    def current_rpm(self) -> int:
        """Count requests in the last 60 seconds."""
        now = time.time()
        cutoff = now - 60.0
        # Count timestamps within the last 60s
        return sum(1 for t in self._request_times if t > cutoff)

    @property
    def rpm_headroom(self) -> int:
        """How many more requests can be made within the RPM limit."""
        return max(0, self.rpm_limit - self.current_rpm)

    def record_request(self):
        """Record that a request was made now."""
        self._request_times.append(time.time())

    def mark_success(self):
        self._fail_count = 0

    def mark_failure(self):
        self._fail_count += 1
        # Exponential cooldown: 30s, 60s, 120s, max 300s
        cooldown = min(30 * (2 ** (self._fail_count - 1)), 300)
        self._cooldown_until = time.time() + cooldown
        logger.warning(f"[LLM] {self.name} failed ({self._fail_count}x), cooling down {cooldown}s")

    def time_until_rpm_available(self) -> float:
        """Seconds until the oldest request in the sliding window expires."""
        if self.rpm_headroom > 0:
            return 0.0
        if not self._request_times:
            return 0.0
        # Find the oldest request that's still in the 60s window
        now = time.time()
        oldest_in_window = min(t for t in self._request_times if t > now - 60.0)
        return max(0.0, (oldest_in_window + 60.0) - now)


# Provider definitions — order = priority
PROVIDERS = [
    LLMProvider(
        name="Groq",
        base_url="https://api.groq.com/openai/v1",
        api_key_env="GROQ_API_KEY",
        model="llama-3.3-70b-versatile",
        rpm_limit=30,
    ),
    LLMProvider(
        name="Cerebras",
        base_url="https://api.cerebras.ai/v1",
        api_key_env="CEREBRAS_API_KEY",
        model="qwen-3-235b-a22b-instruct-2507",
        rpm_limit=30,
    ),
    LLMProvider(
        name="SambaNova",
        base_url="https://api.sambanova.ai/v1",
        api_key_env="SAMBANOVA_API_KEY",
        model="Meta-Llama-3.3-70B-Instruct",
        rpm_limit=10,
    ),
    LLMProvider(
        name="Gemini",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai",
        api_key_env="GEMINI_API_KEY",
        model="gemini-2.0-flash",
        rpm_limit=15,
    ),
]

_client = httpx.AsyncClient(timeout=120.0)

# Lock to protect provider state from concurrent async access
_provider_lock = asyncio.Lock()


async def _select_provider() -> tuple[LLMProvider | None, float]:
    """Select the best available provider. Returns (provider, wait_time).

    Must be called while holding _provider_lock.
    """
    best: LLMProvider | None = None
    min_wait: float = float("inf")

    for p in PROVIDERS:
        if not p.api_key:
            continue
        if not p.available:
            # In cooldown — check if it'll be available soonest
            wait = p._cooldown_until - time.time()
            if wait < min_wait:
                min_wait = wait
            continue
        if p.rpm_headroom > 0:
            return p, 0.0
        else:
            # RPM exhausted — calculate wait
            wait = p.time_until_rpm_available()
            if wait < min_wait:
                min_wait = wait
                best = p

    # All available providers have RPM exhausted
    if best is not None:
        return best, min_wait

    # All providers in cooldown
    if min_wait < float("inf"):
        return None, min_wait

    return None, 0.0


async def llm_extract(
    prompt: str,
    system_prompt: str = "",
    temperature: float = 0.1,
    max_tokens: int = 4096,
    _retry_count: int = 0,
) -> str | None:
    """Call LLM with thread-safe provider rotation and retry.

    Uses asyncio.Lock to prevent race conditions when multiple sites
    run concurrently. The lock only protects provider state selection,
    NOT the actual HTTP call (which runs outside the lock).
    """
    configured = [p.name for p in PROVIDERS if p.api_key]
    if not configured:
        logger.error("[LLM] NO LLM API keys configured! Set at least one of: GROQ_API_KEY, CEREBRAS_API_KEY, SAMBANOVA_API_KEY, GEMINI_API_KEY")
        return None

    # Select a provider (under lock)
    async with _provider_lock:
        provider, wait_time = await _select_provider()

    if provider is None:
        if _retry_count < 2:
            wait = max(wait_time, 5.0)
            wait = min(wait, 60.0)
            logger.info(f"[LLM] All providers busy, waiting {wait:.0f}s (retry {_retry_count + 1}/2)")
            await asyncio.sleep(wait)
            return await llm_extract(prompt, system_prompt, temperature, max_tokens, _retry_count + 1)
        logger.error("[LLM] All providers exhausted after retries")
        return None

    # Wait for RPM headroom if needed
    if wait_time > 0:
        logger.debug(f"[LLM] Waiting {wait_time:.1f}s for {provider.name} RPM headroom")
        await asyncio.sleep(wait_time)

    # Record the request timestamp (under lock)
    async with _provider_lock:
        provider.record_request()

    # Make the HTTP call OUTSIDE the lock
    try:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        logger.info(f"[LLM] Trying {provider.name} ({provider.model}, {len(prompt)} chars)...")
        start_time = time.time()

        resp = await _client.post(
            f"{provider.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {provider.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": provider.model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
        )

        duration = time.time() - start_time

        if resp.status_code == 429:
            async with _provider_lock:
                provider.mark_failure()
            logger.info(f"[LLM] {provider.name} rate limited ({duration:.1f}s), rotating...")
            # Retry with next provider
            if _retry_count < 3:
                return await llm_extract(prompt, system_prompt, temperature, max_tokens, _retry_count + 1)
            return None

        if resp.status_code >= 400:
            async with _provider_lock:
                provider.mark_failure()
            body_preview = resp.text[:200] if resp.text else ""
            logger.warning(f"[LLM] {provider.name} HTTP {resp.status_code} ({duration:.1f}s): {body_preview}")
            # Retry with next provider
            if _retry_count < 3:
                return await llm_extract(prompt, system_prompt, temperature, max_tokens, _retry_count + 1)
            return None

        data = resp.json()
        content = data["choices"][0]["message"]["content"]

        # Strip thinking tags if present (Qwen3 /think mode)
        if "<think>" in content:
            import re
            content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()

        async with _provider_lock:
            provider.mark_success()
        logger.info(f"[LLM] {provider.name} responded ({len(content)} chars in {duration:.1f}s)")
        return content

    except Exception as e:
        async with _provider_lock:
            provider.mark_failure()
        logger.warning(f"[LLM] {provider.name} exception: {e}")
        if _retry_count < 3:
            return await llm_extract(prompt, system_prompt, temperature, max_tokens, _retry_count + 1)
        return None


async def llm_extract_json(
    prompt: str,
    system_prompt: str = "",
    temperature: float = 0.1,
    max_tokens: int = 4096,
) -> list[dict] | dict | None:
    """Call LLM and parse JSON from response.

    Handles markdown code blocks, partial JSON, etc.
    Returns parsed JSON or None.
    """
    raw = await llm_extract(prompt, system_prompt, temperature, max_tokens)
    if not raw:
        return None

    # Strip markdown code fences
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON array or object in the response
        import re
        match = re.search(r"(\[[\s\S]*\]|\{[\s\S]*\})", text)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        logger.warning(f"[LLM] Failed to parse JSON from response: {text[:200]}...")
        return None


def get_available_providers() -> list[str]:
    """Return names of currently available (configured + not cooling down) providers."""
    return [p.name for p in PROVIDERS if p.available]


def get_provider_status_summary() -> str:
    """Return a compact one-line summary of provider status for logging.

    Example: "Groq OK, Cerebras NO KEY, SambaNova OK, Gemini NO KEY"
    """
    parts = []
    for p in PROVIDERS:
        if not p.api_key:
            parts.append(f"{p.name} NO KEY")
        elif not p.available:
            parts.append(f"{p.name} COOLDOWN")
        else:
            parts.append(f"{p.name} OK")
    return ", ".join(parts)
