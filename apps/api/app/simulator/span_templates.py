"""Span topology templates — timing offsets, scoped attributes, per-system overrides."""

from __future__ import annotations

import copy
from typing import Any

from app.fleet.registry import FleetSystem

NS_PER_MS = 1_000_000


def _dur(value: float | tuple[str, float, float]) -> float | tuple[str, float, float]:
    return value


def _resolve_duration(spec: dict[str, Any], rng) -> float:
    raw = spec.get("duration_ms")
    if raw is None:
        return rng.uniform(40, 200)
    if isinstance(raw, tuple) and raw[0] == "uniform":
        return rng.uniform(raw[1], raw[2])
    return float(raw)


def resolve_span_specs(system_id: str, archetype: str, system: FleetSystem, rng) -> list[dict]:
    template = SYSTEM_SPAN_TEMPLATES.get(system_id) or ARCHETYPE_SPAN_TEMPLATES[archetype]
    return [copy.deepcopy(spec) for spec in template]


# --- Archetype defaults (timing-valid, parent-contained) ---

RETRIEVAL_GROUNDED_TEMPLATE: list[dict[str, Any]] = [
    {"name": "agent.request", "kind": "SERVER", "operation": "agent.request", "parent_index": None, "start_offset_ms": 0, "duration_ms": 20},
    {"name": "query.generate", "kind": "INTERNAL", "operation": "query.generate", "parent_index": 0, "start_offset_ms": 20, "duration_ms": 40},
    {"name": "retrieve.context", "kind": "INTERNAL", "operation": "retrieval", "parent_index": 0, "start_offset_ms": 70, "duration_ms": 210, "evaluation_key": "retrieval"},
    {"name": "vector.search", "kind": "CLIENT", "operation": "retrieval", "parent_index": 2, "start_offset_ms": 85, "duration_ms": ("uniform", 100, 125)},
    {"name": "rerank.results", "kind": "CLIENT", "operation": "retrieval", "parent_index": 2, "start_offset_ms": 215, "duration_ms": 50},
    {"name": "model.generate", "kind": "CLIENT", "operation": "model_call", "parent_index": 0, "start_offset_ms": 300, "duration_ms": ("uniform", 420, 460), "evaluation_key": "model_call", "attributes": {"gen_ai.request.model": "approved"}},
    {"name": "evaluate.output", "kind": "INTERNAL", "operation": "output_evaluation", "parent_index": 0, "start_offset_ms": 770, "duration_ms": 110},
    {
        "name": "evaluate.grounding",
        "kind": "INTERNAL",
        "operation": "output_evaluation",
        "parent_index": 6,
        "start_offset_ms": 775,
        "duration_ms": 40,
        "evaluation_key": "grounding",
    },
    {
        "name": "evaluate.unsupported_claims",
        "kind": "INTERNAL",
        "operation": "output_evaluation",
        "parent_index": 6,
        "start_offset_ms": 820,
        "duration_ms": 35,
        "evaluation_key": "unsupported_claims",
    },
    {
        "name": "verify.citations",
        "kind": "INTERNAL",
        "operation": "policy_eval",
        "parent_index": 6,
        "start_offset_ms": 860,
        "duration_ms": 15,
        "attributes": {"fleetrac.citation.verified": True},
    },
    {
        "name": "business.outcome",
        "kind": "INTERNAL",
        "operation": "business.outcome",
        "parent_index": 0,
        "start_offset_ms": 890,
        "duration_ms": 25,
        "attributes": {"fleetrac.business_outcome.status": "published"},
    },
]

