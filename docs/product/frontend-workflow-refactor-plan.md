# Frontend Workflow Refactor Plan

**Status:** Planning only — no implementation in this document.  
**Date:** 2026-10-09  
**Context:** Runtime agent governance product simplification. Backend pipeline (ingest → normalize → detect → correlate → risk → evidence → action → verify) stays intact.

Related: [`fleetrac-context.md`](fleetrac-context.md), [`current-stage.md`](current-stage.md), [`../engineering/architecture.md`](../engineering/architecture.md), [`../engineering/implementation-rules.md`](../engineering/implementation-rules.md).

---

## 1. Current UI Problems

### Too many primary surfaces

Current nav (`apps/web/lib/nav.ts`) has **7 items**: Dashboard, Live Signals, Incident Queue, System Registry, Action Center, Evidence Library, Settings / Connectors. That forces operators to assemble the story across pages instead of following one linear governance loop.

### Crowded / duplicate concepts

| Problem | Where it shows up |
|---------|-------------------|
| “Incident” vs risk vs evidence vs action vs verification are split across 4–5 surfaces | Incident Queue, Evidence Library modes, Action Center tabs, Dashboard owner pivots |
| Owner-queue / assignment workflow is heavy | `incident-queue-workspace.tsx` (`queue=owner`, reviewer, owner package meta) |
| Dashboard is an insights console, not a simple orient step | `governance-insights-dashboard.tsx` (~1k lines): owner filters, system tables, package links, multiple CTAs |
| Live Signals mixes governed signals with raw ingest prominence | `live-signals-feed.tsx` + large `live-signals-raw-log-panel.tsx` |
| Evidence Library has three modes | team-library / owner-package / incident-record + client package session state |
| System Registry shows full 10-agent fleet | `GOVERNED_FLEET_SYSTEM_COUNT = 10`; not focused on the 3 pitch stories |
| Settings / Connectors is connector-first fiction | `operations/settings-*.tsx`, integrations tab — not central to runtime governance demo |
| Legacy route debt still present | `/bob` redirects; `/activity` page exists but redirects; `/controls`, `/usage`, `/rules` redirects; Bob helpers still in `routes.ts` / `api.ts` / `bob-types.ts` |
| Terminology drift | Product docs say Fleetrac Analysis; routes/types still mention Bob; UI still says “Owner Queue”, “incident” everywhere |

### Unclear relationships today

Operators must infer:

```
Signal (Live Signals)
  → Incident (Incident Queue / owner mode)
  → Evidence package (Evidence Library)
  → Fleetrac Analysis (embedded in several places)
  → Hand off action (Incident Queue / Evidence)
  → Approve/verify (Action Center)
  → Measure again (Evidence / Dashboard)
```

That is correct backendly, but the **frontend IA does not make the loop obvious**. Continuous healthy telemetry also means Runtime Monitor looks “busy” while Risk Queue stays empty unless a pitch is fired — amplifying the sense that the product is a logs UI.

### Local / session / legacy issues

- `evidence-library-package-state.ts` client session packages
- `notification-state.ts` sessionStorage
- `demo-state.ts` still references bob-oriented keys
- Legacy `lib/api.ts` Bob endpoints remain callable though nav redirects away
- Action Center still has legacy tab aliases (`blocked`, `executed`, `rollback`, …)

---

## 2. Recommended Product Narrative

Fleetrac is a **runtime agent governance** control plane.

```
Runtime agent behavior
  → governed signal
  → correlated risk
  → evidence-backed diagnosis (Fleetrac Analysis)
  → bounded action
  → verification
```

User questions, mapped to surfaces:

| Question | Surface |
|----------|---------|
| Which AI agents are running? | Agent Fleet |
| Which have governance-relevant runtime risk? | Agent Fleet + Overview |
| What happened? | Runtime Monitor → Risk Detail |
| Why does it matter? | Risk Detail (diagnosis + severity reason) |
| What evidence supports the diagnosis? | Risk Detail → Evidence section |
| What action should we take? | Risk Detail → Action Center |
| Did the action work? | Action Center → Verification |

