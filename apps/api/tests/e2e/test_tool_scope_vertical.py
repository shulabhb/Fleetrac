"""Legacy module path — delegates to canonical phish E2E test."""

from __future__ import annotations

from tests.e2e.test_phish_tool_scope_e2e import test_phish_tool_scope_violation_e2e


def test_tool_scope_violation_creates_secops_incident(client, db_session):
    test_phish_tool_scope_violation_e2e(client, db_session)