DECISION_TEMPLATE: list[dict[str, Any]] = [
    {"name": "agent.request", "kind": "SERVER", "operation": "agent.request", "parent_index": None, "start_offset_ms": 0, "duration_ms": 20},
    {"name": "input.classify", "kind": "INTERNAL", "operation": "input.classify", "parent_index": 0, "start_offset_ms": 20, "duration_ms": 45},
    {"name": "identity.lookup", "kind": "CLIENT", "operation": "identity.lookup", "parent_index": 0, "start_offset_ms": 75, "duration_ms": 80},
    {"name": "policy.lookup", "kind": "INTERNAL", "operation": "policy.lookup", "parent_index": 0, "start_offset_ms": 165, "duration_ms": 35},
    {
        "name": "model.reasoning",
        "kind": "CLIENT",
        "operation": "model_call",
        "parent_index": 0,
        "start_offset_ms": 210,
        "duration_ms": ("uniform", 200, 400),
        "evaluation_key": "model_call",
        "attributes": {"gen_ai.request.model": "approved"},
    },
    {"name": "risk.evaluate", "kind": "INTERNAL", "operation": "risk.evaluate", "parent_index": 0, "start_offset_ms": 620, "duration_ms": 50},
    {
        "name": "business.outcome",
        "kind": "INTERNAL",
        "operation": "business.outcome",
        "parent_index": 0,
        "start_offset_ms": 680,
        "duration_ms": 20,
        "attributes": {"fleetrac.business_outcome.status": "completed"},
    },
]

DOCUMENT_TEMPLATE: list[dict[str, Any]] = [
    {"name": "agent.request", "kind": "SERVER", "operation": "agent.request", "parent_index": None, "start_offset_ms": 0, "duration_ms": 20},
    {"name": "file.ingest", "kind": "INTERNAL", "operation": "file.ingest", "parent_index": 0, "start_offset_ms": 20, "duration_ms": 55},
    {"name": "format.validate", "kind": "INTERNAL", "operation": "format.validate", "parent_index": 0, "start_offset_ms": 85, "duration_ms": 40},
    {
        "name": "ocr.extract",
        "kind": "CLIENT",
        "operation": "model_call",
        "parent_index": 0,
        "start_offset_ms": 135,
        "duration_ms": ("uniform", 200, 350),
        "evaluation_key": "ocr",
    },
    {
        "name": "field.validate",
        "kind": "INTERNAL",
        "operation": "field.validate",
        "parent_index": 0,
        "start_offset_ms": 500,
        "duration_ms": 45,
        "evaluation_key": "field_validation",
    },
    {
        "name": "model.review",
        "kind": "CLIENT",
        "operation": "model_call",
        "parent_index": 0,
        "start_offset_ms": 555,
        "duration_ms": ("uniform", 150, 280),
        "evaluation_key": "model_call",
        "attributes": {"gen_ai.request.model": "approved"},
    },
    {
        "name": "business.outcome",
        "kind": "INTERNAL",
        "operation": "business.outcome",
        "parent_index": 0,
        "start_offset_ms": 850,
        "duration_ms": 20,
        "attributes": {"fleetrac.business_outcome.status": "written"},
    },
]

SECURITY_OPS_TEMPLATE: list[dict[str, Any]] = [
    {"name": "agent.request", "kind": "SERVER", "operation": "agent.request", "parent_index": None, "start_offset_ms": 0, "duration_ms": 20},
    {"name": "message.ingest", "kind": "INTERNAL", "operation": "message.ingest", "parent_index": 0, "start_offset_ms": 20, "duration_ms": 35},
    {
        "name": "classify.threat",
        "kind": "INTERNAL",
        "operation": "classification",
        "parent_index": 0,
        "start_offset_ms": 65,
        "duration_ms": 50,
        "evaluation_key": "threat",
    },
    {
        "name": "model.reasoning",
        "kind": "CLIENT",
        "operation": "model_call",
        "parent_index": 0,
        "start_offset_ms": 125,
        "duration_ms": "baseline_latency",
        "evaluation_key": "model_call",
        "attributes": {"gen_ai.request.model": "approved"},
    },
    {
        "name": "policy.evaluate",
        "kind": "INTERNAL",
        "operation": "policy_eval",
        "parent_index": 0,
        "start_offset_ms": 540,
        "duration_ms": 30,
        "policy_result": "allow",
    },
    {
        "name": "tool.route",
        "kind": "CLIENT",
        "operation": "tool_call",
        "parent_index": 0,
        "start_offset_ms": 580,
        "duration_ms": 40,
        "attributes": {"gen_ai.tool.name": "route_queue", "fleetrac.tool.approved": True},
    },
    {
        "name": "business.outcome",
        "kind": "INTERNAL",
        "operation": "business.outcome",
        "parent_index": 0,
        "start_offset_ms": 630,
        "duration_ms": 15,
        "attributes": {"fleetrac.business_outcome.status": "routed"},
    },
]

