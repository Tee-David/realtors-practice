"""LLM provider rotation engine — Groq → Cerebras → SambaNova → Gemini.

All providers are free-tier, OpenAI-compatible APIs serving Qwen3 32B or equivalent.
Automatically rotates on rate limit errors. Zero cost.
"""

import os
import json
import time
import asyncio
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
    _last_call: float = 0.0
    _fail_count: int = 0
    _cooldown_until: float = 0.0

    @property
    def api_key(self) -> str:
        return os.getenv(self.api_key_env, "")

    @property
    def available(self) -> bool:
        return bool(self.api_key) and time.time() > self._cooldown_until

    def mark_success(self):
        self._fail_count = 0
        self._last_call = time.time()

    def mark_failure(self):
        self._fail_count += 1
        # Exponential cooldown: 30s, 60s, 120s, max 300s
        cooldown = min(30 * (2 ** (self._fail_count - 1)), 300)
        self._cooldown_until = time.time() + cooldown
        logger.warning(f"[LLM] {self.name} failed ({self._fail_count}x), cooling down {cooldown}s")


# Provider definitions — order = priority
PROVIDERS = [
    LLMProvider(
        name="Groq",
        base_url="https://api.groq.com/openai/v1",
        api_key_env="GROQ_API_KEY",
        model="llama-3.3-70b-versatile",  # Fast, reliable, no <think> overhead
        rpm_limit=30,
    ),
    LLMProvider(
        name="Cerebras",
        base_url="https://api.cerebras.ai/v1",
        api_key_env="CEREBRAS_API_KEY",
        model="llama-3.3-70b",
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


async def llm_extract(
    prompt: str,
    system_prompt: str = "",
    temperature: float = 0.1,
    max_tokens: int = 4096,
) -> str | None:
    """Call LLM with automatic provider rotation.

    Tries each provider in order. On rate limit or error, rotates to next.
    Returns the response text, or None if all providers fail.
    """
    errors = []
    available = [p.name for p in PROVIDERS if p.available]
    logger.info(f"[LLM] Calling LLM ({len(prompt)} char prompt). Available providers: {available}")

    for provider in PROVIDERS:
        if not provider.available:
            logger.debug(f"[LLM] {provider.name} unavailable (no key or cooling down)")
            continue

        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            # Enforce minimum interval between calls (rate limit safety)
            min_interval = 60.0 / provider.rpm_limit
            elapsed_since = time.time() - provider._last_call
            if elapsed_since < min_interval:
                wait_time = min_interval - elapsed_since
                logger.debug(f"[LLM] Rate limit wait {wait_time:.1f}s for {provider.name}")
                await asyncio.sleep(wait_time)

            logger.info(f"[LLM] Trying {provider.name} ({provider.model})...")
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
                provider.mark_failure()
                logger.info(f"[LLM] {provider.name} rate limited ({duration:.1f}s), trying next provider")
                continue

            if resp.status_code >= 400:
                provider.mark_failure()
                body_preview = resp.text[:200] if resp.text else ""
                errors.append(f"{provider.name}: HTTP {resp.status_code} - {body_preview}")
                logger.warning(f"[LLM] {provider.name} HTTP {resp.status_code} ({duration:.1f}s): {body_preview}")
                continue

            data = resp.json()
            content = data["choices"][0]["message"]["content"]

            # Strip thinking tags if present (Qwen3 /think mode)
            if "<think>" in content:
                import re
                content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()

            provider.mark_success()
            logger.info(f"[LLM] {provider.name} responded ({len(content)} chars in {duration:.1f}s)")
            return content

        except Exception as e:
            duration = time.time() - start_time
            provider.mark_failure()
            errors.append(f"{provider.name}: {e}")
            logger.warning(f"[LLM] {provider.name} exception ({duration:.1f}s): {e}")
            continue

    logger.error(f"[LLM] All providers failed: {errors}")
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
        # Remove first and last lines (```json and ```)
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON array or object in the response
        import re
        # Look for [...] or {...}
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
