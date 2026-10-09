# Flagship demo walkthrough

Local demo only. Registry, rules, and scenario stories stay in place. Runtime telemetry, risks, actions, and outcomes can be cleared.

## Setup

```bash
# API
cd apps/api && uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Web
cd apps/web && npm run dev
```

Open http://127.0.0.1:3000

Reset to an empty runtime before recording:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/simulator/reset-demo
```

`POST /api/v1/simulator/reset` does the same thing.

## Scenario commands

From `apps/web`:

| Script | What it does |
|--------|----------------|
| `npm run demo:reset` | Stop the simulator and clear runtime rows |
| `npm run demo:baseline` | Healthy traffic, about one event every 3 seconds |
| `npm run demo:stop` | Stop generation |
| `npm run demo:treasury` | Pitch `inc-mrm-001` |
| `npm run demo:phishing` | Pitch `inc-sec-001` |
| `npm run demo:platform` | Pitch `inc-plat-003` |
| `npm run demo:health` | Read-only check of API, pages, and redirects |

Health check from the repo root:

```bash
python3 scripts/demo_health_check.py
```

### Baseline

Expected: Runtime Monitor shows telemetry. Risk Queue does not gain a new risk from healthy spans.

```bash
cd apps/web && npm run demo:baseline
```

### Treasury — improvement

```bash
cd apps/web && npm run demo:treasury
```

Expected:

- Risk Queue shows `inc-mrm-001`
- Risk Detail shows unsupported claim rate above the allowed threshold and packaged evidence
- Action Center has one governed action for that risk
- Approve, then verify
- Result: improvement observed
- Outcomes audit lists that verification

Direct link: http://127.0.0.1:3000/incidents?incident=inc-mrm-001

### Phishing — rollback candidate

```bash
cd apps/web && npm run demo:phishing
```

Expected: `inc-sec-001`, tool-scope evidence, rollback-eligible action, verify result rollback candidate. CTA: Review rollback path.

http://127.0.0.1:3000/incidents?incident=inc-sec-001

### Platform — follow-up

```bash
cd apps/web && npm run demo:platform
```

Expected: `inc-plat-003`, latency above the allowed threshold, verify result no material change / follow-up. Do not describe this as improved.

http://127.0.0.1:3000/incidents?incident=inc-plat-003

## 60-second narration

Fleetrac watches runtime telemetry from governed AI agents. When a control threshold is crossed, it opens one evidence-backed risk instead of one incident per event. Risk Detail shows the breached metric, the evidence, and the next governed action. That action stays approval-gated. After approval, verification compares later telemetry with the breach. Outcomes keeps the audit record: improved, rollback candidate, or follow-up.

## 5-minute narration

1. Overview — the worklist is risks that need a decision, not a log dump. Open Risk Queue.
2. Runtime Monitor — healthy rows stay below threshold. A linked row names the risk.
3. Trigger the Treasury pitch. Refresh Risk Queue. Open `inc-mrm-001`.
4. Read the control breach: observed value versus the allowed threshold, then the evidence list.
5. Open the governed action. Approve it. The lane moves to ready to verify.
6. Verify impact. The result is improvement observed, not an automatic fix.
7. Open Outcomes. The same result is there as audit evidence.
8. If time remains, open `inc-sec-001` (rollback path) and `inc-plat-003` (follow-up, not improvement).

## Pages

| URL | Job |
|-----|-----|
| `/` | Summarize the loop |
| `/systems` | Five demo agents |
| `/live-signals` | Telemetry |
| `/incidents` | Risk worklist |
| `/actions` | Approve and verify |
| `/outcomes` | Audit |
| `/settings` | Prototype connector configuration |

Redirects: `/bob` and `/activity` go to `/`. `/controls` goes to `/systems`. `/usage` goes to `/`.

## If the demo looks messy

1. `npm run demo:stop`
2. `npm run demo:reset`
3. Run one pitch (`demo:treasury`, `demo:phishing`, or `demo:platform`)
4. Hard-refresh the Risk Queue
5. Open the flagship URL directly
6. If verify has no later sample, the API records a story fallback and says so in the summary. You can also post an explicit outcome:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/governance/actions/<action_id>/verify \
  -H 'Content-Type: application/json' \
  -d '{"outcome":"improvement_observed","summary":"Operator confirmed the monitoring window."}'
```

Use `rollback_candidate` or `no_material_change` for the other two stories.

Reset clears runtime rows only. It does not delete the fleet registry or scenario definitions. After reset, flagship evidence returns 404 until a pitch runs. That is expected.
