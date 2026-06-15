# AGENTS.md

Context for agents and contributors working on Fleetrac. Branch **ImplementationV1**: phased transition from demo mocks to a real OTEL ingest → normalize → detect → mitigate pipeline.

---

## Implementation transition (mock → real)

Fleetrac is **step-by-step** replacing mock behavior with a production-shaped governance runtime. Follow phase order; do not skip ahead.

| Phase | Focus | Status |
|-------|--------|--------|
| **1 — OTEL ingest** | v2 multi-span bundles; `POST /api/v1/ingest/events`; raw persistence + ingest log UI | **Proven per slice** |
| **2 — Normalize** | OTEL adapter → `FleetracEvent`; stable fields for system, model, evaluation signals | **Built** |
| **3 — Risk engine** | Rule evaluation + correlator → incidents + evidence | **Built** |
| **4 — Mitigate** | Notifications, owner queue, Action Center, verification | **Built** |
| **5 — Expand fleet** | Multi-system continuous sim, trace-grouped Live Signals, governance systems API | **In progress** |

### Transition rules (all contributors)

1. **Ingest is canonical** — All telemetry (simulator today, OTEL Collector later) enters via `POST /api/v1/ingest/events`. No bypass writes to incidents or live signals.
2. **OTEL-first envelopes** — Start with `otel_agent_trace` / `langgraph_trace` (`apps/api/app/schemas/ingestion.py`: `RawOtelEnvelope`). Metadata-only, realistic `trace_id` / `span_id` / `evaluation` blocks.
3. **No new mock catalogs** — Do not add rows to `*-mock.ts` or expand `MOCK_STORE` fiction. Governance loop pages use API data or empty states.
4. **One vertical slice at a time** — Default proof system: `sys-agt-treasury-001` (M40). Pass pytest + manual pitch before fleet-wide changes.
5. **Extend, don't fork** — `ingest_pipeline.py`, `pipeline/`, `detection/`, `governance/read_models.py`, `governance-api.ts`, `governance-merge.ts`.
6. **10 governed systems** — Fleet registry (`apps/api/app/fleet/registry.py`) is the System Registry scope; dashboard governed-system count stays **10**.

Cursor rule: `.cursor/rules/implementation-transition.mdc` (always applied).

---

## Mission

Fleetrac is an **observability-driven governance control plane** for production AI systems—not a model dashboard or chat copilot.

| Concept | Definition |
|--------|------------|
| Primary persona | **Fleet Governor** (sidebar; full governance access in prototype) |
| Core loop | **Observe → Investigate → Act → Measure** (+ Orient on Dashboard, Configure in Settings, Context in System Registry) |
| Operator story | Live telemetry surfaces risk → evidence is packaged → owners investigate → Fleetrac Analysis informs decisions → humans approve governed actions → outcomes are measured in Evidence Library |

**Trust language (user-facing, always):** Fleetrac is bounded, policy-checked, approval-gated, audit-linked, and reversible by default where supported. Do not present analysis or automation as unrestricted autonomous AI.

---

## Repository layout

| Path | Role |
|------|------|
| `apps/web/` | Next.js 15 App Router UI (`npm run dev` / `npm run build` here) |
| `apps/api/` | FastAPI backend; sample data and routes for Observe/Investigate/Act/Measure domains |
| `apps/web/lib/api.ts` | Central client for API calls—prefer over ad-hoc fetch |
| `apps/web/lib/routes.ts` | **Single source of truth** for internal URLs—never hand-assemble paths in components |

Monorepo root has shared dependencies; web app has its own `package-lock.json`.

---

## Product IA (seven nav items)

Defined in `apps/web/lib/nav.ts`. Sidebar shows **loop step** under the active item (`orient`, `observe`, `investigate`, `context`, `act`, `measure`, `configure`).

