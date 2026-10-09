# Final demo checklist

Use this before an advisor, design-partner, or investor walkthrough. Commands assume the API is on port 8000 and the web app is on port 3000.

## Setup

```bash
cd apps/api && uvicorn main:app --reload --host 127.0.0.1 --port 8000
cd apps/web && npm run dev
```

Open http://127.0.0.1:3000

Health check:

```bash
python3 scripts/demo_health_check.py
```

Narrative and screenshot order also live in `docs/demo/flagship-walkthrough.md`.

## Reset

Clears telemetry, risks, evidence, governed actions, and verification outcomes. Keeps the fleet registry, rules, and scenario stories.

```bash
cd apps/web && npm run demo:reset
```

After reset, flagship evidence returns 404 until a pitch runs. That is expected.

The sidebar **Reset workspace** control clears this browser session and calls the same runtime reset.

## Scenario commands

From `apps/web`:

| Command | Expected |
|---------|----------|
| `npm run demo:baseline` | Runtime Monitor shows telemetry. No new risk from healthy spans. |
| `npm run demo:stop` | Generation stops. |
| `npm run demo:treasury` | `inc-mrm-001` — unsupported-claim breach. After approve and verify: improvement observed. |
| `npm run demo:phishing` | `inc-sec-001` — tool-scope breach. Verify: rollback candidate. |
| `npm run demo:platform` | `inc-plat-003` — latency breach. Verify: no material change / follow-up required. |

Approve and verify in Action Center. A verify call with no later sample is labeled as a story fallback in the summary.

## Route checklist

| URL | Expect |
|-----|--------|
| `/` | Governance Insights. Counts match the demo-agent Risk Queue. |
| `/systems` | Agent Fleet. Five demo agents. |
| `/live-signals` | Runtime Monitor. Healthy rows say below threshold. Breaches name a linked risk. |
| `/incidents` | Risk Queue. |
| `/incidents?incident=inc-mrm-001` | Treasury risk detail stays selected. |
| `/incidents?incident=inc-sec-001` | Phishing risk detail. |
| `/incidents?incident=inc-plat-003` | Platform risk detail. |
| `/actions` | Action Center. One primary action per risk. |
| `/outcomes` | Outcomes Audit. |
| `/settings` | Connector records, not live production integrations. |
| `/bob`, `/activity` | Redirect to `/`. |
| `/controls` | Redirect to `/systems`. |
| `/usage` | Redirect to `/`. |

## Expected flagship outcomes

| Alias | Verification outcome | Action Center next step |
|-------|----------------------|-------------------------|
| inc-mrm-001 | Improvement observed | View outcome evidence |
| inc-sec-001 | Rollback candidate | Review rollback path |
| inc-plat-003 | No material change | Review follow-up |

## Screenshot views

1. **Governance Insights** — `/` after the three pitches. Show governed agents, active risks, and the selected highest-severity agent.
2. **Risk Detail** — `/incidents?incident=inc-mrm-001`. Show the control breach sentence, evidence, and governed action.
3. **Action Center, ready to verify** — approve one action and stay on Ready to verify before recording a result. If you already verified, use Verification results instead.
4. **Outcomes Audit** — `/outcomes` with a verification result visible.
5. **Runtime Monitor** — `/live-signals` with a row that says `Linked risk: inc-mrm-001` and a healthy row that says below threshold.

## If the walkthrough looks wrong

1. `npm run demo:stop`
2. `npm run demo:reset`
3. Run one pitch, then hard-refresh.
4. Open the flagship URL directly.
5. If verify has no post-action sample, the summary says “Story fallback”. You can still record an explicit outcome:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/governance/actions/<action_id>/verify \
  -H 'Content-Type: application/json' \
  -d '{"outcome":"improvement_observed","summary":"Operator confirmed the monitoring window."}'
```

Use `rollback_candidate` or `no_material_change` for the other two stories.
