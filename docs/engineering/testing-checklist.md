# Testing checklist

Practical checklist for Fleetrac tasks. Commands below exist in the repo unless marked otherwise.

## Backend commands

From `apps/api` (venv activated, deps from `requirements.txt`):

```bash
# Full suite
pytest tests/ -v

# Targeted examples (adjust to the change)
pytest tests/test_ingest.py -v
pytest tests/test_latency_semantics.py -v
pytest tests/test_correlation_risk.py -v
pytest tests/test_normalizer.py tests/test_normalization_mappings.py -v
pytest tests/governance/test_actions_verify.py -v
pytest tests/e2e/test_treasury_unsupported_claim_e2e.py -v
pytest tests/e2e/test_phish_tool_scope_e2e.py -v
pytest tests/e2e/test_cs_latency_retry_e2e.py -v
pytest tests/e2e/test_full_governance_pitch.py -v
```

Config: `apps/api/pytest.ini` (`testpaths = tests`, `pythonpath = .`).

No root `pyproject.toml` test script was found. Use pytest directly.

## Backend checklist

- [ ] Relevant targeted pytest passes
- [ ] Full `pytest tests/ -v` when the change touches ingest → detect → correlate → incident
- [ ] Healthy traffic produces **no** incident (`test_latency_semantics.py`, healthy ingest cases)
- [ ] Scenario progression / impact modes (`contained` → `degraded` → `materialized`) where risk policies change (`test_correlation_risk.py`)
- [ ] Incident evolution: same alias evolves; no duplicate open incidents in-window
- [ ] Evidence append/dedup behavior covered when evidence code changes (`test_evidence.py`)
- [ ] API DTO compatibility: governance endpoints still return fields the web client maps (`governance-merge.ts`)
- [ ] Latency semantics: root duration does not fire provider latency rules
- [ ] Wait / healthy spans remain correlation-ineligible when those paths change

## Frontend commands

From `apps/web`:

```bash
npm run build
npm run lint
npm run dev    # manual smoke only
```

Scripts present in `apps/web/package.json`: `clean`, `dev`, `build`, `start`, `lint`.

**Not present:** `npm test`, `typecheck` script. Typechecking occurs as part of `next build`. Do not invent a test script.

## Frontend checklist

- [ ] `npm run build` succeeds
- [ ] `npm run lint` clean for touched files (when run)
- [ ] Links use `routes.ts` builders
- [ ] Deep links still resolve (`queue=owner`, `evidenceMode=`, `action=`, `tab=`)
- [ ] No new user-facing “Bob” / “Sample API” strings on nav surfaces
- [ ] Empty states render when API has no rows (no mock catalog reintroduced)

## Manual product smoke

Requires API on `http://127.0.0.1:8000` and web on `http://localhost:3000`.

```bash
# Reset
curl -X POST http://127.0.0.1:8000/api/v1/simulator/reset

# Healthy only — expect no incident
curl -X POST http://127.0.0.1:8000/api/v1/simulator/runs \
  -H 'Content-Type: application/json' \
  -d '{"count":1,"seed":99,"systems":["sys-agt-treasury-001"]}'
```

- [ ] Trigger healthy telemetry → verify **no** incident in Incident Queue / DB
- [ ] Treasury progression (contained / degraded / materialized) → same `inc-mrm-001` evolves Medium → High → Critical as policies dictate  
  (API may use scenario endpoints with `impact_mode`; see `tests/e2e/helpers.py` and `test_correlation_risk.py`)
- [ ] Phishing progression → `inc-sec-001` behavior intact
- [ ] Customer Support progression → `inc-plat-003` behavior intact
- [ ] Inspect **Incident Queue** (responder filters: MRM / SecOps / Platform)
- [ ] Inspect **Evidence Library** (`/outcomes`)
- [ ] Inspect **Fleetrac Analysis** on incident detail
- [ ] Inspect **severity history** (`GET /api/v1/governance/incidents/{id}/severity-history`)
- [ ] Optional pitch shortcuts:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/simulator/pitch/treasury_unsupported_claim
curl -X POST http://127.0.0.1:8000/api/v1/simulator/pitch/security_tool_scope
curl -X POST http://127.0.0.1:8000/api/v1/simulator/pitch/cs_latency_regression
```

- [ ] Action Center: handoff → approve → verify (when that slice is in scope)
- [ ] Dashboard KPIs update from governance APIs

## Pitch alias quick reference

| Alias | System | Pitch |
|-------|--------|-------|
| `inc-mrm-001` | `sys-agt-treasury-001` (M40) | `treasury_unsupported_claim` |
| `inc-sec-001` | `sys-agt-phish-008` | `security_tool_scope` |
| `inc-plat-003` | `sys-agt-cs-002` (A12) | `cs_latency_regression` |

## Markdown / docs

No markdown lint script was found in package scripts. After doc-only changes, confirm files exist under `docs/` and links resolve; full pytest/build not required unless docs claim command changes.
