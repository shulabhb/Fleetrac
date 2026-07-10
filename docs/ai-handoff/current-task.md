# Current Task

Fill this before coding. Keep scope small. Prefer one vertical slice.

## Objective

_What outcome should exist when this task is done?_

Example: Harden Action Center verify path so Treasury `inc-mrm-001` closes after `improvement_observed` and Evidence Library shows verification evidence.

## Scope

_In-scope files, behaviors, and surfaces._

Example:

- `apps/api/app/governance/verification.py`
- `apps/api/app/api/routes/governance.py` verify endpoint
- `apps/web/components/actions/*` verify UX
- Tests in `tests/governance/test_actions_verify.py`

## Out of Scope

_Explicit non-goals._

Examples:

- Rebuild simulator
- Postgres migration
- Redis / Kafka / cloud connectors
- LLM Fleetrac Analysis
- Nav IA redesign
- New mock catalogs
- Unrelated dashboard visual polish

## Files Likely Involved

| Area | Likely paths |
|------|----------------|
| Ingest | `apps/api/app/services/ingest_pipeline.py`, `schemas/ingestion.py` |
| Normalize | `apps/api/app/pipeline/` |
| Detect | `apps/api/app/detection/engine.py`, `fleet/registry.py` |
| Correlate / risk | `apps/api/app/correlation/` |
| Governance | `apps/api/app/governance/` |
| Simulator | `apps/api/app/simulator/` (only if telemetry facts must change) |
| Web | `apps/web/lib/governance-*.ts`, relevant `components/` + `app/` routes |

## Invariants to Preserve

Copy any that apply; do not delete casually:

- [ ] Fleetrac Analysis naming (no Bob reintroduction)
- [ ] Pitch aliases (`inc-mrm-001`, `inc-sec-001`, `inc-plat-003`)
- [ ] HTTP ingest boundary for simulator traces
- [ ] Healthy / wait spans do not create incidents
- [ ] No root-span latency false positives
- [ ] Severity from risk evidence/outcomes, not scenario name hardcoding
- [ ] One evolving incident per cluster in the active window; highest severity
- [ ] No new infrastructure unless requested
- [ ] No new frontend mock catalogs
- [ ] Seven-item nav unchanged (unless this task explicitly changes IA)
- [ ] If touching correlation logic: known **15-minute vs 30-minute** correlation-window mismatch between the canonical correlation engine (`correlation/families.py`) and legacy correlator/pitch constants (`pitch_aliases.py` / `detection/correlator.py`). Do not reconcile casually; only change deliberately with tests.

## Acceptance Criteria

_Checklist of observable done-ness._

Example:

- [ ] Approve + verify from Action Center updates action + incident lifecycle
- [ ] Verification evidence visible in Evidence Library for the incident alias
- [ ] Pytest for verify path green
- [ ] `npm run build` green if UI touched

## Required Tests

_List exact commands._

```bash
cd apps/api && pytest tests/governance/test_actions_verify.py -v
# add more as needed
cd apps/web && npm run build
```

Also consult [`../engineering/testing-checklist.md`](../engineering/testing-checklist.md).

## Completion Report Required

- [ ] Fill [`completion-report.md`](completion-report.md) before marking the task complete
- [ ] Note any Unknown / needs verification items discovered
- [ ] Update `docs/product/current-stage.md` if stage boundaries changed
