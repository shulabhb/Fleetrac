#!/usr/bin/env python3
"""Local demo health check. Read-only. Does not reset state."""

from __future__ import annotations

import sys
import urllib.error
import urllib.request

API = "http://127.0.0.1:8000"
WEB = "http://127.0.0.1:3000"

PAGES = [
    "/",
    "/systems",
    "/live-signals",
    "/incidents",
    "/incidents?incident=inc-mrm-001",
    "/incidents?incident=inc-sec-001",
    "/incidents?incident=inc-plat-003",
    "/actions",
    "/outcomes",
    "/settings",
]

REDIRECTS = {
    "/bob": "/",
    "/activity": "/",
    "/controls": "/systems",
    "/usage": "/",
}


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


_OPENER = urllib.request.build_opener(_NoRedirect)


def get(url: str) -> tuple[int, str, str]:
    request = urllib.request.Request(url, method="GET")
    try:
        with _OPENER.open(request, timeout=5) as response:
            body = response.read(400).decode("utf-8", "replace")
            return response.status, body, response.headers.get("Location", "")
    except urllib.error.HTTPError as exc:
        body = exc.read(200).decode("utf-8", "replace")
        return exc.code, body, exc.headers.get("Location", "")


def main() -> int:
    failed = 0

    status, body, _ = get(f"{API}/api/v1/simulator/status")
    print(f"backend status {status}")
    if status != 200:
        failed += 1

    stories, story_body, _ = get(f"{API}/api/v1/simulator/stories")
    print(f"stories {stories}")
    if stories != 200 or "treasury_grounding_or_model_risk_issue" not in story_body:
        failed += 1

    for team in ("Model Risk Management", "Security Operations", "Platform Reliability"):
        code, _, _ = get(
            f"{API}/api/v1/governance/owner-queue?owner_team={team.replace(' ', '%20')}"
        )
        print(f"owner-queue {team} {code}")
        if code != 200:
            failed += 1

    actions, _, _ = get(f"{API}/api/v1/governance/actions")
    print(f"actions {actions}")
    if actions != 200:
        failed += 1

    library, _, _ = get(f"{API}/api/v1/governance/evidence-library")
    print(f"evidence-library {library}")
    if library != 200:
        failed += 1

    for alias in ("inc-mrm-001", "inc-sec-001", "inc-plat-003"):
        code, _, _ = get(f"{API}/api/v1/governance/evidence/{alias}")
        # 200 when the pitch has run; 404 after a fresh reset is still a live endpoint.
        print(f"evidence {alias} {code}")
        if code not in (200, 404):
            failed += 1

    for path in PAGES:
        code, _, _ = get(f"{WEB}{path}")
        print(f"page {path} {code}")
        if code != 200:
            failed += 1

    for path, dest in REDIRECTS.items():
        code, _, location = get(f"{WEB}{path}")
        print(f"redirect {path} {code} -> {location}")
        if code not in (307, 308) or not location.endswith(dest):
            failed += 1

    if failed:
        print(f"health check failed: {failed}")
        return 1
    print("health check ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
