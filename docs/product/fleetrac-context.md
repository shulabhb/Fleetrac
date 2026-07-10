# Fleetrac product context

Concise product brief for humans and AI assistants. Architecture detail: [`../engineering/architecture.md`](../engineering/architecture.md). Stage: [`current-stage.md`](current-stage.md).

## What Fleetrac does

Fleetrac is an **observability-driven governance control plane** for production AI and agentic systems. It turns runtime telemetry into governed risk: normalize signals, detect control failures, correlate related evidence, assess severity, open (or evolve) incidents, package evidence, and hand humans a bounded path to approve remediation and verify outcomes.

It is **not** a model training dashboard, a chat copilot, or an unrestricted autonomous remediator.

## Who it is for

| Persona | Role in Fleetrac |
|---------|------------------|
| **Fleet Governor** | Primary UI persona; sees the full Observe → Investigate → Act → Measure loop |
| **Model Risk Management (MRM)** | Responder for Output Reliability incidents (e.g. Treasury / `inc-mrm-001`) |
| **Security Operations** | Responder for Cyber / tool-governance incidents (e.g. Phishing / `inc-sec-001`) |
| **Platform Reliability** | Responder for Technology / latency-routing incidents (e.g. CS A12 / `inc-plat-003`) |
| **Governed-system owner teams** | Accountable owners on systems in the fleet registry; receive routing context even when responder team differs |

Owner teams on systems today (from `apps/api/app/fleet/registry.py`): Model Risk Management, Security Operations, Platform Reliability.

## Why it exists

Production agentic systems fail in ways logs alone do not explain: unsupported claims that still publish, prompt-injection that attempts blocked tools, provider latency that degrades routing. Fleetrac exists to:

1. Observe metadata-only telemetry at an ingest boundary
2. Detect deterministic control/signal breaches
3. Correlate related signals into one diagnosis family cluster
4. Assess risk from evidence and consequence (not scenario labels)
5. Package evidence and **Fleetrac Analysis** for human decision
6. Gate remediation behind approval and verification

## Product loop

```
Runtime telemetry
  → normalization
  → detection
  → correlation
  → risk assessment
  → incident
  → evidence
  → owner/responder workflow
  → Fleetrac Analysis
  → bounded action
  → verification
```

UI loop labels: **Observe → Investigate → Act → Measure** (plus Orient / Context / Configure).

## What makes Fleetrac different from a basic logs dashboard

| Logs dashboard | Fleetrac |
|----------------|----------|
| Shows raw spans/logs | Normalizes to `FleetracEvent`, then detects |
| One alert per noisy metric | Correlates into diagnosis-family clusters |
| Severity often static | Severity from deterministic risk policies + outcomes |
| Little ownership routing | Responder team by risk category; accountable owner retained |
| No remediation governance | Action Center: approval-gated actions + verification |
| Generic “AI insights” | **Fleetrac Analysis** — template/structured, evidence-backed, bounded |

## Current demo narrative

1. Reset simulator / DB runtime tables
2. Run a pitch scenario (Treasury, Phishing, or CS latency)
3. **Live Signals** — governed + raw ingest views from API/SSE
4. **Incident Queue** — filter by responder team (MRM / SecOps / Platform)
5. Inspect **Fleetrac Analysis** and evidence on the incident
6. **Evidence Library** (`/outcomes`) — packaged incident record
7. **Action Center** — handoff, approve/reject, verify
8. **Dashboard** — KPIs from `dashboard-summary` + systems API

Pitch commands (API on `:8000`):

```bash
curl -X POST http://127.0.0.1:8000/api/v1/simulator/reset
curl -X POST http://127.0.0.1:8000/api/v1/simulator/pitch/treasury_unsupported_claim
curl -X POST http://127.0.0.1:8000/api/v1/simulator/pitch/security_tool_scope
curl -X POST http://127.0.0.1:8000/api/v1/simulator/pitch/cs_latency_regression
```

## Three flagship incidents

| Pitch id | System | Display | Incident alias | Diagnosis family (label) | Typical responder |
|----------|--------|---------|----------------|--------------------------|-------------------|
| `treasury_unsupported_claim` | `sys-agt-treasury-001` | M40 | `inc-mrm-001` | Output reliability control degradation | Model Risk Management |
| `security_tool_scope` | `sys-agt-phish-008` | PHISH-008 | `inc-sec-001` | Prompt-injection-driven tool governance violation | Security Operations |
| `cs_latency_regression` | `sys-agt-cs-002` | A12 | `inc-plat-003` | Provider degradation affecting routing reliability | Platform Reliability |

Aliases are locked in `fleet/registry.py` (`INCIDENT_ALIAS_BY_SIGNAL`) and pitch config. Canonical IDs look like `inc_{system_id}_{signal_type}_001`.

**Impact modes** for scenario progression: `contained` → `degraded` → `materialized`. Modes change evidence and business outcomes; the risk engine computes Medium / High / Critical.

## Evidence and Fleetrac Analysis

- **Evidence** is packaged per incident (`evidence_records` / `evidence_items`) and exposed via governance APIs and the Evidence Library UI.
- **Fleetrac Analysis** is stored in `fleetrac_analysis` and rendered in UI panels (`components/fleetrac/fleetrac-analysis-panel.tsx`). It is template/structured and evidence-linked—not free-form autonomous investigation.
- Do not rename Fleetrac Analysis or reintroduce “Bob” as the user-facing investigation brand.

## Near-term direction

Recommended product hardening (not greenfield rebuild):

1. **Action Center** — deepen approve/reject/verify UX and API consistency
2. **Bounded remediation** — keep `approval_required` / `auto_in_scope` / `notify_only` execution modes honest
3. **Verification telemetry** — post-remediation healthy traffic proving improvement (already partially wired in `governance/verification.py`)
4. **Recurrence / reopen** — cluster evolution and severity history already exist; reopen semantics may still need product clarity

Deferred unless explicitly requested: Postgres, Redis/Kafka, real Slack connectors, RBAC, LLM-based investigation agents.
