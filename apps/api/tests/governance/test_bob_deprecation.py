from __future__ import annotations


def test_bob_routes_emit_deprecation_headers(client):
    response = client.get("/api/v1/bob/investigations")
    assert response.status_code == 200
    assert response.headers.get("Deprecation") == "true"
    assert "successor-version" in (response.headers.get("Link") or "")
    body = response.json()
    assert body.get("deprecated") is True
    assert "successor" in body