| Loop | Label | Route | Page entry | Primary workspace |
|------|--------|-------|------------|-------------------|
| Orient | Dashboard | `/` | `app/page.tsx` | `components/dashboard/governance-insights-dashboard.tsx` |
| Observe | Live Signals | `/live-signals` | `app/live-signals/page.tsx` | `components/live-signals/live-signals-feed.tsx` |
| Investigate | Incident Queue | `/incidents` | `app/incidents/page.tsx` | `components/incidents/incident-queue-workspace.tsx` |
| Context | System Registry | `/systems` | `app/systems/page.tsx` | `components/systems-fleet-view.tsx` |
| Act | Action Center | `/actions` | `app/actions/page.tsx` | `components/actions/action-center-workspace.tsx` |
| Measure | Evidence Library | `/outcomes` | `app/outcomes/page.tsx` | `components/evidence-library/evidence-library-app.tsx` |
| Configure | Settings / Connectors | `/settings` | `app/settings/page.tsx` | `components/operations/settings-view.tsx` |

**Global scope:** Sidebar scope selector writes `?scope=` via `apps/web/lib/ai-scope.ts` (`withAiScope`, `normalizeAiScope`). List pages that call the API should filter systems/incidents/actions consistently.

**Removed from nav (redirect only):** Bob, Activity, Controls (list), Usage, standalone Rules. See redirects below.

---

## Legacy redirects (`apps/web/next.config.ts`)

| Source | Destination |
|--------|-------------|
| `/bob`, `/bob/:path*` | `/` (Dashboard) |
| `/activity` | `/` |
| `/controls`, `/controls/:path*` | `/systems` |
| `/usage` | `/` |
| `/rules` | `/settings` |

**Legacy detail routes (in-app redirects):**

| Route | Behavior |
|-------|----------|
| `/incidents/[id]` | → owner queue with `?queue=owner&owner=…&incident=…` when incident is in demo queue; else `/incidents` |
| `/actions/[id]` | → `/actions?action={id}&tab=pending` (workbench selection) |
| `/outcomes/[id]` | → `/outcomes` |

Do not reintroduce Bob, Activity, or Usage as nav items without an approved IA change.

---

## Page shell and UI conventions

### `GovernancePageShell`

`apps/web/components/layout/governance-page-shell.tsx` — standard header for most nav routes:

- Props: `loop`, `eyebrow`, `title`, `subtitle`, `workflowLine`, optional `summary`, `headerAction`, `children`
- **Uses shell:** Live Signals, System Registry, Settings, Action Center (inside workspace), Evidence Library team index (and scoped system wrapper on outcomes page)
- **Custom header (no shell):** Dashboard (`governance-insights-dashboard.tsx`), Incident Queue (`incident-queue-workspace.tsx`) — same visual vocabulary (eyebrow, `h1`, stats) but inline

### Shared primitives

| Primitive | Path | Use |
|-----------|------|-----|
| `SummaryMini` | `components/ui/summary-mini.tsx` | KPI / summary rows in shell and workbenches |
| `Card`, `Badge`, `Select` | `components/ui/` | Dense enterprise UI |
| `GovernancePageShell` | `components/layout/` | Route headers |
| Avoid `SectionTitle` | `components/ui/section-title.tsx` | Legacy; not on kept nav surfaces except rare drill-downs |

### Workbench layout

Master–detail pages: `lg:grid-cols-[1fr_minmax(280px,340px)]` (Incident Queue, Action Center).

### Fleetrac narrative components (`components/fleetrac/`)

| Component | Purpose |
|-----------|---------|
| `fleetrac-analysis-panel.tsx` | Bounded analysis block (incident, system detail, action detail) |
| `execution-mode-chip.tsx` | `approval_required` \| `auto_in_scope` \| `notify_only` |
| `notification-bell.tsx` | Dashboard header: icon + dropdown (not a full-width timeline) |
| `fleetrac-operating-scope-panel.tsx` | Read-only auto vs approval-gated lists (Settings top) |
| `notification-timeline.tsx` | Optional full-width list (unused on Dashboard; bell preferred) |

### App chrome

- `components/sidebar.tsx` — nav, Fleet Governor persona, scope menu, demo reset
- `components/app-main-shell.tsx` — scrollable content; triage dock removed
- `components/shared/flow-breadcrumb.tsx` — loop orientation on detail surfaces; icon `analysis` (not `bob`)