Primary language: **Agent Fleet, Runtime Monitor, Risk Queue, Risk Detail, Fleetrac Analysis, Action Center, Verification, Evidence.**  
Avoid as primary UX: Bob, assignment queue, raw-logs dashboard, connectors-first product, AI copilot.

---

## 3. Recommended Information Architecture

### Primary nav (5 items)

| Nav label | Route (Phase A keep stable paths) | Role |
|-----------|-----------------------------------|------|
| **Overview** | `/` | Orient: counts + 5-agent risk snapshot + next step CTA |
| **Agent Fleet** | `/systems` | Context: 5 agents, risk state, tools/thresholds |
| **Runtime Monitor** | `/live-signals` | Observe: governed runtime activity first; raw/tech drill-down |
| **Risk Queue** | `/incidents` | Investigate: active risks (not owner-assignment workbench) |
| **Action Center** | `/actions` | Act + verify: approve / reject / verify |

### Secondary / nested (not primary nav)

| Surface | Recommendation |
|---------|----------------|
| **Risk Detail** | Same `/incidents` workbench selection **or** `/incidents/[id]` as the single risk workspace; merges diagnosis, Fleetrac Analysis, evidence, severity history, recommended action, verification status |
| **Evidence** | **Section/tab inside Risk Detail** (not a primary nav item). Keep `/outcomes` as redirect or deep-link target for bookmarks during transition |
| **Settings / Connectors** | **Deprioritize**: remove from primary nav; optional `/settings` admin route or footer link. No connector-heavy primary story |

### Explicitly not primary

- Evidence Library as peer nav item
- Settings / Connectors
- Activity, Controls, Usage, Rules, Bob
- Owner-queue mode as the default Incident UX

### Why this shape

- Matches the seven user questions without 7 nav destinations.
- Reuses existing routes (low churn Phase A).
- Puts **Risk Detail** at the center of Investigate, with Evidence as supporting content.
- Keeps Action Center as the only Act surface (bounded, approval-gated).

---

## 4. Page-by-Page Refactor Plan

### Overview (`/`)

| | |
|--|--|
| **Purpose** | Orient: fleet risk at a glance + one obvious next action |
| **Primary question** | “What needs attention right now?” |
| **Main components** | Slim KPI strip (active risks, critical, awaiting approval, verification outcomes); 5-agent risk cards; CTA to Risk Queue / Action Center; optional pitch/scenario trigger later |
| **Backend data** | `GET /governance/dashboard-summary`, `GET /governance/systems`, optional actions list |
| **Reuse** | Parts of `governance-insights-dashboard.tsx`, `SummaryMini`, notification bell (optional) |
| **Deprioritize** | Owner-team pivot tables, evidence package CTAs, dense multi-filter console |
| **Empty state** | “No active risks — fleet healthy. Trigger a pitch scenario to demo governance.” |
| **Demo** | After Treasury pitch: Overview shows 1 critical/high risk on M40 + CTA “Open Risk Queue” |

### Agent Fleet (`/systems`)

| | |
|--|--|
| **Purpose** | Show the 5 governed agents and their runtime governance posture |
| **Primary question** | “Which agents are running, and which have risk?” |
| **Main components** | 5-agent cards/table: name, display id, owner/responder, archetype, open risks, last signal, approved/blocked tools, threshold summary; detail drawer/page |
| **Backend data** | `GET /governance/systems`, `GET /governance/systems/{id}`, `.../controls`, `.../incidents` |
| **Reuse** | `systems-fleet-view.tsx`, `system-governance-detail.tsx`, `systems-registry-client.tsx` |
| **Deprioritize** | Full 10-system sprawl; controls-browser as primary; Bob-linked posture CTAs |
| **Empty / healthy** | Agents listed with open_incidents=0, last_signal_at fresh |
| **Demo** | Flagship 3 show elevated risk after pitch; 2 supports stay healthy for contrast |

### Runtime Monitor (`/live-signals`)

