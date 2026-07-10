# Implementation rules

Strict, actionable rules for Fleetrac changes. Prefer small slices. When unsure, stop and document under Unknown / needs verification rather than inventing architecture.

See also: [`architecture.md`](architecture.md), [`testing-checklist.md`](testing-checklist.md), root [`AGENTS.md`](../../AGENTS.md).

## General rules

1. Inspect existing code before adding parallel modules.
2. Prefer extend-in-place: `ingest_pipeline.py`, `pipeline/`, `detection/`, `correlation/`, `governance/`, `governance-api.ts`, `governance-merge.ts`.
3. One vertical slice at a time (default proof system: Treasury `sys-agt-treasury-001` / M40).
4. Do not add Redis, Kafka, Kubernetes, cloud connector platforms, or LLM investigation unless explicitly requested.
5. Do not claim production readiness in copy or docs.
6. Trust language: bounded, approval-gated, audit-linked—not autonomous AI.
7. Prefer deterministic logic before any LLM-based reasoning.
8. Every behavior change needs tests (backend pytest and/or documented manual smoke).

## Backend rules

1. Run API as `uvicorn main:app` from `apps/api` (not `app.main:app`).
2. All simulator telemetry enters via `POST /api/v1/ingest/events`.
3. Do not write incidents, live signals, or evidence directly from generators.
4. Keep SQLite as the local store unless migration is requested.
5. Preserve fleet registry IDs, display IDs, and incident aliases.
6. Extend schemas carefully; keep governance DTOs compatible with the web client.
7. Do not silently change diagnosis family string IDs.
8. Reconcile legacy 30m correlator constants deliberately if touched; canonical cluster window is 15m.

## Frontend rules

1. Governance loop pages read API data (or empty states)—no new `*-mock.ts` catalogs.
2. Use `routes.ts` for all internal links.
3. Do not redesign the seven-item nav unless explicitly requested.
4. Do not reintroduce Bob as user-facing investigation branding; use **Fleetrac Analysis**.
5. Prefer backend-driven rows over local session fiction; if session helpers exist, keep them narrow.
6. Preserve deep-link query params (`queue`, `owner`, `incident`, `evidenceMode`, `action`, `tab`, `scope`, `returnTo`).
7. Run `npm run build` before calling UI work done; run `npm run lint` when practical.

## Simulator rules

1. Emit realistic OTEL v2 bundles (`schema_version: "2.0"`, nested `spans[]`).
2. Post only through `http_ingest_client` (HTTP loopback or test ASGI).
3. Impact modes (`contained` / `degraded` / `materialized`) mutate facts and business outcomes in `scenarios/mutations.py`—**not** final incident severity fields.
4. Healthy traces must not create incidents.
5. Wait spans (`operation: wait`, `*.wait` names) must remain neutral for detection/correlation.
6. Do not rebuild the simulator for unrelated UI tasks.

## Telemetry rules

1. Metadata-only content mode for pitch paths.
2. Healthy normalization: `normalized_signal_type=null`, `severity=null`, `confidence=null`.
3. Distinguish `span_duration_ms` (wall clock) from `operation_latency_ms` (provider/model/tool/retrieval).
4. Root span `agent.request` duration must not drive latency detection.
5. Do not populate provider operation latency from wait spans.

## Detection rules

1. Rules are deterministic threshold / flag checks (`detection/engine.py` + `RULE_SPECS`).
2. Latency rules must use operation latency fields, not root duration.
3. Detection match severity is a hint; cluster risk policy owns final incident severity.
4. Do not add noisy rules that fire on healthy baselines.

## Correlation / risk rules

1. Do not correlate neutral healthy telemetry.
2. Correlation key: `tenant_id + environment + system_id + diagnosis_family`.
3. Active window: 15 minutes for the canonical engine.
4. One evolving incident per cluster inside the window—no duplicates for related signals.
5. Preserve highest severity; record severity history on changes.
6. Business outcomes affect severity only when combined with governance signals (policies encode this).
7. Do not hardcode final severity from scenario names or pitch ids.
8. Severity bands in current scorer: Medium / High / Critical (`correlation/scoring.py`).

## Evidence rules

1. Evidence is packaged per incident; append rather than invent disconnected records.
2. Prefer deduplicated references to real event/trace/span ids.
3. Fleetrac Analysis must stay evidence-backed and structured/templated where possible.
4. Do not rename Fleetrac Analysis.

## API rules

1. Prefer extending `/api/v1/governance/*` for operator UI needs.
2. Keep pitch aliases resolvable in owner queue / evidence / actions.
3. Action Center mutations go through governance action endpoints (approve/reject/verify).
4. Deprecate Bob APIs in place; do not expand Bob as a product surface.
5. Document DTO field changes in the completion report.

## Testing rules

1. Add or update pytest for every detection/correlation/severity/ingest behavior change.
2. Include healthy no-false-positive coverage when touching latency or healthy generators.
3. Include impact-mode progression tests when changing risk policies or mutations.
4. Run targeted tests first, then broader `pytest tests/` before merge-level claims.
5. Frontend: `npm run build` (and lint). There is no `npm test` script in `apps/web/package.json`.

## Documentation / reporting rules

1. Update `docs/product/current-stage.md` when phase boundaries or freeze lists change.
2. Update architecture docs when real modules/routes/tables change.
3. Fill `docs/ai-handoff/completion-report.md` after each task.
4. Mark uncertainty explicitly: **Unknown / needs verification**.
5. Do not invent commands, endpoints, or tables that do not exist in the repo.