---

## Multi-cloud simulator and ingestion pipeline

Local SQLite (`apps/api/data/fleetrac_sim.db`) is the **source of truth** for governance runtime data when the simulator is active.

### Architecture

| Layer | Path | Role |
|-------|------|------|
| Simulator | `apps/api/app/simulator/` | Archetype generators + v2 trace bundles; **must** POST via HTTP loopback to ingest |
| Ingest | `POST /api/v1/ingest/events` | Validate v1 flat + v2 nested bundles; one raw row per bundle; fan-out normalized spans |
| Pipeline | `apps/api/app/pipeline/` | OTEL + AWS/Azure/GCP adapters → `FleetracEvent` |
| Detection | `apps/api/app/detection/` | Rule engine + correlator → incidents |
| Governance | `apps/api/app/governance/` | Evidence, Fleetrac Analysis, notifications, actions, verification |
| Read APIs | `GET /api/v1/governance/*` | Live signals, owner queue, evidence library, dashboard summary, **`GET /governance/systems`** |
| Simulator API | `GET /simulator/scenarios`, `POST /simulator/runs` | Scenario catalog (implemented vs planned); batch healthy runs |
| SSE | `GET /api/v1/events/stream` | Live Signals push; 5s polling fallback in `use-event-stream.ts` |

### Feature flag

- `NEXT_PUBLIC_GOVERNANCE_API=1` (default): frontend reads governance APIs.
- `NEXT_PUBLIC_GOVERNANCE_API=0`: legacy mock catalogs (deprecated on ImplementationV1; prefer API or empty states).

**Merge rule:** API-sourced rows replace any remaining mock rows by alias; do not add new mock rows during implementation transition.

### Key client modules

| Module | Role |
|--------|------|
| `apps/web/lib/governance-api.ts` | Governance + simulator HTTP client |
| `apps/web/lib/simulator-api.ts` | Simulator control re-exports |
| `apps/web/lib/governance-merge.ts` | API → UI row mappers |
| `apps/web/lib/governance-types.ts` | Shared types (no mock rows) |
| `apps/web/hooks/use-governance-data.ts` | Polling refresh for governance surfaces |
| `apps/web/hooks/use-event-stream.ts` | SSE + polling fallback |

### OTEL v2 trace bundles

- Envelope: `schema_version: "2.0"`, `source_type: "otel_agent_trace"`, nested `spans[]` with parent-child links.
- One `raw_events` row per ingest POST; each span becomes a `normalized_events` row referencing `raw_envelope_id`.
- Healthy spans: `signal_state=healthy`, `severity=null`, `confidence=null`.
- Retention: 10k raw envelopes, 5k normalized rows (pruned on ingest).
- Semconv: `apps/api/app/pipeline/adapters/genai_semconv.py` + `SEMCONV.md`.

### E2E pitch scenarios (Phase 4)

| Pitch | System | Incident alias | Responder queue |
|-------|--------|----------------|-----------------|
| `treasury_unsupported_claim` | `sys-agt-treasury-001` (M40) | `inc-mrm-001` | Model Risk Management |
| `security_tool_scope` | `sys-agt-phish-008` | `inc-sec-001` | Security Operations |
| `cs_latency_regression` | `sys-agt-cs-002` (A12) | `inc-plat-003` | Platform Reliability |

Owner queue filters **`responder_team`**; incidents retain **`accountable_owner_team`** for routing context.

### Pitch commands

```bash
curl -X POST http://127.0.0.1:8000/api/v1/simulator/reset
curl -X POST http://127.0.0.1:8000/api/v1/simulator/pitch/treasury_unsupported_claim
curl -X POST http://127.0.0.1:8000/api/v1/simulator/pitch/security_tool_scope
curl -X POST http://127.0.0.1:8000/api/v1/simulator/pitch/cs_latency_regression
```

Full loop: Live Signals → Incident Queue (MRM) → Evidence Library → Action Center → Approve → Verify → Dashboard.

### Production replacement path

