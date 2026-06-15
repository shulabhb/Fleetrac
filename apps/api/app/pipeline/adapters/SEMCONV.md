# Fleetrac telemetry semantic conventions

## source_type and schema_version

- **`source_type`:** always `otel_agent_trace` for agent traces (flat v1 or nested v2 bundles).
- **`schema_version`:** `1.0` = flat per-span envelope; `2.0` = nested trace bundle (resource, scope, spans[]).

## GenAI attributes (allowlist)

Only attributes in `genai_semconv.py` → `ALLOWED_GEN_AI_ATTRIBUTES` may use the `gen_ai.*` or listed `server.*` namespace. Do not invent experimental `gen_ai.*` fields.

## Fleetrac extensions (`fleetrac.*`)

Use for evaluations, governance metadata, policy results, scenarios, business outcomes, and simulator span events:

| Attribute | Purpose |
|-----------|---------|
| `fleetrac.system.id` | Canonical governed system ID |
| `fleetrac.system.archetype` | Agent archetype |
| `fleetrac.tenant.id` | Tenant |
| `fleetrac.data_sensitivity` | Data classification |
| `fleetrac.owner_team` | Accountable owner (system registry) |
| `fleetrac.control.id` | Control reference |
| `fleetrac.policy.result` | Policy engine outcome |
| `fleetrac.evaluation.grounding_score` | Grounding evaluation |
| `fleetrac.evaluation.unsupported_claim_rate` | Unsupported claim rate |
| `fleetrac.evaluation.retrieval_confidence` | Retrieval confidence |
| `fleetrac.citation.fallback_enabled` | Citation fallback flag |
| `fleetrac.tool.approved` | Tool approval state |
| `fleetrac.business_outcome.type` | Business outcome type |
| `fleetrac.business_outcome.status` | Business outcome status |
| `fleetrac.scenario.id` | Scenario identifier |
| `fleetrac.scenario.run_id` | Deterministic scenario run |
| `fleetrac.content_mode` | metadata_only / redacted / evidence_reference |
| `fleetrac.payload_hash` | Integrity hash |

## Span events

Use only names in `ALLOWED_FLEETRAC_SPAN_EVENTS` (`genai_semconv.py`).

## Healthy normalized events

- `signal_state = healthy`
- `severity = null`
- `confidence = null`

Severity and confidence apply only to warning or incident-producing governance signals.