| | |
|--|--|
| **Purpose** | Show governed runtime activity (signals linked to diagnosis), not a raw log console |
| **Primary question** | “What is happening on the agents right now?” |
| **Main components** | Governed signal feed / trace groups; filters by agent (5-scope); link into Risk Detail when `incident_id` present; **Technical details** expandable for ingest/raw |
| **Backend data** | `GET /governance/live-signals`, SSE `/events/stream`; ingest-log only behind expand |
| **Reuse** | `live-signals-feed.tsx`, `trace-group-panel.tsx` |
| **Deprioritize** | Raw log panel as default above-the-fold; simulator status clutter (keep reset/pitch accessible but secondary) |
| **Empty state** | Waiting for telemetry / start simulator |
| **Demo** | Pitch produces governance signals → click through to Risk Detail |

### Risk Queue (`/incidents`)

| | |
|--|--|
| **Purpose** | Single list of active governance risks for the 5-agent scope |
| **Primary question** | “What risks need a governance decision?” |
| **Main components** | Flat list: alias, agent, diagnosis family label, severity, lifecycle, updated; group optional by diagnosis/severity; **no assignment workflow**; **no default owner-queue mode** |
| **Backend data** | Today: fan-in `owner-queue` × 3 teams (already done in hooks). Prefer later: one risk-queue DTO |
| **Reuse** | List half of `incident-queue-workspace.tsx`; drop owner-mode chrome |
| **Deprioritize** | `queue=owner`, reviewer assignment UI, owner package handoff banners, multi-filter density |
| **Empty state** | “No active risks. Healthy runtime only — run a pitch to create a risk.” |
| **Demo** | Shows `inc-mrm-001` / `inc-sec-001` / `inc-plat-003` with clear severity |

### Risk Detail (selected risk / `/incidents/[id]`)

| | |
|--|--|
| **Purpose** | One place for diagnosis → evidence → analysis → action handoff |
| **Primary question** | “What happened, why it matters, what should we do?” |
| **Main components** | Header (alias, agent, severity, lifecycle); Fleetrac Analysis; Evidence section/tab; severity history; recommended bounded action; “Send to Action Center”; verification status if action exists |
| **Backend data** | `GET /governance/evidence/{id}`, `.../assessment`, `.../severity-history`, actions filtered by incident, lifecycle POST, create action POST |
| **Reuse** | Detail panel from incident workspace; `fleetrac-analysis-panel.tsx`; evidence incident record sections; correlation read models |
| **Deprioritize** | Separate Evidence Library navigation as required path; Bob panels |
| **Empty evidence** | “Evidence packaging in progress” |
| **Demo** | Full diagnosis for each flagship alias with clear handoff CTA |

### Action Center (`/actions`)

| | |
|--|--|
| **Purpose** | Bounded human decision + verification |
| **Primary question** | “What do we approve, and did it work?” |
| **Main components** | Tabs: Awaiting approval / Approved·monitoring / Closed; detail: execution mode, linked risk, verify outcome |
| **Backend data** | `GET/POST /governance/actions*`, approve/reject/verify |
| **Reuse** | `action-center-workspace.tsx`, `action-center-detail-panel.tsx`, `ExecutionModeChip` |
| **Deprioritize** | Legacy tab aliases as product language; deep links back into owner queues as primary |
| **Empty state** | “No actions awaiting approval — create from Risk Detail” |
| **Demo** | Approve → Verify → improvement_observed closes risk |

### Evidence (section, not primary page)

| | |
|--|--|
| **Purpose** | Support diagnosis trust inside Risk Detail |
| **Backend** | Existing evidence record + items + analysis |
| **Transition** | Keep `/outcomes` redirecting to Risk Detail evidence tab or slim library for bookmarks |
| **Deprioritize** | Team library / owner-package modes as primary UX |

### Settings / admin (`/settings`)

| | |
|--|--|
| **Purpose** | Low-priority config only |
| **Recommendation** | Hide from primary nav; leave route alive |
| **Deprioritize** | Connector marketplace fiction, execution console as product spine |

---

## 5. Five-Agent Scope

Must include the three flagship runtime stories:

| # | System ID | Display | Name | Role |
|---|-----------|---------|------|------|
| 1 | `sys-agt-treasury-001` | M40 | Treasury Commentary Agent | Flagship — output reliability / unsupported claim (`inc-mrm-001`) |
| 2 | `sys-agt-phish-008` | PHISH-008 | Phishing Triage Agent | Flagship — tool governance / prompt injection (`inc-sec-001`) |
| 3 | `sys-agt-cs-002` | A12 | Customer Support Routing Agent | Flagship — provider degradation / latency (`inc-plat-003`) |

Recommended supporting healthy/comparison agents (already in registry):

| # | System ID | Display | Name | Why |
|---|-----------|---------|------|-----|
| 4 | `sys-agt-rag-007` | RAG-007 | Internal Knowledge RAG Agent | Same **retrieval-grounded** archetype as Treasury; strong healthy contrast for citation/grounding stories without inventing a new agent |
| 5 | `sys-agt-access-009` | ACCESS-009 | Access Review Agent | **Security/operations-adjacent** decision agent; healthy contrast next to Phishing; already has approved/blocked tool metadata in registry |

**Not selected for the 5-agent UI scope (remain in backend registry, hide in UI filter):** Refund, PEP, KYC, Invoice, Regulatory — still valid systems, but they dilute the three-scenario demo.

**Implementation note:** Prefer a frontend scope constant (and optional API `?system_ids=` later). Do **not** delete systems from `fleet/registry.py` in this refactor.

---

## 6. Three Scenario Storyboards

### Treasury unsupported claim (`inc-mrm-001`)

1. **Agent Fleet** — M40 shows elevated open risk; RAG-007 stays healthy.  
2. **Runtime Monitor** — governance signals: unsupported claim / citation / grounding on Treasury spans; click linked risk.  
3. **Risk Queue** — `inc-mrm-001`, diagnosis *Output reliability control degradation*, severity Medium→High→Critical with impact mode.  
4. **Risk Detail** — Fleetrac Analysis (why this severity / why not higher); evidence items (evaluate spans, business.outcome); recommended bounded action (e.g. hold / tighten citation control).  
5. **Action Center** — approve `approval_required` action.  
6. **Verification** — verify improvement; risk lifecycle Closed; Overview counts drop.

### Phishing tool governance violation (`inc-sec-001`)

1. **Agent Fleet** — PHISH-008 at risk; Access Review healthy.  
2. **Runtime Monitor** — tool_scope_violation / policy deny / quarantine spans.  
3. **Risk Queue** — `inc-sec-001`, *Prompt-injection-driven tool governance violation*, typically Critical.  
4. **Risk Detail** — evidence of restricted tool attempt vs approved tools (`quarantine_route`, `ti_lookup`; blocked `refund_api_execute`).  
5. **Action Center** — approve containment / policy reinforcement action.  
6. **Verification** — improvement or rollback candidate reflected on action + risk.

### Customer Support provider degradation (`inc-plat-003`)

1. **Agent Fleet** — A12 elevated; others healthy or unrelated.  
2. **Runtime Monitor** — latency_regression / retries on model/tool spans (**not** root duration).  
3. **Risk Queue** — `inc-plat-003`, *Provider degradation affecting routing reliability*.  
4. **Risk Detail** — operation_latency evidence, routing outcome (contained/degraded/unavailable).  
5. **Action Center** — approve bounded routing/fallback action.  
6. **Verification** — post-remediation healthy latency traffic; improvement_observed.

---

## 7. What to Remove, Hide, or Deprioritize

| Current surface/concept | Recommendation | Why | Risk |
|-------------------------|----------------|-----|------|
| 7-item primary nav | Shrink to 5 | Cognitive load | Deep links break if redirects missing |
| Evidence Library as primary nav | Hide; fold into Risk Detail | Evidence supports diagnosis, is not a separate loop step for V1 | Bookmark `/outcomes` users need redirects |
| Settings / Connectors primary | Hide / footer admin | Not runtime governance | Settings route orphaned (OK) |
| Owner queue mode (`queue=owner`) | Deprioritize; keep API | Assignment UX distracts | Some CTAs still deep-link — update gradually |
| Assignment / reviewer as primary fields | Hide in Risk Queue UI | No assignment workflow for now | Backend `assignments` table remains fine |
| Raw ingest log as primary Live Signals UX | Behind “Technical details” | Product is governance, not log browser | Power users lose one-click raw view |
| Dashboard owner pivots / package CTAs | Slim Overview | Crowded orient step | Lose some demo density — acceptable |
| Bob routes / types / api helpers | Keep redirects; stop new usage; later delete dead UI | Confuses terminology | External bookmarks |
| Activity / Controls / Usage / Rules | Keep redirects; no nav | Legacy | Low |
| 10-agent registry in UI | Filter to 5 | Focus demo | Backend still 10 — document clearly |
| Evidence owner-package / team-library modes | Deprioritize | Extra IA | Session package state becomes dead code candidates |
| Connector-heavy settings tabs | Deprioritize | Fake connectors | None for demo |
| Duplicate Action Center legacy tabs as product labels | Map to 3 simple tabs only | Clarity | Query-param compat already partially handled |