ARCHETYPE_SPAN_TEMPLATES: dict[str, list[dict[str, Any]]] = {
    "retrieval_grounded": RETRIEVAL_GROUNDED_TEMPLATE,
    "decision": DECISION_TEMPLATE,
    "document": DOCUMENT_TEMPLATE,
    "security_operations": SECURITY_OPS_TEMPLATE,
}

# --- Per-system overrides ---

SYSTEM_SPAN_TEMPLATES: dict[str, list[dict[str, Any]]] = {
    "sys-agt-cs-002": [
        {"name": "agent.request", "kind": "SERVER", "operation": "agent.request", "parent_index": None, "start_offset_ms": 0, "duration_ms": 20},
        {"name": "request.ingest", "kind": "INTERNAL", "operation": "message.ingest", "parent_index": 0, "start_offset_ms": 20, "duration_ms": 35},
        {"name": "intent.classify", "kind": "INTERNAL", "operation": "classification", "parent_index": 0, "start_offset_ms": 65, "duration_ms": 45},
        {"name": "customer.lookup", "kind": "CLIENT", "operation": "identity.lookup", "parent_index": 0, "start_offset_ms": 120, "duration_ms": 70},
        {"name": "routing_policy.evaluate", "kind": "INTERNAL", "operation": "policy_eval", "parent_index": 0, "start_offset_ms": 200, "duration_ms": 35, "policy_result": "allow"},
        {
            "name": "model.reasoning",
            "kind": "CLIENT",
            "operation": "model_call",
            "parent_index": 0,
            "start_offset_ms": 245,
            "duration_ms": "baseline_latency",
            "evaluation_key": "model_call",
            "attributes": {"gen_ai.request.model": "gpt-4o"},
        },
        {
            "name": "route.select",
            "kind": "CLIENT",
            "operation": "tool_call",
            "parent_index": 0,
            "start_offset_ms": 660,
            "duration_ms": 40,
            "attributes": {"gen_ai.tool.name": "route_queue", "fleetrac.tool.approved": True},
        },
        {"name": "queue.assign", "kind": "INTERNAL", "operation": "tool_call", "parent_index": 0, "start_offset_ms": 710, "duration_ms": 30},
        {
            "name": "business.outcome",
            "kind": "INTERNAL",
            "operation": "business.outcome",
            "parent_index": 0,
            "start_offset_ms": 750,
            "duration_ms": 20,
            "attributes": {"fleetrac.business_outcome.status": "queued"},
        },
    ],
    "sys-agt-phish-008": [
        {"name": "agent.request", "kind": "SERVER", "operation": "agent.request", "parent_index": None, "start_offset_ms": 0, "duration_ms": 20},
        {"name": "message.ingest", "kind": "INTERNAL", "operation": "message.ingest", "parent_index": 0, "start_offset_ms": 20, "duration_ms": 30},
        {"name": "attachment.extract", "kind": "INTERNAL", "operation": "file.ingest", "parent_index": 0, "start_offset_ms": 58, "duration_ms": 45},
        {"name": "url.extract", "kind": "INTERNAL", "operation": "file.ingest", "parent_index": 0, "start_offset_ms": 110, "duration_ms": 35},
        {
            "name": "classify.threat",
            "kind": "INTERNAL",
            "operation": "classification",
            "parent_index": 0,
            "start_offset_ms": 155,
            "duration_ms": 50,
            "evaluation_key": "threat",
        },
        {"name": "threat_intel.lookup", "kind": "CLIENT", "operation": "retrieval", "parent_index": 0, "start_offset_ms": 215, "duration_ms": 80},
        {"name": "policy.evaluate", "kind": "INTERNAL", "operation": "policy_eval", "parent_index": 0, "start_offset_ms": 305, "duration_ms": 30, "policy_result": "allow"},
        {
            "name": "quarantine.route",
            "kind": "CLIENT",
            "operation": "tool_call",
            "parent_index": 0,
            "start_offset_ms": 345,
            "duration_ms": 40,
            "attributes": {"gen_ai.tool.name": "quarantine_route", "fleetrac.tool.approved": True},
        },
        {"name": "escalation.evaluate", "kind": "INTERNAL", "operation": "risk.evaluate", "parent_index": 0, "start_offset_ms": 395, "duration_ms": 35},
        {
            "name": "business.outcome",
            "kind": "INTERNAL",
            "operation": "business.outcome",
            "parent_index": 0,
            "start_offset_ms": 440,
            "duration_ms": 15,
            "attributes": {"fleetrac.business_outcome.status": "quarantined"},
        },
    ],
    "sys-agt-pep-003": [
        {"name": "agent.request", "kind": "SERVER", "operation": "agent.request", "parent_index": None, "start_offset_ms": 0, "duration_ms": 20},
        {"name": "identity.normalize", "kind": "INTERNAL", "operation": "identity.lookup", "parent_index": 0, "start_offset_ms": 20, "duration_ms": 40},
        {"name": "entity.extract", "kind": "INTERNAL", "operation": "input.classify", "parent_index": 0, "start_offset_ms": 68, "duration_ms": 45},
        {"name": "watchlist.retrieve", "kind": "CLIENT", "operation": "retrieval", "parent_index": 0, "start_offset_ms": 120, "duration_ms": 90},
        {"name": "candidate.match", "kind": "INTERNAL", "operation": "retrieval", "parent_index": 0, "start_offset_ms": 220, "duration_ms": 55},
        {"name": "match.score", "kind": "INTERNAL", "operation": "risk.evaluate", "parent_index": 0, "start_offset_ms": 285, "duration_ms": 40},
        {"name": "policy.evaluate", "kind": "INTERNAL", "operation": "policy_eval", "parent_index": 0, "start_offset_ms": 335, "duration_ms": 30, "policy_result": "allow"},
        {"name": "reviewer.escalate", "kind": "INTERNAL", "operation": "risk.evaluate", "parent_index": 0, "start_offset_ms": 375, "duration_ms": 35},
        {
            "name": "model.reasoning",
            "kind": "CLIENT",
            "operation": "model_call",
            "parent_index": 0,
            "start_offset_ms": 420,
            "duration_ms": ("uniform", 180, 320),
            "evaluation_key": "model_call",
            "attributes": {"gen_ai.request.model": "gemini-1.5-pro"},
        },
        {
            "name": "business.outcome",
            "kind": "INTERNAL",
            "operation": "business.outcome",
            "parent_index": 0,
            "start_offset_ms": 760,
            "duration_ms": 20,
            "attributes": {"fleetrac.business_outcome.status": "screened"},
        },
    ],
    "sys-agt-refund-001": [
        {"name": "agent.request", "kind": "SERVER", "operation": "agent.request", "parent_index": None, "start_offset_ms": 0, "duration_ms": 20},
        {"name": "request.classify", "kind": "INTERNAL", "operation": "input.classify", "parent_index": 0, "start_offset_ms": 20, "duration_ms": 40},
        {"name": "customer.lookup", "kind": "CLIENT", "operation": "identity.lookup", "parent_index": 0, "start_offset_ms": 68, "duration_ms": 75},
        {"name": "transaction.lookup", "kind": "CLIENT", "operation": "identity.lookup", "parent_index": 0, "start_offset_ms": 150, "duration_ms": 70},
        {"name": "refund_policy.lookup", "kind": "INTERNAL", "operation": "policy.lookup", "parent_index": 0, "start_offset_ms": 230, "duration_ms": 40},
        {"name": "eligibility.calculate", "kind": "INTERNAL", "operation": "risk.evaluate", "parent_index": 0, "start_offset_ms": 280, "duration_ms": 45},
        {
            "name": "model.reasoning",
            "kind": "CLIENT",
            "operation": "model_call",
            "parent_index": 0,
            "start_offset_ms": 335,
            "duration_ms": ("uniform", 200, 380),
            "evaluation_key": "model_call",
            "attributes": {"gen_ai.request.model": "claude-3-5-sonnet"},
        },
        {"name": "approval_threshold.evaluate", "kind": "INTERNAL", "operation": "policy_eval", "parent_index": 0, "start_offset_ms": 730, "duration_ms": 35, "policy_result": "allow"},
        {
            "name": "refund_tool.prepare",
            "kind": "CLIENT",
            "operation": "tool_call",
            "parent_index": 0,
            "start_offset_ms": 775,
            "duration_ms": 40,
            "attributes": {"gen_ai.tool.name": "refund_execute", "fleetrac.tool.approved": True},
        },
        {"name": "approval.decision", "kind": "INTERNAL", "operation": "risk.evaluate", "parent_index": 0, "start_offset_ms": 825, "duration_ms": 30},
        {
            "name": "business.outcome",
            "kind": "INTERNAL",
            "operation": "business.outcome",
            "parent_index": 0,
            "start_offset_ms": 865,
            "duration_ms": 20,
            "attributes": {"fleetrac.business_outcome.status": "approved"},
        },
    ],
    "sys-agt-access-009": [
        {"name": "agent.request", "kind": "SERVER", "operation": "agent.request", "parent_index": None, "start_offset_ms": 0, "duration_ms": 20},
        {"name": "identity.lookup", "kind": "CLIENT", "operation": "identity.lookup", "parent_index": 0, "start_offset_ms": 20, "duration_ms": 70},
        {"name": "entitlement.retrieve", "kind": "CLIENT", "operation": "retrieval", "parent_index": 0, "start_offset_ms": 100, "duration_ms": 85},
        {"name": "role_policy.lookup", "kind": "INTERNAL", "operation": "policy.lookup", "parent_index": 0, "start_offset_ms": 195, "duration_ms": 40},
        {"name": "privilege.anomaly.evaluate", "kind": "INTERNAL", "operation": "risk.evaluate", "parent_index": 0, "start_offset_ms": 245, "duration_ms": 45},
        {
            "name": "model.reasoning",
            "kind": "CLIENT",
            "operation": "model_call",
            "parent_index": 0,
            "start_offset_ms": 300,
            "duration_ms": ("uniform", 200, 350),
            "evaluation_key": "model_call",
            "attributes": {"gen_ai.request.model": "claude-3-5-sonnet"},
        },
        {
            "name": "access_change.prepare",
            "kind": "CLIENT",
            "operation": "tool_call",
            "parent_index": 0,
            "start_offset_ms": 670,
            "duration_ms": 40,
            "attributes": {"gen_ai.tool.name": "access_change", "fleetrac.tool.approved": True},
        },
        {"name": "approval.decision", "kind": "INTERNAL", "operation": "policy_eval", "parent_index": 0, "start_offset_ms": 720, "duration_ms": 30, "policy_result": "allow"},
        {
            "name": "business.outcome",
            "kind": "INTERNAL",
            "operation": "business.outcome",
            "parent_index": 0,
            "start_offset_ms": 760,
            "duration_ms": 20,
            "attributes": {"fleetrac.business_outcome.status": "reviewed"},
        },
    ],
    "sys-agt-reg-010": [
        {"name": "agent.request", "kind": "SERVER", "operation": "agent.request", "parent_index": None, "start_offset_ms": 0, "duration_ms": 20},
        {"name": "source.poll", "kind": "CLIENT", "operation": "retrieval", "parent_index": 0, "start_offset_ms": 20, "duration_ms": 50},
        {"name": "document.retrieve", "kind": "CLIENT", "operation": "retrieval", "parent_index": 0, "start_offset_ms": 78, "duration_ms": 90},
        {"name": "document.parse", "kind": "INTERNAL", "operation": "file.ingest", "parent_index": 0, "start_offset_ms": 175, "duration_ms": 55},
        {"name": "change.detect", "kind": "INTERNAL", "operation": "classification", "parent_index": 0, "start_offset_ms": 240, "duration_ms": 45},
        {"name": "jurisdiction.classify", "kind": "INTERNAL", "operation": "classification", "parent_index": 0, "start_offset_ms": 295, "duration_ms": 40},
        {
            "name": "model.summarize",
            "kind": "CLIENT",
            "operation": "model_call",
            "parent_index": 0,
            "start_offset_ms": 345,
            "duration_ms": ("uniform", 300, 500),
            "evaluation_key": "model_call",
            "attributes": {"gen_ai.request.model": "gemini-1.5-pro"},
        },
        {
            "name": "citation.verify",
            "kind": "INTERNAL",
            "operation": "policy_eval",
            "parent_index": 0,
            "start_offset_ms": 860,
            "duration_ms": 40,
            "attributes": {"fleetrac.citation.verified": True},
        },
        {"name": "impact.analyze", "kind": "INTERNAL", "operation": "risk.evaluate", "parent_index": 0, "start_offset_ms": 910, "duration_ms": 45},
        {"name": "escalation.evaluate", "kind": "INTERNAL", "operation": "risk.evaluate", "parent_index": 0, "start_offset_ms": 965, "duration_ms": 35},
        {
            "name": "business.outcome",
            "kind": "INTERNAL",
            "operation": "business.outcome",
            "parent_index": 0,
            "start_offset_ms": 1010,
            "duration_ms": 20,
            "attributes": {"fleetrac.business_outcome.status": "assessed"},
        },
    ],
}


