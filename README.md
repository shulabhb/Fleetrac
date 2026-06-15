# Fleetrac

Fleetrac is an observability-driven governance control plane for production AI systems. This monorepo contains a Next.js operator UI and a FastAPI backend with a multi-system OTEL simulator, ingest pipeline, detection, and governance read APIs.

**Workflow loop:** Observe → Investigate → Act → Measure

## Monorepo layout

| Path | Role |
|------|------|
| `apps/web` | Next.js (App Router) — Live Signals, Incident Queue, Evidence Library, Action Center, Outcomes |
| `apps/api` | FastAPI — OTEL ingest, simulator, normalization, detection, governance APIs |
| `packages/shared` | Shared entity contracts for frontend/backend alignment |
| `AGENTS.md` | Contributor context, IA rules, pitch scenarios, routing conventions |

## Getting started

### Prerequisites

- Node.js 20+
- Python 3.11+

### Backend (start first)

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

Simulator and pipeline details: **[apps/api/README.md](apps/api/README.md)**

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The web app reads governance data from `http://localhost:8000` by default.

## OTEL simulation (dev)

Ten simulated agent systems generate **schema 2.0** trace bundles (realistic timing, scoped metrics, sparse events) and post them to `POST /api/v1/ingest/events`. The same path will accept production OTEL later.

**Quick validation after API start:**

To start the simulator:

curl -s -X POST http://localhost:8000/api/v1/simulator/start -H 'Content-Type: application/json' -d '{"mode":"continuous","rate_eps":5,"seed":42}' && sleep 2 && curl -s 


```bash
curl http://localhost:8000/api/v1/simulator/status
# "trace_builder_revision": "2026.06.2-timing-scoped"  →  current simulator code

curl -X POST http://localhost:8000/api/v1/simulator/reset
curl -X POST http://localhost:8000/api/v1/simulator/runs \
  -H 'Content-Type: application/json' \
  -d '{"count":1,"seed":99,"systems":["sys-agt-treasury-001"]}'
```

Then open **Live Signals → View raw simulated logs** in the UI, or:

```bash
curl 'http://localhost:8000/api/v1/governance/ingest-log?limit=1'
```

A healthy M40 trace should show `spans=11`, `events≥1`, `logs=1`, `total≈900ms` — not `total=20ms` with metrics copied onto every span.

**Pitch scenarios** (E2E governance loop):

```bash
curl -X POST http://localhost:8000/api/v1/simulator/pitch/treasury_unsupported_claim   # inc-mrm-001
curl -X POST http://localhost:8000/api/v1/simulator/pitch/security_tool_scope         # inc-sec-001
curl -X POST http://localhost:8000/api/v1/simulator/pitch/cs_latency_regression       # inc-plat-003
```

## Tests

```bash
cd apps/api && pytest tests/ -v
cd apps/web && npm run build
```

## Further reading

- [apps/api/README.md](apps/api/README.md) — Simulator API, pipeline, troubleshooting (stale workers, port conflicts)
- [AGENTS.md](AGENTS.md) — Product guardrails, terminology, route builders, demo architecture
