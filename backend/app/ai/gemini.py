"""Server-side Gemini client wrapper (google-genai SDK).

The API key never leaves the backend; the frontend has no access to it.
All calls are bounded (temperature, max tokens) and run in a worker thread
because the SDK is synchronous.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional

from ..config import settings

logger = logging.getLogger("garud.ai")


class GeminiNotConfigured(RuntimeError):
    """Raised when GEMINI_API_KEY is absent."""


class GeminiCallError(RuntimeError):
    """Raised when a Gemini call fails or returns unusable output."""


_client: Any = None


def gemini_available() -> bool:
    return bool(settings.gemini_api_key)


def get_client() -> Any:
    global _client
    if not settings.gemini_api_key:
        return None
    if _client is None:
        from google import genai  # deferred import: app works without the key

        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


async def generate_json(
    system_instruction: str,
    user_prompt: str,
    temperature: float = 0.2,
    max_output_tokens: int = 1600,
    model: Optional[str] = None,
    retries: int = 1,
    call_timeout: float = 12.0,
) -> dict:
    """Call Gemini and return parsed JSON. Raises GeminiCallError on failure.

    Each attempt is bounded by ``call_timeout`` so a hanging/overloaded model
    never blocks a request path for long; ``retries`` adds one backoff retry
    for user-initiated flows (briefings). Auto-triage uses retries=0 for a
    fast, honest fallback.
    """
    client = get_client()
    if client is None:
        raise GeminiNotConfigured("GEMINI_API_KEY not configured")
    use_model = model or settings.gemini_model

    def _call() -> Any:
        return client.models.generate_content(
            model=use_model,
            contents=user_prompt,
            config={
                "system_instruction": system_instruction,
                "response_mime_type": "application/json",
                "temperature": temperature,
                "max_output_tokens": max_output_tokens,
            },
        )

    try:
        last_exc: Exception | None = None
        for attempt in range(max(1, retries + 1)):
            try:
                resp = await asyncio.wait_for(asyncio.to_thread(_call), timeout=call_timeout)
                text = (getattr(resp, "text", None) or "").strip()
                if not text:
                    raise ValueError("Empty response text")
                return json.loads(text)
            except Exception as exc:  # noqa: BLE001 — includes asyncio.TimeoutError
                last_exc = exc
                if attempt < retries:
                    await asyncio.sleep(1.5)
        raise last_exc  # type: ignore[misc]
    except GeminiNotConfigured:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning("Gemini call failed: %s", exc)
        raise GeminiCallError(str(exc)) from exc