def evaluation_for_key(key: str | None, system: FleetSystem) -> dict[str, float]:
    baselines = system.baseline_metrics
    if key == "grounding":
        return {"grounding_score": float(baselines.get("grounding_score", 0.85))}
    if key == "unsupported_claims":
        return {"unsupported_claim_rate": float(baselines.get("unsupported_claim_rate", 0.01))}
    if key == "ocr":
        return {"ocr_confidence": float(baselines.get("ocr_confidence", 0.91))}
    if key == "field_validation":
        return {"field_validation_confidence": float(baselines.get("field_validation_confidence", 0.88))}
    if key == "threat":
        return {"security_anomaly_score": float(baselines.get("security_anomaly_score", 0.12))}
    if key == "model_call":
        return {
            "latency_ms": float(baselines.get("latency_ms", 400)),
            "input_tokens": 1200.0,
            "output_tokens": 180.0,
        }
    if key == "retrieval":
        return {
            "retrieval_latency_ms": float(baselines.get("latency_ms", 200)),
            "document_count": 12.0,
            "retrieval_confidence": 0.92,
            "retrieval_failure_rate": float(baselines.get("retrieval_failure_rate", 0.02)),
        }
    return {}


def resolve_duration_from_spec(spec: dict[str, Any], system: FleetSystem, rng) -> float:
    raw = spec.get("duration_ms")
    if raw == "baseline_latency":
        return float(system.baseline_metrics.get("latency_ms", 400))
    if isinstance(raw, tuple) and raw[0] == "uniform":
        return rng.uniform(raw[1], raw[2])
    if raw is None:
        return rng.uniform(40, 200)
    return float(raw)
