# AGENTS.md

Context for agents and contributors working on Fleetrac. Reflects the **current** product state on `main` after the enterprise UX pass (governance shell, Fleetrac Analysis, governed Action Center, unified demo model).

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

## Demo data architecture

**Import rule:** Prefer `apps/web/lib/governance-demo-model.ts` for cross-route IDs and pitchable constants. Avoid duplicating incident/system IDs in new mocks.

### Canonical barrel: `governance-demo-model.ts`

Re-exports aligned slices and adds:

- `NOTIFICATION_EVENTS` — Slack / email / in-app (Dashboard bell)
- `FLEETRAC_OPERATING_SCOPE` — prototype policy boundaries (Settings panel)

### Source modules (thin; do not fork IDs)

| Module | Contents |
|--------|----------|
| `governance-dashboard-mock.ts` | `GOVERNED_SYSTEMS`, `DASHBOARD_KPI`, owner insights, owner priority rows |
| `incident-queue-owner-review-mock.ts` | Owner queue rows, `pushMockActionCenterItem`, evidence labels, `OWNER_QUEUE_*` |
| `evidence-library-mock.ts` | Team library, `INCIDENT_EVIDENCE_DETAILS`, owner packages |
| `live-signals-mock.ts` | `liveRuntimeSignals()`, `LIVE_SIGNALS_SUMMARY` |
| `governance-demo-model-analysis.ts` | `FLEETRAC_ANALYSIS_BY_INCIDENT` (avoids circular imports with actions mock) |
| `governed-actions-mock.ts` | `GOVERNED_ACTIONS_CATALOG`, `mergeGovernedActions()`, tab helpers |
| `governance-demo-actions.ts` | **Session storage** for queue/evidence → Action Center handoffs |

### Pitchable demo fleet (aligned IDs)

Owner teams: **Model Risk Management**, **Security Operations**, **Platform Reliability**.

Canonical incidents for demos:

- `inc-mrm-001` — primary Model Risk / grounding path
- `inc-mrm-002`, `inc-sec-001`, `inc-plat-001` — queue and action catalog seeds
- `inc-gov-001`, `inc-auto-001` — policy-blocked and auto-in-scope action examples

### Scripted demo path (no legacy URLs)

1. **Dashboard** — posture, owner queue CTA, notification bell  
2. **Live Signals** — signal linked to `inc-mrm-001`  
3. **Incident Queue** — `?queue=owner`, Fleetrac Analysis on detail, Send to Action Center  
4. **Evidence Library** — `?evidenceMode=incident-record&incidentId=inc-mrm-001`  
5. **Action Center** — governed inbox, approve, execution mode chip  
6. **Evidence Library** — verification / lifecycle copy  
7. **Settings** — connectors, **Fleetrac operating scope**

---

## Action Center (governed inbox only)

- **No** `getActions()` in the page inbox; **no** “Sample actions (API)” UI.
- Inbox = `mergeGovernedActions(readDemoWorkflowActions())` from `governed-actions-mock.ts` + session overlay.
- Session: `governance-demo-actions.ts` (`fleetrac-mock-action-center-items`, event `fleetrac-demo-actions-updated`).
- Dedupe by `incidentId`; selection id prefix `gov:{actionId}`.
- Tabs (URL `tab`): `pending` \| `ready` \| `closed` (legacy tab names normalize in workspace).
- Detail: `action-center-detail-panel.tsx` — Approve/Reject, Fleetrac Analysis, links to evidence and queue.

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
- Detail panel: Fleetrac Analysis (`fleetracAnalysisForQueueIncident`), send to Action Center via `pushMockActionCenterItem`.

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

| Area | Source |
|------|--------|
| Action Center inbox | Mock catalog + session only |
| Dashboard owner queue / KPIs | `governance-dashboard-mock` (+ overrides in dashboard client state) |
| Live Signals table | `live-signals-mock.ts` |
| Systems list/detail, settings integrations | API (`lib/api.ts`) with mock/sample backend data |
| Notifications on Dashboard | `NOTIFICATION_EVENTS` in demo model (not live Slack) |

Backend may still expose Bob-related endpoints/sample data; web UI does not surface Bob routes.

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
3. Extend `governance-demo-model` / existing mocks rather than adding parallel ID graphs.
4. Re-verify pitch path, trust language, and shell consistency.

---

## Out of scope (unless explicitly requested)

- RBAC / per-team permissions
- Real Slack, telemetry ingest, or policy engine backend
- Reintroducing Bob, Activity, Usage, or Controls as primary nav
- Renaming `/outcomes` route (product name is already Evidence Library)
