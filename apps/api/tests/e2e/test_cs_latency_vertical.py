"""Legacy module path — delegates to canonical CS latency E2E test."""

from __future__ import annotations

from tests.e2e.test_cs_latency_retry_e2e import test_cs_latency_regression_e2e


def test_cs_latency_creates_platrel_incident(client, db_session):
    test_cs_latency_regression_e2e(client, db_session)
