from __future__ import annotations

import hashlib
import uuid
from datetime import datetime
from typing import Any

from app.schemas.fleetrac_event import FleetracEvent
from app.simulator.system_profiles import normalized_model_name
from app.slice_a.constants import OWNER_TEAM, SIGNAL_TYPE, SYSTEM_ID


def _parse_ts(value: str) -> datetime:
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value)


def correlation_key_for(
    system_id: str,
    signal_type: str,
    environment: str = "production",
    rule_id: str = "general",
) -> str:
    return f"{system_id}:{signal_type}:{environment}:{rule_id}"


def normalize_adapted(
    adapted: dict[str, Any],
    *,
    raw_event_id: str,
    system_owner_team: str | None = None,
    applicable_control_ids: list[str] | None = None,
    forced_signal_type: str | None = None,
    forced_severity: str | None = None,
) -> FleetracEvent:
    evaluation = adapted.get("evaluation_signals") or {}
    unsupported_rate = float(evaluation.get("unsupported_claim_rate", 0.0))
    grounding = float(evaluation.get("grounding_score", 1.0))

    signal_type = forced_signal_type
    severity: str = forced_severity or "low"
    confidence = 0.5

    if signal_type is None:
        if unsupported_rate > 0.02:
            signal_type = SIGNAL_TYPE
            severity = "critical"
            confidence = min(0.99, 0.5 + unsupported_rate)
        elif grounding < 0.7:
            signal_type = "retrieval_confidence_degraded"
            severity = "medium"
            confidence = 0.7
        elif evaluation.get("missing_citation_fallback"):
            signal_type = "missing_citation_fallback"
            severity = "high"
            confidence = 0.75
        elif adapted.get("operation_type") == "output_evaluation":
            signal_type = "output_evaluation"
            severity = "low"
            confidence = 0.6

    if signal_type == SIGNAL_TYPE:
        severity = "critical"
        confidence = min(0.99, 0.5 + unsupported_rate)

    env = adapted.get("environment", "production")
    if env not in ("staging", "production"):
        env = "production"

    content_mode = adapted.get("content_mode", "metadata_only")
    if content_mode not in ("metadata_only", "redacted", "evidence_reference"):
        content_mode = "metadata_only"

    event_id = str(uuid.uuid4())
    payload_hash = adapted.get("payload_hash")
    if not payload_hash:
        digest = hashlib.sha256(f"{raw_event_id}:{adapted.get('span_id')}".encode()).hexdigest()
        payload_hash = f"sha256:{digest[:16]}"

    system_id = adapted.get("system_id") or SYSTEM_ID
    model_label = normalized_model_name(system_id)
    if adapted.get("model"):
        evaluation = dict(evaluation)
        evaluation.setdefault("invocation_model", adapted.get("model"))

    return FleetracEvent(
        event_id=event_id,
        timestamp=_parse_ts(adapted["timestamp"]),
        tenant_id=adapted["tenant_id"],
        environment=env,  # type: ignore[arg-type]
        source_provider=adapted["source_provider"],
        source_service=adapted["source_service"],
        source_type=adapted["source_type"],
        system_id=system_id,
        trace_id=adapted.get("trace_id"),
        span_id=adapted.get("span_id"),
        operation_type=adapted["operation_type"],
        model=model_label,
        tool=adapted.get("tool"),
        latency_ms=adapted.get("latency_ms"),
        evaluation_signals=evaluation,
        policy_result=adapted.get("policy_result"),
        normalized_signal_type=signal_type,
        severity=severity,  # type: ignore[arg-type]
        confidence=confidence,
        evidence_reference=None,
        raw_payload_reference=raw_event_id,
        owner_team=system_owner_team or OWNER_TEAM,
        applicable_control_ids=applicable_control_ids or [],
        correlation_key=correlation_key_for(
            system_id,
            signal_type or "general",
            env,
        ),
        content_mode=content_mode,  # type: ignore[arg-type]
        payload_hash=payload_hash,
    )
