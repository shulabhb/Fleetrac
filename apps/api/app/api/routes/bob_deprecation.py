from __future__ import annotations

from fastapi import Response

BOB_DEPRECATION = 'true'
BOB_SUCCESSOR = '</api/v1/governance/evidence/{incident_id}>; rel="successor-version"'


def apply_bob_deprecation(response: Response) -> None:
    response.headers["Deprecation"] = BOB_DEPRECATION
    response.headers["Link"] = BOB_SUCCESSOR
    response.headers["X-Fleetrac-Notice"] = (
        "Bob API is deprecated; use governance evidence Fleetrac analysis instead."
    )