Simulator generators → OTEL Collector / cloud log sinks → same `POST /ingest/events` envelope. SQLite → Postgres. Template analysis → policy-guarded LLM assist.

---

## Demo data architecture

**Import rule:** Prefer `apps/web/lib/governance-types.ts` and `governance-incident-routing.ts` for IDs and routing. Use `governance-demo-model.ts` only for API-off fallback constants.

### Canonical modules

| Module | Contents | When used |
|--------|----------|-----------|
| `governance-api.ts` + `governance-merge.ts` | Live API data | `NEXT_PUBLIC_GOVERNANCE_API=1` (default) |
| `governance-dashboard-mock.ts` | KPI/owner fiction | API-off fallback only |
| `incident-queue-owner-review-mock.ts` | Queue rows | API-off fallback only |
| `evidence-library-mock.ts` | Library catalog | API-off fallback only |
| `live-signals-mock.ts` | Signal catalog | API-off fallback only |
| `governed-actions-types.ts` | Action types + tab helpers | Always (types only) |

### Pitchable fleet (10 systems)

Registry: `apps/api/app/fleet/registry.py`. Owner teams: **Model Risk Management**, **Security Operations**, **Platform Reliability**.

Primary pitch IDs:

- System: `sys-agt-treasury-001` / display `M40`
- Incident alias: `inc-mrm-001` (canonical: `inc_sys-agt-treasury-001_unsupported_claim_001`)
- Security alternate: `sys-agt-cs-002` / `A12` → `inc-sec-001`

### Scripted demo path

1. **Reset + pitch** — simulator controls or `POST /simulator/pitch/treasury_unsupported_claim`
2. **Live Signals** — SSE feed with linked incident
3. **Incident Queue** — MRM owner queue, Fleetrac Analysis on detail
4. **Evidence Library** — incident record for `inc-mrm-001`
5. **Action Center** — approve governed action (`approval_required`)
6. **Verify** — post-remediation traffic + incident closed
7. **Dashboard** — live KPIs from `dashboard-summary`

---

## Action Center (governed inbox)

- Inbox reads `GET /api/v1/governance/actions` when governance API is enabled.
- Handoffs: `POST /api/v1/governance/incidents/{id}/actions` from Incident Queue / Evidence Library.
- Approve/reject/verify: governance action endpoints (not session overlay).
- Tabs (URL `tab`): `pending` | `ready` | `closed`.
- Detail: `action-center-detail-panel.tsx` — bounded execution mode chip, Fleetrac Analysis, evidence links.

---

## Evidence Library (`/outcomes`)

Product label: **Evidence Library**. Route remains `/outcomes`.

**Modes** (`evidenceMode` query, see `routes.ts`):

| Mode | Query | Component |
|------|-------|-----------|
| Team library | (default) | `evidence-library-app.tsx` → team table |
| Owner package | `evidenceMode=owner-package&owner=` | `evidence-library-owner-package.tsx` |
| Incident record | `evidenceMode=incident-record&incidentId=` | `evidence-library-incident-record.tsx` |

Live package state: `evidence-library-package-state.ts` (client session for send-to-action flows).

Scoped system view: `outcomes/page.tsx` with `?system=` — shell + context banner + same app modes.

---

## Incident Queue

- Single workbench at `/incidents` (no standalone triage dock).
- Owner mode: `?queue=owner&owner={team}&incident={id}`.
- Filters: `system`, `severity`, `risk`, `owner`, `lifecycle`, `q`, `rule` (control scope).
- Detail panel: Fleetrac Analysis from evidence API, send to Action Center via `handoffIncidentToActionCenter`.

---

## System Registry

- List: API systems + incidents, filtered by `scope`; cards link to detail and **View governance posture** (incidents), not Bob.
- Detail: `systems/[id]/page.tsx` — production truth, telemetry, controls, **FleetracAnalysisPanel**, linked actions from API (supporting context); analysis links to incident queue.

---

## Terminology