**Do not casually delete backend capabilities** (owner-queue, evidence-library, notifications, assignments, 10 systems). This is frontend IA simplification.

---

## 8. Data Model / API Gaps

| Need | Status | Notes |
|------|--------|-------|
| List systems with open risk + last signal | **Already available** | `GET /governance/systems` |
| System detail: tools, thresholds, baseline | **Already available** | detail + `.../controls` |
| Live governed signals + SSE | **Already available** | `live-signals`, `/events/stream` |
| Raw ingest for tech drill-down | **Already available** | `ingest-log` |
| Active risks list | **Available but needs mapping** | Fan-in 3× `owner-queue` or systems’ incidents; UI should present as Risk Queue, not owner assignment |
| Diagnosis family on queue rows | **Already available** (API) / **needs mapping** (UI) | Present on `OwnerQueueRow`; may be underused in UI |
| Evidence + Fleetrac Analysis for one risk | **Already available** | `GET /governance/evidence/{id}` |
| Assessment / severity history | **Already available** | assessment + severity-history endpoints |
| Create / list / approve / reject / verify actions | **Already available** | governance actions routes |
| Dashboard summary KPIs | **Already available** | `dashboard-summary` |
| Unified Risk Queue DTO (all teams, 5-agent filter) | **Missing** (nice-to-have) | Can map client-side first |
| Active risk summary per agent (severity, last alias, action status) | **Available but needs mapping** | Compose systems + incidents + actions in UI |
| Latest action + verification status per risk | **Available but needs mapping** | Join actions by `incident_id` |
| Scenario-friendly status labels | **Available but needs mapping** | Map lifecycle/severity to product copy |
| First-class 5-agent scope query param | **Missing** | Start with frontend constant `DEMO_AGENT_IDS` |
| Pitch trigger from Overview/Monitor UI | **Available but needs mapping** | Simulator pitch endpoints exist; UI affordance weak/secondary |
| Hide non-demo agents server-side | **Unknown / optional** | Prefer frontend filter; don’t shrink registry |

---

## 9. Implementation Plan

### Phase A — IA cleanup only (safest first)

- Update nav labels to Overview / Agent Fleet / Runtime Monitor / Risk Queue / Action Center
- Remove Evidence Library + Settings from primary `navItems` (keep routes)
- Add redirects or soft banners if needed for `/outcomes` → risk evidence context
- Copy/trust language pass on shells (runtime agent governance)
- **No backend changes**

**Files likely:** `nav.ts`, `routes.ts` (labels/helpers), `governance-page-shell` copy, sidebar, maybe page eyebrows.  
**Tests/build:** `cd apps/web && npm run build` (+ lint).  
**Risks:** Deep links from Dashboard to Evidence/Settings; update or leave as secondary.  
**Acceptance:** 5 primary nav items; old URLs still resolve; no pipeline changes.

### Phase B — Risk Queue + Risk Detail simplification

- Default Incident page = Risk Queue (no owner mode default)
- Consolidate detail: analysis + evidence + severity history + handoff CTA
- Deprecate owner-queue chrome in UI

**Files likely:** `incident-queue-workspace.tsx`, incident detail pages/panels, `fleetrac-analysis-panel.tsx`, evidence incident-record slices, `governance-merge.ts`.  
**Tests/build:** web build; manual pitch smoke; optional API unchanged.  
**Risks:** Losing owner deep links — keep query compat temporarily.  
**Acceptance:** One-click path Risk Queue → Detail → Action handoff for `inc-mrm-001`.

