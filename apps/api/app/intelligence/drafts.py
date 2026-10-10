"""Local Ollama drafts. Detection and approval stay deterministic.

If Ollama is down, callers keep the template analysis.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

_OLLAMA = "http://127.0.0.1:11434/api/generate"
_MODEL = "llama3.2:3b"


def draft_explanation(facts: str) -> dict:
    prompt = (
        "You write a short governance note for a non-expert. "
        "Use only the facts given. Do not invent numbers. "
        "Do not say code was changed or a rollback was executed. "
        "Three short sentences: what we noticed, why it matters, what a person should do next.\n\n"
        f"Facts:\n{facts.strip()[:2000]}"
    )
    body = json.dumps({"model": _MODEL, "prompt": prompt, "stream": False}).encode()
    req = urllib.request.Request(
        _OLLAMA,
        data=body,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            payload = json.loads(resp.read().decode())
        text = (payload.get("response") or "").strip()
        if not text:
            raise ValueError("empty draft")
        return {"source": "model", "model_id": _MODEL, "summary": text}
    except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError, OSError):
        return {
            "source": "template",
            "model_id": None,
            "summary": facts.strip() or "No packaged analysis yet.",
        }