| Do not use (user-facing) | Use instead |
|--------------------------|-------------|
| Bob, Bob Copilot, Bob investigation | **Fleetrac Analysis** |
| Bob prepares | **Prepared for approval** (badges) |
| Sample API actions | **Governed actions** |

Internal/API field names may still contain `bob_*` (e.g. integration flags, `bob_operating_mode` on policies)—update labels in UI copy only unless doing an approved API migration.

`routes.ts` still exports `routeToBob*` helpers; new code should use Incident Queue, Action Center, or Evidence Library builders. Bob URLs redirect to Dashboard.

---

## URL query params (canonical UI state)

Keep names/semantics unless migrating all producers and consumers.

| Surface | Params |
|---------|--------|
| Global | `scope` (AI scope) |
| Actions | `tab` (`pending` \| `ready` \| `closed`), `q`, `risk`, `action` (select row), `returnTo` |
| Outcomes / Evidence | `evidenceMode`, `owner`, `incidentId`, `system`, `tab`, `q`, `env`, `type` |
| Incidents | `queue`, `owner`, `incident`, `system`, `severity`, `risk`, `lifecycle`, `q`, `rule` |
| Settings | `tab`, `integration` |

Use `appendReturnTo(...)` and `safeReturnTo(...)` for back continuity on drill-downs.

---

## Status and label helpers

Reuse centralized maps—do not duplicate:

- `apps/web/lib/governance-states.ts`
- `apps/web/lib/integration-access-vocabulary.ts`
- `apps/web/components/actions/action-badges.tsx`
- `apps/web/components/operations/operations-badges.tsx`

Tone: enterprise operational; avoid marketing copy.

---

## API vs prototype boundaries

| Area | Source (target) | Legacy (do not extend) |
|------|-----------------|------------------------|
| Live Signals | `GET /governance/live-signals`, `GET /governance/ingest-log`, SSE | `live-signals-mock.ts` |
| Incident Queue | `GET /governance/owner-queue` | `incident-queue-owner-review-mock.ts` |
| Evidence Library | `GET /governance/evidence-library` | `evidence-library-mock.ts` |
| Action Center | `GET /governance/actions` | — |
| Dashboard KPIs | `GET /governance/dashboard-summary` + static 10-system count | `governance-dashboard-mock.ts` |
| Notifications | `GET /governance/notifications` | — |
| Systems list/detail | API (`lib/api.ts`) — 10 fleet systems only | Excel `sys_m*` catalog |

Bob API routes are deprecated; use governance evidence Fleetrac Analysis instead.

---

## Product guardrails

- Preserve seven-item IA unless explicitly approved.
- Action Center = governed **decision** surface (approve/reject), not unconstrained execution UI.
- Evidence Library = **measurement and evidence** surface post-remediation.
- Do not remove capabilities while simplifying UX; redirect and consolidate instead.
- Refactor goal: **one operating loop**, clear page ownership, above-the-fold hierarchy—not net-new features by default.

---

## Quality gates (before finalizing)

- [ ] `npm run build` passes in `apps/web`
- [ ] Lint/typecheck clean for touched files
- [ ] Internal links use `routes.ts` builders
- [ ] Deep links (`evidenceMode`, `queue=owner`, `action=`) still resolve
- [ ] List → detail → back continuity with `returnTo` where applicable
- [ ] No new user-facing “Bob” or “Sample API” strings on nav surfaces
- [ ] No package drift in `apps/web` scope

---

## Process for broad changes

1. Confirm ownership and IA impact first (which loop step owns the change).
2. Stage: routing/state and demo model alignment before large layout moves.
3. Extend `governance-merge.ts` / `governance-api.ts` rather than adding parallel ID graphs.
4. Re-verify pitch path, trust language, and shell consistency.

---

## Out of scope (unless explicitly requested)

- RBAC / per-team permissions
- Replacing SQLite with Postgres (document path; implement when approved)
- Real Slack or external policy engine connectors (Settings remains config UI)
- Reintroducing Bob, Activity, Usage, or Controls as primary nav
- Renaming `/outcomes` route (product name is already Evidence Library)
- **New mock/demo data rows** during ImplementationV1 transition