### Phase C — Agent Fleet 5-agent scope

- Introduce `DEMO_AGENT_IDS` (or similar) constant
- Filter systems list/dashboard/monitor to 5
- Agent detail emphasizes tools/thresholds/last risk

**Files likely:** `governed-fleet-registry.ts`, systems components, dashboard merge, live-signals filters.  
**Tests/build:** web build; confirm 3 flagships + 2 supports visible.  
**Risks:** Hard-coding vs API filter — document.  
**Acceptance:** UI shows exactly 5 agents; backend registry still 10.

### Phase D — Action Center verification UX

- Make approve → verify path obvious and scenario-linked
- Surface verification result on Risk Detail + Overview

**Files likely:** `action-center-workspace.tsx`, detail panel, governance-api verify helpers, Overview KPIs.  
**Tests/build:** web build; manual verify; backend `test_actions_verify.py` if touching API (prefer not).  
**Acceptance:** Flagship path closes with verification visible without Evidence Library detour.

### Phase E — Remove legacy UI debt

- Stop exporting new Bob route helpers from active paths
- Remove/redirect dead pages carefully
- Delete unused session package modes when unused
- Clean Settings to minimal stub or hide entirely

**Files likely:** `routes.ts`, bob\* libs (careful), evidence package state, operations settings.  
**Tests/build:** web build; grep for Bob in user-facing strings = 0 on nav surfaces.  
**Risks:** Accidental break of redirects — keep `next.config.ts` redirects.  
**Acceptance:** No primary Bob/assignment/connectors story; redirects intact.

---

## 10. Non-Goals

This refactor must **not**:

- Rebuild the simulator
- Change detection, correlation, risk scoring, or impact-mode semantics
- Add real connectors / Slack / policy engines
- Add LLM investigation
- Add RBAC
- Redesign DB schema unless a tiny read DTO is later justified
- Create new frontend mock catalogs
- Implement production OTEL collectors
- Expand UI scope beyond 5 agents yet
- Delete backend systems, owner-queue API, or evidence APIs casually
- Casually reconcile the 15 vs 30 minute correlation window (tracked separately; only with tests)

---

## 11. Recommended First Implementation Task

**Phase A — IA cleanup only (Cursor-ready):**

> Update the frontend primary navigation and page chrome to **runtime agent governance** labels: Overview, Agent Fleet, Runtime Monitor, Risk Queue, Action Center. Remove Evidence Library and Settings/Connectors from primary nav while keeping their routes functional. Do not change backend, simulator, detection, correlation, or page business logic beyond labels/nav/shell copy.

**Acceptance criteria:**

1. Primary sidebar shows ≤5 items with the new names.  
2. `/outcomes` and `/settings` still load if navigated directly.  
3. Existing pitch → incident → action paths still reachable.  
4. `npm run build` passes.  
5. No new mocks; no backend edits.

**Follow-on (not this first task):** Phase B Risk Queue/Detail consolidation.

---

## Appendix — Repo anchors (inspection)

| Area | Path |
|------|------|
| Nav | `apps/web/lib/nav.ts` |
| Routes | `apps/web/lib/routes.ts` |
| Redirects | `apps/web/next.config.ts` |
| Governance client | `apps/web/lib/governance-api.ts` |
| Dashboard | `apps/web/components/dashboard/governance-insights-dashboard.tsx` |
| Live Signals | `apps/web/components/live-signals/*` |
| Incident Queue | `apps/web/components/incidents/incident-queue-workspace.tsx` |
| Actions | `apps/web/components/actions/action-center-workspace.tsx` |
| Evidence | `apps/web/components/evidence-library/*` |
| Systems | `apps/web/components/systems*`, `systems-fleet-view.tsx` |
| Settings | `apps/web/components/operations/settings-*.tsx` |
| Fleet registry | `apps/api/app/fleet/registry.py`, `system_metadata.py` |
| Read APIs | `apps/api/app/api/routes/governance.py`, `governance/read_models.py` |
