# Current Stage

Fleetrac is a **strong prototype** (branch/context: ImplementationV1) moving toward a workable product. It is **not** production-hardened. Prefer empty API-driven UI states over fictional catalogs.

Last documentation pass: 2026-07-10 (repo inspection). Test/build status below was **not re-run** in that pass — treat as “commands exist; last green unknown.”

## Implemented

- **OTEL-style simulator** for 10 fleet systems (`apps/api/app/simulator/`), v2 multi-span bundles
- **HTTP ingest boundary** `POST /api/v1/ingest/events` with raw persistence + normalized span fan-out
- **Adapters + normalizer** → `FleetracEvent` (`pipeline/`)
- **Deterministic detection** (`detection/engine.py` + `RULE_SPECS` in fleet registry)
- **Correlation clusters + diagnosis families** (`correlation/engine.py`, `families.py`)
- **Deterministic risk assessment** policies + scoring (`correlation/policies/`, `scoring.py`)
- **Severity history** (`severity_history` table + governance API)
- **Incidents, evidence, Fleetrac Analysis, notifications, assignments**
- **Governance read/write APIs** under `/api/v1/governance/*` (live signals, ingest log, systems, owner queue, evidence, dashboard, actions, assessment, severity history, clusters)
- **Action Center path** — create/list/approve/reject/verify governed actions (`governance/actions.py`, `verification.py`, UI `/actions`)
- **Frontend governance loop pages** — Dashboard, Live Signals, Incident Queue, System Registry, Action Center, Evidence Library, Settings
- **SSE** `GET /api/v1/events/stream` + web polling fallback
- **Pitch scenarios** for Treasury / Phishing / CS latency
- **Impact modes** `contained` | `degraded` | `materialized` mutating scenario facts
- **Pytest suite** including e2e pitch, correlation risk, latency semantics, ingest, normalization

## Stable / Do Not Rework Without Reason

- Fleet system IDs, display IDs, and pitch aliases (`inc-mrm-001`, `inc-sec-001`, `inc-plat-003`)
- Ingest as the only telemetry front door
- Diagnosis family string IDs and cluster correlation key shape
- User-facing name **Fleetrac Analysis**
- Seven-item nav IA and `/outcomes` route for Evidence Library
- Latency semantics: `operation_latency_ms` vs root span duration
- Healthy → neutral normalization (null signal/severity/confidence)
- One evolving incident per active cluster; highest severity wins
- Frontend governance data via `governance-api.ts` / `governance-merge.ts` (no new mock catalogs)

## Partially Implemented

- **Phase 5 — expand fleet / continuous sim** — continuous runner exists; multi-system polish and Live Signals grouping still evolving (per prior AGENTS phase table)
- **Action Center + verification loop** — endpoints and UI exist; product depth (recurrence/reopen clarity, verification storytelling, edge cases) still the recommended hardening focus
- **Cloud adapters** — AWS/Azure/GCP adapter paths and fixtures exist; primary pitch path is OTEL v2 agent traces
- **Legacy Bob routes / sample_data / bob_* fields** — deprecated or internal; UI should not surface Bob branding
- **`/activity` page** — `apps/web/app/activity/page.tsx` exists but `next.config.ts` redirects `/activity` → `/`
- **Two correlation window constants** — canonical engine uses **15 minutes** (`correlation/families.py`); legacy `pitch_aliases.py` / `detection/correlator.py` still expose **30 minutes**. Needs deliberate reconciliation if touched
- **Normalizer severity hints** — normalizer may set provisional severity on governance signals; **final incident severity** should come from risk policies. Do not treat normalizer hints as the product severity source of truth

## Mocked or Demo-Only

- Simulator-generated telemetry (realistic shape, not production collectors)
- Template Fleetrac Analysis (not LLM investigation)
- Settings / connectors UI without real Slack or external policy engines
- Remaining `apps/api/app/sample_data/` and legacy Bob API surfaces for older paths
- Client session helpers (e.g. evidence package send-to-action session state) where noted in code
- Continuous sim auto-start in development lifespan (`main.py`) — demo convenience

Frontend `*-mock.ts` / `governance-demo-model*` catalogs are **removed**; do not reintroduce.

## Deferred

- Postgres (path documented; SQLite is current)
- Redis / Kafka / Kubernetes
- Real cloud log sinks / OTEL Collector production wiring
- RBAC / per-team authz
- LLM-assisted investigation
- Renaming `/outcomes`
- Reintroducing Bob / Activity / Usage / Controls as primary nav (unless IA explicitly re-approved)

## Current Recommended Next Milestone

**Action Center + verification loop hardening**

Prove end-to-end for flagship incidents:

1. Incident → handoff to Action Center  
2. Approve bounded action  
3. Verification telemetry / outcome recorded  
4. Incident lifecycle + Evidence Library + Dashboard reflect the result  
5. No duplicate incidents; severity history intact  

Do **not** start greenfield infrastructure or rebuild the simulator for this milestone.

## Known Risks / Open Questions

| Item | Notes |
|------|-------|
| Correlation window 15 vs 30 | Canonical cluster window is 15m; legacy 30m constant remains |
| CS accountable owner vs responder | Registry owner for A12 is Security Operations; latency risk routes responder to Platform Reliability |
| Activity route | Page present, redirect active — IA status ambiguous |
| Production readiness | Prototype; no claim of multi-tenant security, HA, or connector fidelity |
| Test/build freshness | Unknown / needs verification on this machine after doc pass |
| `packages/shared` | Thin shared contracts exist; Unknown how widely consumed vs duplicated types |

## Phase table (historical ImplementationV1)

| Phase | Focus | Status (as of prior project docs) |
|-------|--------|-----------------------------------|
| 1 OTEL ingest | v2 bundles, raw + ingest log | Proven per slice |
| 2 Normalize | OTEL → FleetracEvent | Built |
| 3 Risk engine | Rules + correlator → incidents/evidence | Built |
| 4 Mitigate | Notify, queue, Action Center, verify | Built (harden next) |
| 5 Expand fleet | Multi-system continuous sim, systems API polish | In progress |
