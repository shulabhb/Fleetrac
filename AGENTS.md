# AGENTS.md

Instructions for coding agents and contributors working in Fleetrac.

Deeper context lives under `docs/`:

| Doc | Purpose |
|-----|---------|
| [`docs/product/fleetrac-context.md`](docs/product/fleetrac-context.md) | Product identity, personas, demo narrative |
| [`docs/product/current-stage.md`](docs/product/current-stage.md) | What is built / frozen / deferred |
| [`docs/engineering/architecture.md`](docs/engineering/architecture.md) | Actual repo architecture |
| [`docs/engineering/implementation-rules.md`](docs/engineering/implementation-rules.md) | Strict engineering rules |
| [`docs/engineering/testing-checklist.md`](docs/engineering/testing-checklist.md) | How to test changes |
| [`docs/ai-handoff/current-task.md`](docs/ai-handoff/current-task.md) | Task scoping template |
| [`docs/ai-handoff/completion-report.md`](docs/ai-handoff/completion-report.md) | Completion report template |

Cursor rule: `.cursor/rules/implementation-transition.mdc` (always applied).

---

## 1. Project identity

Fleetrac is an **observability-driven governance control plane** for production AI and agentic systems—not a model dashboard, chat copilot, or unrestricted autonomous agent.

**Operator loop:** Observe → Investigate → Act → Measure  
(+ Orient on Dashboard, Context in System Registry, Configure in Settings)

**Trust language (user-facing):** bounded, policy-checked, approval-gated, audit-linked, reversible by default where supported. Do not present analysis or automation as unrestricted autonomous AI.

**Primary UI persona:** Fleet Governor (full governance access in the prototype).

---

## 2. Current product spine

```
Runtime telemetry (simulator today)
  → POST /api/v1/ingest/events
  → raw_events persistence
  → normalize → FleetracEvent
  → detection (rules)
  → correlation clusters (diagnosis family)
  → deterministic risk assessment → severity
  → one evolving incident per cluster
  → evidence + Fleetrac Analysis
  → owner/responder queue
  → governed action (Action Center)
  → verification
```

**10 governed systems** (canonical registry: `apps/api/app/fleet/registry.py`):

| Archetype (metadata) | Systems |
|----------------------|---------|
| Decision | Refund Approval, PEP Screening, Access Review |
| Retrieval-grounded | Treasury Commentary (M40), Internal Knowledge RAG, Regulatory Change Monitor |
| Document | KYC Document Review, Invoice Validation |
| Security/operations | Phishing Triage, Customer Support Routing (A12) |

**Flagship aliases (must preserve):**

| Narrative | System | Alias |
|-----------|--------|-------|
| Treasury unsupported claim | `sys-agt-treasury-001` / M40 | `inc-mrm-001` |
| Phishing tool scope | `sys-agt-phish-008` | `inc-sec-001` |
| CS latency / routing | `sys-agt-cs-002` / A12 | `inc-plat-003` |

**Diagnosis families** (`apps/api/app/correlation/families.py`):

- `output_reliability_control_degradation`
- `prompt_injection_tool_governance_violation`
- `provider_degradation_routing_reliability`

**Correlation key:** `tenant_id:environment:system_id:diagnosis_family`  
**Correlation window (canonical engine):** 15 minutes (`CORRELATION_WINDOW_MINUTES` in `correlation/families.py`)

**Impact modes (simulator):** `contained` | `degraded` | `materialized` — mutate evidence/outcomes; risk policies compute severity.

---

## 3. Current architecture summary

| Layer | Path | Role |
|-------|------|------|
| Web UI | `apps/web/` | Next.js 15 App Router; seven-item IA |
| API | `apps/api/` | FastAPI; entry `main:app` |
| Simulator | `apps/api/app/simulator/` | v2 OTEL bundles; **must** HTTP POST to ingest |
| Ingest | `services/ingest_pipeline.py` | Validate, persist raw, fan-out spans |
| Pipeline | `pipeline/` | Adapters + normalizer → `FleetracEvent` |
| Detection | `detection/engine.py` | Deterministic rule evaluation |
| Correlation / risk | `correlation/` | Clusters, policies, scoring, severity history |
| Governance | `governance/` | Incidents, evidence, analysis, actions, verification |
| Store | SQLite `apps/api/data/fleetrac_sim.db` | Runtime source of truth when sim is active |

Seven nav items (`apps/web/lib/nav.ts`): Dashboard, Live Signals, Incident Queue, System Registry, Action Center, Evidence Library (`/outcomes`), Settings.

---

## 4. Critical invariants

1. **Do not rename Fleetrac Analysis** (user-facing). Do not reintroduce Bob / Bob Analysis as product language.
2. **Do not remove existing aliases** (`inc-mrm-001`, `inc-sec-001`, `inc-plat-003`, system display IDs).
3. **Do not bypass HTTP ingest** for simulator traces — always `POST /api/v1/ingest/events` (see `http_ingest_client.py`).
4. **Do not correlate neutral healthy telemetry** — healthy spans stay non-incident; `is_correlation_eligible` excludes healthy-without-signal and wait spans.
5. **Do not use root span duration for provider latency incidents** — use `operation_latency_ms` on model/tool/retrieval spans (`otel_agent.py`, `detection/engine.py`).
6. **Do not hardcode final incident severity from scenario names** — impact modes mutate facts; policies in `correlation/policies/` score severity.
7. **Do not create duplicate incidents** for related signals inside the active correlation window — one evolving incident per cluster; preserve **highest severity**.
8. **Healthy spans normalize to neutral** — `normalized_signal_type=null`, `severity=null`, `confidence=null`.
9. **Wait spans** (`operation: wait`, names ending `.wait`) must stay correlation-ineligible and must not drive provider operation latency.
10. **Business outcomes affect severity only with governance signals** — outcomes alone do not invent incidents.
11. **Do not add** Redis, Kafka, Kubernetes, cloud connectors, or LLM investigation unless explicitly requested.
12. **Prefer small, testable slices** — one system / one behavior change at a time.

