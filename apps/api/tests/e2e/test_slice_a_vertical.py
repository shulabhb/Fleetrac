"""Slice A treasury vertical — sync HTTP E2E (legacy entrypoint)."""

from __future__ import annotations

from tests.e2e.test_treasury_unsupported_claim_e2e import test_treasury_unsupported_claim_e2e

# Preserve legacy module path while delegating to the canonical treasury E2E test.


def test_slice_a_vertical(client, db_session):
    test_treasury_unsupported_claim_e2e(client, db_session)
