# Fleetrac API

FastAPI backend for the governance control plane: OTEL ingest, normalization, detection, incidents, evidence, and read APIs consumed by `apps/web`.

Local development uses **SQLite** (`data/fleetrac_sim.db`) as the runtime store. The **multi-system OTEL simulator** generates realistic v2 trace bundles and posts them through the same HTTP ingest boundary as production telemetry would.

## Quick start

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Open [http://localhost:8000/docs](http://localhost:8000/docs).

Frontend (`apps/web`) expects `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` (default).

## OTEL simulator overview

| Item | Detail |
|------|--------|
| Systems | 10 fleet agents (Treasury M40, CS A12, Phish, PEP, Refund, Invoice, RAG, KYC, Access, Regulatory) |
| Archetypes | `retrieval_grounded`, `decision`, `document`, `security_operations` |
| Output | `schema_version: "2.0"` bundles with 7–11 spans, sparse span events, one trace log |
| Ingest | Always `POST /api/v1/ingest/events` (HTTP loopback in dev) |
| Code | `app/simulator/` |

### Trace realism (current behavior)

- **Timing** — Child spans fit inside parents; root `agent.request` end covers the full trace (~900ms for M40, not 20ms).
- **Scoped metrics** — Evaluation attributes only on semantically relevant spans (e.g. `grounding_score` on `evaluate.grounding`, not on `query.generate`).
- **Domain span names** — Per-system overrides in `span_templates.py` (e.g. CS uses `request.ingest`, `intent.classify`, `route.select`; Phish uses `quarantine.route`).
- **Events / logs** — Healthy traces: 1–5 span events + 1 trace-level log per bundle.
- **Healthy normalization** — `normalized_signal_type = null`, `severity = null`, `confidence = null` (neutral, not `healthy_runtime_activity`).
- **Latency semantics** — `span_duration_ms` = wall-clock from timestamps; `operation_latency_ms` = provider/model latency for detection rules. Root duration does **not** drive latency detection.

Confirm the running API matches current code:

```bash
curl http://localhost:8000/api/v1/simulator/status
# expect: "trace_builder_revision": "2026.06.2-timing-scoped"
```

## Simulator API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/simulator/status` | Running state, event count, **trace_builder_revision** |
| `POST /api/v1/simulator/reset` | Stop runner, truncate runtime tables, re-seed config |
| `POST /api/v1/simulator/stop` | Stop continuous background runner |
| `POST /api/v1/simulator/start` | Start continuous healthy traffic (requires JSON body) |
| `POST /api/v1/simulator/runs` | Post N healthy trace bundles (batch) |
| `POST /api/v1/simulator/scenarios/{id}` | Run one pitch scenario |
| `GET /api/v1/simulator/scenarios` | Implemented vs planned scenario catalog |
| `POST /api/v1/simulator/pitch/{pitch_id}` | Multi-step pitch sequence |

### Common commands

**Reset and verify revision**

```bash
curl -X POST http://localhost:8000/api/v1/simulator/stop
curl -X POST http://localhost:8000/api/v1/simulator/reset
curl http://localhost:8000/api/v1/simulator/status
```

**Single healthy Treasury (M40) trace**

```bash
curl -X POST http://localhost:8000/api/v1/simulator/runs \
  -H 'Content-Type: application/json' \
  -d '{"count":1,"seed":99,"systems":["sys-agt-treasury-001"]}'
```

Expect ingest-log: `spans=11`, `events≥1`, `logs=1`, `total≈900ms`.

**Continuous healthy traffic (all 10 systems)**

```bash
curl -X POST http://localhost:8000/api/v1/simulator/start \
  -H 'Content-Type: application/json' \
  -d '{"mode":"continuous","rate_eps":5,"seed":42}'
```

**E2E pitch scenarios** (unsupported claim, tool scope, latency regression)

```bash
curl -X POST http://localhost:8000/api/v1/simulator/reset
curl -X POST http://localhost:8000/api/v1/simulator/pitch/treasury_unsupported_claim
curl -X POST http://localhost:8000/api/v1/simulator/pitch/security_tool_scope
curl -X POST http://localhost:8000/api/v1/simulator/pitch/cs_latency_regression
```

| Pitch | System | Incident alias | Responder |
|-------|--------|----------------|-----------|
| `treasury_unsupported_claim` | `sys-agt-treasury-001` (M40) | `inc-mrm-001` | Model Risk Management |
| `security_tool_scope` | `sys-agt-phish-008` | `inc-sec-001` | Security Operations |
| `cs_latency_regression` | `sys-agt-cs-002` (A12) | `inc-plat-003` | Platform Reliability |

### Inspect persisted telemetry

```bash
# Latest raw bundle (spans, events, logs, timing)
curl 'http://localhost:8000/api/v1/governance/ingest-log?limit=1'

# Governed signals (abnormal spans only in flat list; trace groups expand children)
curl 'http://localhost:8000/api/v1/governance/live-signals?limit=20'
```

In the UI: **Live Signals** → **View raw simulated logs** for the hierarchical console (parent offsets, scoped attrs, `signal=neutral` for healthy spans).

## Pipeline path

```
Simulator (healthy_trace_bundle)
  → POST /api/v1/ingest/events
  → validate (v2 bundle)
  → raw_events (one row per bundle)
  → fan-out normalized_events (one row per span)
  → detection + correlator
  → incidents + evidence + SSE
  → GET /api/v1/governance/*
```

Key modules:

| Path | Role |
|------|------|
| `app/simulator/span_templates.py` | Per-system span topology, timing offsets, scoped `evaluation_key` |
| `app/simulator/trace_builder.py` | Span assembly, root duration finalization, `TRACE_BUILDER_REVISION` |
| `app/simulator/telemetry/serializer.py` | `SimulatedTrace` → v2 JSON bundle |
| `app/pipeline/adapters/otel_agent.py` | Span → adapted dict (`span_duration_ms`, `operation_latency_ms`) |
| `app/pipeline/normalizer.py` | Adapted → `FleetracEvent` |
| `app/services/ingest_pipeline.py` | Persist raw + normalized, run detection |
| `app/detection/engine.py` | Rule evaluation (latency uses `operation_latency_ms`) |

## Tests

```bash
cd apps/api
pytest tests/ -v

# Critical E2E pitch scenarios
pytest tests/e2e/test_treasury_unsupported_claim_e2e.py -v
pytest tests/e2e/test_phish_tool_scope_e2e.py -v
pytest tests/e2e/test_cs_latency_retry_e2e.py -v

# Mapping / negative / latency semantics
pytest tests/test_normalization_mappings.py tests/test_normalization_negative.py tests/test_latency_semantics.py -v
```

## Troubleshooting

### Port 8000 already in use

On macOS, `lsof -ti :8000,:8001` is invalid. Use:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
lsof -tiTCP:8000 -sTCP:LISTEN | xargs kill -9
```

Then restart uvicorn from `apps/api` (not repo root).

### Stale simulator output in the UI

Symptoms: `total=20ms`, metrics on every span, `events=0`, `healthy_runtime_activity` in normalized rows.

1. Check `trace_builder_revision` on `/simulator/status`.
2. Kill all uvicorn processes on 8000; restart from `apps/api`.
3. `POST /simulator/stop` then `POST /simulator/reset`.
4. Post one fresh M40 run and inspect `ingest-log?limit=1`.

### Development auto-start

In `app_env=development`, the API lifespan may start continuous simulation on boot. Use `POST /simulator/stop` after reset if you want manual-only traces.

## Configuration

| Setting | Default | Notes |
|---------|---------|-------|
| `DATABASE_URL` | `sqlite:///./data/fleetrac_sim.db` | Runtime governance data |
| `SIMULATOR_API_BASE_URL` | `http://127.0.0.1:8000` | Loopback ingest target for runner |
| `APP_ENV` | `development` | Controls lifespan continuous sim |

See `app/core/config.py` and `.env` for overrides.