---

## 5. What agents must read before changes

Before non-trivial work, read:

1. This file (`AGENTS.md`)
2. `docs/product/current-stage.md`
3. `docs/engineering/implementation-rules.md`
4. Relevant code under the layer you will touch (ingest / detection / correlation / governance / UI)
5. Existing tests for that slice (`apps/api/tests/`, especially `tests/e2e/` and `tests/test_correlation_risk.py`)
6. Fill `docs/ai-handoff/current-task.md` (or equivalent task brief) before coding

For UI route/state work: `apps/web/lib/routes.ts`, `nav.ts`, `governance-api.ts`, `governance-merge.ts`.

---

## 6. What agents must not change casually

- Fleet registry IDs, display IDs, and pitch aliases
- Ingest contract (`schemas/ingestion.py`, `POST /ingest/events`)
- Diagnosis family IDs and correlation key shape
- Seven-item product IA / nav labels (unless explicitly approved)
- Evidence Library route path `/outcomes` (product name stays Evidence Library)
- User-facing “Fleetrac Analysis” naming
- Frontend mock catalog reintroduction (`*-mock.ts` removed)
- Parallel ID graphs or duplicate merge layers
- Infrastructure expansions (Postgres, Redis, Kafka, real Slack, etc.) without request

---

## 7. Backend rules

- Entry point: `cd apps/api && uvicorn main:app --reload --port 8000` (module is `main:app`, not `app.main:app`).
- Extend `ingest_pipeline.py`, `pipeline/`, `detection/`, `correlation/`, `governance/` — do not fork parallel pipelines.
- Simulator posts via `simulator/http_ingest_client.py` only.
- Detection is deterministic rule evaluation; final severity comes from correlation risk policies.
- Legacy `detection/correlator.py` and `slice_a/` / `pitch_aliases.CORRELATION_WINDOW_MINUTES=30` are older paths — **canonical cluster window is 15 minutes** in `correlation/families.py`. Do not silently diverge further; reconcile deliberately with tests.
- Keep SQLite as local store unless migration is explicitly requested.

---

## 8. Frontend rules

- Prefer `governance-api.ts` + `governance-merge.ts` over ad-hoc fetch or local fiction.
- Empty/zero UI states beat fictional demo rows when the API has no events.
- Internal links: always `routes.ts` builders.
- Do not redesign navigation unless asked.
- Do not reintroduce Bob as nav or primary investigation UX; use Fleetrac Analysis panels.
- `/activity` currently **redirects to Dashboard** in `next.config.ts` even though `app/activity/page.tsx` exists — do not treat Activity as primary nav without an approved IA change.
- Quality gate: `cd apps/web && npm run build` (and `npm run lint` when touching UI).

---

## 9. Simulator rules

- Generate realistic OTEL v2 bundles (`schema_version: "2.0"`, nested `spans[]`).
- Always ingest through HTTP; never write incidents/signals directly to DB from generators.
- Impact modes mutate span attributes / business outcomes (`scenarios/mutations.py`), not final severity fields on incidents.
- Healthy traffic must not create incidents (covered by latency + ingest tests).
- Pitch endpoints: `POST /api/v1/simulator/pitch/{treasury_unsupported_claim|security_tool_scope|cs_latency_regression}`.

---

## 10. Detection / correlation / risk rules

- Rules live in `fleet/registry.py` (`RULE_SPECS`) and DB `detection_rules`.
- Latency rules read `operation_latency_ms` (not root `agent.request` duration).
- Correlation eligibility: `correlation/engine.py::is_correlation_eligible`.
- Policies: `correlation/policies/{output_reliability,tool_governance,platform_reliability}.py`.
- Scoring bands: Medium / High / Critical via `correlation/scoring.py` (no Low band in current scorer).
- Preserve one incident per active cluster; update severity upward; record `severity_history`.

---

## 11. Testing rules

- Every behavior change needs targeted pytest coverage.
- Backend: `cd apps/api && pytest tests/ -v` (or a focused path).
- Frontend: `cd apps/web && npm run build`.
- Prefer existing e2e pitch tests over inventing new demo data.
- See `docs/engineering/testing-checklist.md`.

---

## 12. Completion report requirements

After each task, fill `docs/ai-handoff/completion-report.md` (or paste the same sections in the PR/chat):

- Summary, files changed, architecture/API/schema/UI deltas
- Tests run + results, build results, manual smoke
- Invariants preserved, deferred work, risks/follow-ups

Do not claim production readiness. Prefer “prototype / ImplementationV1” language.

---

## Product IA (reference)

| Loop | Label | Route |
|------|-------|-------|
| Orient | Dashboard | `/` |
| Observe | Live Signals | `/live-signals` |
| Investigate | Incident Queue | `/incidents` |
| Context | System Registry | `/systems` |
| Act | Action Center | `/actions` |
| Measure | Evidence Library | `/outcomes` |
| Configure | Settings / Connectors | `/settings` |

Legacy redirects: `/bob` → `/`, `/activity` → `/`, `/controls` → `/systems`, `/usage` → `/`, `/rules` → `/settings`.

---

## Out of scope (unless explicitly requested)

- RBAC / per-team permissions
- SQLite → Postgres migration
- Real Slack or external policy engines
- Reintroducing Bob / Activity / Usage / Controls as primary nav
- Renaming `/outcomes`
- New mock/demo catalogs
- Redis / Kafka / K8s / cloud connector platforms / LLM investigation agents
