from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings

_test_asgi_app: Any | None = None


def set_test_asgi_app(app: Any | None) -> None:
    """Register FastAPI app for in-process ASGI loopback when base_url is http://test."""
    global _test_asgi_app
    _test_asgi_app = app


@dataclass
class IngestPostResult:
    index: int
    ok: bool
    status_code: int | None
    body: dict[str, Any] | None
    error: str | None = None


async def post_ingest_event(
    envelope: dict[str, Any],
    *,
    client: httpx.AsyncClient | None = None,
    base_url: str | None = None,
    timeout: float | None = None,
) -> IngestPostResult:
    url_base = (base_url or settings.simulator_api_base_url).rstrip("/")
    ingest_url = f"{url_base}{settings.api_prefix}/ingest/events"
    timeout_seconds = timeout if timeout is not None else settings.simulator_http_timeout_seconds

    owns_client = client is None
    if client is None:
        if url_base == "http://test" and _test_asgi_app is not None:
            from httpx import ASGITransport

            client = httpx.AsyncClient(
                transport=ASGITransport(app=_test_asgi_app),
                base_url=url_base,
                timeout=timeout_seconds,
            )
        else:
            client = httpx.AsyncClient(timeout=timeout_seconds)

    try:
        response = await client.post(ingest_url, json=envelope)
        body: dict[str, Any] | None
        try:
            body = response.json()
        except Exception:
            body = {"raw": response.text}
        return IngestPostResult(
            index=-1,
            ok=response.is_success,
            status_code=response.status_code,
            body=body,
            error=None if response.is_success else f"HTTP {response.status_code}",
        )
    except httpx.HTTPError as exc:
        return IngestPostResult(index=-1, ok=False, status_code=None, body=None, error=str(exc))
    finally:
        if owns_client:
            await client.aclose()


async def post_ingest_sequence(
    envelopes: list[dict[str, Any]],
    *,
    client: httpx.AsyncClient | None = None,
    base_url: str | None = None,
) -> list[IngestPostResult]:
    results: list[IngestPostResult] = []
    owns_client = client is None
    if client is None:
        if (base_url or settings.simulator_api_base_url).rstrip("/") == "http://test" and _test_asgi_app is not None:
            from httpx import ASGITransport

            client = httpx.AsyncClient(
                transport=ASGITransport(app=_test_asgi_app),
                base_url="http://test",
                timeout=settings.simulator_http_timeout_seconds,
            )
        else:
            client = httpx.AsyncClient(timeout=settings.simulator_http_timeout_seconds)
    try:
        for idx, envelope in enumerate(envelopes):
            result = await post_ingest_event(envelope, client=client, base_url=base_url)
            result.index = idx
            results.append(result)
            if not result.ok:
                break
    finally:
        if owns_client:
            await client.aclose()
    return results
