from __future__ import annotations

import json
from pathlib import Path

FIXTURES = Path(__file__).resolve().parents[1] / "app" / "simulator" / "fixtures" / "raw"


def test_golden_fixture_ingest(client):
    client.post("/api/v1/simulator/reset")
    for name in (
        "aws_bedrock_healthy.json",
        "azure_openai_healthy.json",
        "vertex_ai_healthy.json",
    ):
        payload = json.loads((FIXTURES / name).read_text())
        resp = client.post("/api/v1/ingest/events", json=payload)
        assert resp.status_code == 200, name
        assert resp.json()["duplicate"] is False
