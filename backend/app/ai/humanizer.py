"""
Multi-provider humanization + ZeroGPT detection.

Humanizers (rotated across passes):
1. AIHumanizerAPI.com   – HUMANIZER_API_KEY_1
2. ToHuman              – HUMANIZER_API_KEY_2
3. Humanize AI Pro      – HUMANIZER_API_KEY_3
4. WriteHuman           – HUMANIZER_API_KEY_4
5. HumanizerAI.com      – HUMANIZER_API_KEY_5
6. Gemini fallback (always available)

Detector: ZeroGPT (preferred) / Sapling / Gemini
"""

from __future__ import annotations

import logging
import re
from typing import Any, Callable

import requests

from app.ai.provider import generate_text
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
TIMEOUT = 90


def _clean_markdown(text: str) -> str:
    """Strip markdown asterisks, hashes, and bold/italic markers from the paper."""
    text = re.sub(r"#{1,6}\s*", "", text)          # headings
    text = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", text)  # *bold* / **bold**
    text = re.sub(r"_{1,3}([^_]+)_{1,3}", r"\1", text)
    text = re.sub(r"`+", "", text)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)  # list bullets
    return text.strip()


# ---------------------------------------------------------------------------
# Humanizers
# ---------------------------------------------------------------------------

def _humanize_aihumanizerapi(text: str, key: str) -> str:
    resp = requests.post(
        "https://api.aihumanizerapi.com/v1/humanize",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"text": text, "tone": "professional", "style": "conversational", "language": "en"},
        timeout=TIMEOUT,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"AIHumanizerAPI {resp.status_code}: {resp.text[:250]}")
    data = resp.json()
    result = data.get("humanized_text") or data.get("humanized") or data.get("result") or data.get("content") or ""
    if len(result.strip()) < 50:
        raise RuntimeError("AIHumanizerAPI empty")
    return _clean_markdown(result)


def _humanize_tohuman(text: str, key: str) -> str:
    resp = requests.post(
        "https://tohuman.io/api/v1/humanizations/sync",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"content": text, "intensity": "heavy"},
        timeout=TIMEOUT,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"ToHuman {resp.status_code}: {resp.text[:250]}")
    data = resp.json()
    result = data.get("humanized_text") or data.get("humanized") or data.get("content") or data.get("result") or ""
    if len(result.strip()) < 50:
        raise RuntimeError("ToHuman empty")
    return _clean_markdown(result)


def _humanize_humanizeaipro(text: str, key: str) -> str:
    resp = requests.post(
        "https://thehumanizeai.pro/api/v1/humanize",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"text": text, "model": "humanoidx", "tone": "academic"},
        timeout=TIMEOUT,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"HumanizeAI Pro {resp.status_code}: {resp.text[:250]}")
    data = resp.json()
    result = data.get("humanized_text") or data.get("humanizedText") or data.get("result") or data.get("content") or ""
    if len(result.strip()) < 50:
        raise RuntimeError("HumanizeAI Pro empty")
    return _clean_markdown(result)


def _humanize_writehuman(text: str, key: str) -> str:
    resp = requests.post(
        "https://api.writehuman.ai/v1/humanize",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"text": text, "tone": "professional"},
        timeout=TIMEOUT,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"WriteHuman {resp.status_code}: {resp.text[:250]}")
    data = resp.json()
    if "results" in data and isinstance(data["results"], list) and data["results"]:
        result = data["results"][0]
    else:
        result = data.get("humanized") or data.get("humanized_text") or data.get("result") or data.get("text") or ""
    if len(str(result).strip()) < 50:
        raise RuntimeError("WriteHuman empty")
    return _clean_markdown(str(result))


def _humanize_humanizerai(text: str, key: str) -> str:
    resp = requests.post(
        "https://humanizerai.com/api/v1/humanize",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"text": text, "intensity": "aggressive"},
        timeout=TIMEOUT,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"HumanizerAI {resp.status_code}: {resp.text[:250]}")
    data = resp.json()
    result = data.get("humanizedText") or data.get("humanized_text") or data.get("result") or data.get("content") or ""
    if len(result.strip()) < 50:
        raise RuntimeError("HumanizerAI empty")
    return _clean_markdown(result)


def _humanize_gemini(text: str, _: str = "") -> str:
    prompt = f"""
You are an expert editor. Completely rewrite this Model United Nations position paper so it sounds like a real student delegate wrote it.

STRICT RULES:
- Keep every fact, policy, structure and required section exactly the same.
- Dramatically vary sentence length and openings.
- Remove ALL AI clichés, buzzwords, and formal transitions.
- Prefer concrete everyday language.
- NEVER use asterisks (*), hash symbols (#), markdown, bold, italics, or any special formatting characters.
- Output plain text only. No headings with #, no bullet points with *, no emphasis markers.
- Output ONLY the rewritten paper. No notes or explanations.

ORIGINAL:
{text}
""".strip()
    return _clean_markdown(generate_text(prompt))


def _get_available_providers() -> list[tuple[str, Callable[[str, str], str], str]]:
    providers = []
    key1 = getattr(settings, "humanizer_api_key_1", "") or getattr(settings, "humanizer_api_key", "")
    if key1:
        providers.append(("aihumanizerapi", _humanize_aihumanizerapi, key1))
    key2 = getattr(settings, "humanizer_api_key_2", "")
    if key2:
        providers.append(("tohuman", _humanize_tohuman, key2))
    key3 = getattr(settings, "humanizer_api_key_3", "")
    if key3:
        providers.append(("humanizeaipro", _humanize_humanizeaipro, key3))
    key4 = getattr(settings, "humanizer_api_key_4", "")
    if key4:
        providers.append(("writehuman", _humanize_writehuman, key4))
    key5 = getattr(settings, "humanizer_api_key_5", "")
    if key5:
        providers.append(("humanizerai", _humanize_humanizerai, key5))
    providers.append(("gemini", _humanize_gemini, ""))
    return providers


# ---------------------------------------------------------------------------
# Detectors
# ---------------------------------------------------------------------------

def _detect_zerogpt(text: str, key: str) -> float:
    resp = requests.post(
        "https://api.zerogpt.com/api/detect/detectText",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"input_text": text[:15000]},
        timeout=45,
    )
    if resp.status_code != 200:
        resp = requests.post(
            "https://api.zerogpt.com/detect",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"text": text[:15000]},
            timeout=45,
        )
    if resp.status_code != 200:
        raise RuntimeError(f"ZeroGPT {resp.status_code}: {resp.text[:250]}")
    data = resp.json()
    if "data" in data and isinstance(data["data"], dict):
        data = data["data"]
    score = (
        data.get("fakePercentage")
        or data.get("ai_percentage")
        or data.get("aiPercentage")
        or data.get("fake_percentage")
        or data.get("score")
    )
    if score is None:
        raise RuntimeError(f"ZeroGPT unexpected: {str(data)[:200]}")
    return float(score)


def _detect_sapling(text: str, key: str) -> float:
    resp = requests.post(
        "https://api.sapling.ai/api/v1/aidetect",
        json={"key": key, "text": text[:180000]},
        timeout=45,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Sapling {resp.status_code}: {resp.text[:250]}")
    return round(float(resp.json().get("score", 0.5)) * 100, 1)


def _detect_gemini(text: str) -> float:
    prompt = f"""
Estimate the probability (0-100) that the following text was written by an AI.
Respond with exactly: AI_SCORE: <number>

Text:
{text[:5000]}
""".strip()
    raw = generate_text(prompt)
    match = re.search(r"AI_SCORE:\s*(\d+(?:\.\d+)?)", raw, re.IGNORECASE)
    if match:
        return max(0.0, min(100.0, float(match.group(1))))
    return 40.0


def _get_detector() -> tuple[str, Callable[[str], float]]:
    key = getattr(settings, "detector_api_key", "") or ""
    provider = (getattr(settings, "detector_provider", "") or "zerogpt").lower().strip()

    if not key:
        return "gemini", lambda t: _detect_gemini(t)

    if provider == "zerogpt":
        return "zerogpt", lambda t: _detect_zerogpt(t, key)
    if provider == "sapling":
        return "sapling", lambda t: _detect_sapling(t, key)

    def auto(t: str) -> float:
        try:
            return _detect_zerogpt(t, key)
        except Exception:
            return _detect_sapling(t, key)

    return "auto", auto


# ---------------------------------------------------------------------------
# Public
# ---------------------------------------------------------------------------

def humanize_text(
    text: str,
    max_passes: int | None = None,
    target_ai_score: float | None = None,
) -> dict[str, Any]:
    if not text or not text.strip():
        return {
            "content": text or "",
            "ai_score": 0.0,
            "passes": 0,
            "history": [],
            "providers_used": [],
            "provider": "none",
            "detector": "none",
        }

    max_passes = max_passes or getattr(settings, "humanizer_max_passes", 6) or 6
    target = target_ai_score if target_ai_score is not None else getattr(settings, "target_ai_score", 5.0)

    providers = _get_available_providers()
    detector_name, detect_fn = _get_detector()

    current = _clean_markdown(text.strip())
    history: list[float] = []
    providers_used: list[str] = []
    passes_done = 0

    for i in range(max_passes):
        name, func, key = providers[i % len(providers)]
        try:
            current = func(current, key)
            current = _clean_markdown(current)
            providers_used.append(name)
            passes_done = i + 1
        except Exception as exc:
            logger.warning("Provider %s failed on pass %s: %s", name, i + 1, exc)
            continue

        try:
            score = detect_fn(current)
        except Exception as exc:
            logger.warning("Detector %s failed on pass %s: %s", detector_name, i + 1, exc)
            score = 99.0

        history.append(score)
        if score < target:
            break

    if not history:
        try:
            history.append(detect_fn(current))
        except Exception:
            history.append(50.0)

    return {
        "content": _clean_markdown(current),
        "ai_score": round(history[-1], 1),
        "passes": passes_done,
        "history": [round(s, 1) for s in history],
        "providers_used": providers_used,
        "provider": " → ".join(providers_used) if providers_used else "none",
        "detector": detector_name,
    }