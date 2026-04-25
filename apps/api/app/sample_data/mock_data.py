from __future__ import annotations

import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.sample_data.seed_loader import load_post_go_live_rows
from app.schemas.entities import AuditLogEntry, Incident, Rule, System, TelemetryEvent


@dataclass(frozen=True)
class RuleSpec:
    id: str
    name: str
    category: str
    observed_field: str
    threshold_field: str
    comparator: str
    severity: str
    description: str
    risk_category: str
    owner_team: str
    recommended_action: str


RULE_SPECS: list[RuleSpec] = [
    RuleSpec("rule_drift_high", "Drift Too High", "drift", "drift_index", "expected_drift_score", ">", "high", "Drift index exceeds expected drift score.", "technology risk", "Model Risk Engineering", "Trigger model refresh and run drift root-cause analysis."),
    RuleSpec("rule_latency_high", "Latency Too High", "latency", "latency_p95_ms", "expected_latency_p95_ms", ">", "medium", "Observed p95 latency exceeds expected threshold.", "technology risk", "Platform Reliability", "Tune inference path and increase autoscaling buffer."),
    RuleSpec("rule_grounding_low", "Grounding Below Threshold", "grounding", "grounding_score", "expected_grounding_score", "<", "high", "Observed grounding score is below minimum expected.", "output reliability risk", "LLM Quality Operations", "Tighten retrieval prompts and require citation checks."),
    RuleSpec("rule_unsupported_claims", "Unsupported Claim Rate High", "quality", "unsupported_claim_rate", "expected_unsupported_claim_rate", ">", "high", "Unsupported claim rate is elevated.", "output reliability risk", "Responsible AI Review Board", "Route outputs through stricter guardrails and human approval."),
    RuleSpec("rule_retrieval_failure", "Retrieval Failure Rate High", "retrieval", "retrieval_failure_rate", "expected_retrieval_failure_rate", ">", "medium", "Retrieval failure rate is above allowed level.", "technology risk", "Knowledge Systems Team", "Re-index corpus and validate retrieval connector health."),
    RuleSpec("rule_audit_low", "Audit Coverage Below Minimum", "audit", "audit_coverage_pct", "minimum_required_audit_coverage", "<", "high", "Audit coverage is below required governance minimum.", "governance / compliance risk", "AI Governance Office", "Increase sampled reviews until coverage minimum is restored."),
    RuleSpec("rule_policy_violation", "Policy Violation Rate Elevated", "policy", "policy_violation_rate", "expected_policy_violation_rate", ">", "high", "Policy violation rate is elevated.", "governance / compliance risk", "Policy Compliance Team", "Pause risky workflow variant and review policy controls."),
    RuleSpec("rule_security_anomaly", "Security Anomaly Count Above Zero", "security", "security_anomaly_count", "expected_security_anomaly_count", ">", "high", "Security anomaly count is above zero.", "cyber risk", "Security Operations", "Escalate to SOC and isolate suspicious traffic paths."),
]


def _slugify(text: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else "_" for ch in text).strip("_")


def _to_float(value, default: float | None = None) -> float | None:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _compute_risk_posture(row: dict) -> str:
    risk_flags = 0
    drift = _to_float(row.get("drift_index"), 0) or 0
    expected_drift = _to_float(row.get("expected_drift_score"), 0.12) or 0.12
    if drift > expected_drift:
        risk_flags += 1

    latency = _to_float(row.get("observed_latency_p95_ms"), 0) or 0
    expected_latency = _to_float(row.get("expected_latency_p95_ms"), 250) or 250
    if latency > expected_latency * 1.1:
        risk_flags += 1

    policy = _to_float(row.get("policy_violation_rate"), 0) or 0
    if policy > 0.01:
        risk_flags += 1

    if _to_int(row.get("security_anomaly_count"), 0) > 0:
        risk_flags += 1

    if risk_flags >= 4:
        return "at_risk"
    if risk_flags >= 2:
        return "watch"
    return "healthy"


_HOSTING_ENVIRONMENTS = (
    "AWS us-east-1",
    "AWS us-west-2",
    "Azure eastus2",
    "GCP us-central1",
    "On-prem DC-West",
)
_INTEGRATION_MODES = (
    "SDK",
    "API gateway",
    "Direct proxy",
    "Sidecar agent",
)


def _build_system(row: dict) -> System:
    system_slug = _slugify(f"{row.get('model', 'unknown')}_{row.get('use_case', 'workflow')}")
    sys_id = f"sys_{system_slug}"
    h = abs(hash(sys_id))
    hosting = _HOSTING_ENVIRONMENTS[h % len(_HOSTING_ENVIRONMENTS)]
    integration = _INTEGRATION_MODES[(h // 7) % len(_INTEGRATION_MODES)]
    coverage = 72 + ((h // 13) % 28)
    posture = _compute_risk_posture(row)
    if posture in ("critical", "at_risk"):
        connection = "degraded" if (h % 3) == 0 else "connected"
    elif posture == "watch":
        connection = "stale" if (h % 5) == 0 else "connected"
    else:
        connection = "connected"
    return System(
        id=sys_id,
        name=f"{row.get('model')} - {row.get('use_case')}",
        owner=str(row.get("model_owner", "unknown")),
        environment="production",
        model=str(row.get("model", "unknown")),
        model_type=str(row.get("model_type", "unknown")),
        use_case=str(row.get("use_case", "unknown")),
        telemetry_archetype=str(row.get("telemetry_archetype", "unknown")),
        business_function=str(row.get("business_function", "unknown")),
        deployment_scope=str(row.get("deployment_scope", "unknown")),
        regulatory_sensitivity=str(row.get("regulatory_sensitivity", "unknown")),
        control_owner=str(row.get("control_owner", "unknown")),
        risk_posture=posture,
        hosting_environment=hosting,
        integration_mode=integration,
        telemetry_coverage=float(coverage),
        connection_status=connection,
    )


def _system_expected_metrics(row: dict) -> dict[str, float]:
    return {
        "expected_drift_score": _to_float(row.get("expected_drift_score"), 0.12) or 0.12,
        "expected_latency_p95_ms": _to_float(row.get("expected_latency_p95_ms"), 250) or 250,
        "expected_grounding_score": _to_float(row.get("expected_grounding_score"), 0.85) or 0.85,
        "expected_unsupported_claim_rate": _to_float(row.get("expected_hallucination_rate"), 0.03) or 0.03,
        "expected_retrieval_failure_rate": max(0.01, 1 - (_to_float(row.get("context_retrieval_hit_rate"), 0.95) or 0.95)),
        "minimum_required_audit_coverage": (_to_float(row.get("minimum_required_audit_coverage"), 0.9) or 0.9) * 100,
        "expected_policy_violation_rate": 0.01,
        "expected_security_anomaly_count": 0,
        "expected_accuracy": _to_float(row.get("expected_accuracy"), 90) or 90,
        "expected_error_rate": _to_float(row.get("expected_error_rate"), 10) or 10,
        "expected_cost_per_1k_requests": _to_float(row.get("expected_cost_per_1k_requests"), 1000) or 1000,
    }


def _base_observed_metrics(row: dict) -> dict[str, float]:
    return {
        "accuracy_pct": _to_float(row.get("accuracy_pct"), 90) or 90,
        "error_pct": _to_float(row.get("error_pct"), 10) or 10,
        "latency_p95_ms": _to_float(row.get("observed_latency_p95_ms"), 250) or 250,
        "drift_index": _to_float(row.get("drift_index"), 0.1) or 0.1,
        "grounding_score": _to_float(row.get("observed_grounding_score"), 0.86) or 0.86,
        "unsupported_claim_rate": _to_float(row.get("unsupported_claim_rate"), _to_float(row.get("hallucination_live_pct"), 2.5) / 100 or 0.025) or 0.025,
        "retrieval_failure_rate": _to_float(row.get("retrieval_failure_rate"), max(0.01, 1 - (_to_float(row.get("context_retrieval_hit_rate"), 0.95) or 0.95))) or 0.03,
        "audit_coverage_pct": (_to_float(row.get("audit_coverage_pct"), 95) or 95),
        "policy_violation_rate": _to_float(row.get("policy_violation_rate"), 0.005) or 0.005,
        "security_anomaly_count": _to_float(row.get("security_anomaly_count"), 0) or 0,
        "cost_per_1k_requests": _to_float(row.get("observed_cost_per_1k_requests"), 1000) or 1000,
    }


def _simulate_telemetry(system: System, row: dict, points: int = 12) -> list[TelemetryEvent]:
    rng = random.Random(system.id)
    observed = _base_observed_metrics(row)
    now = datetime.now(timezone.utc)
    slope = rng.uniform(-0.06, 0.08)
    events: list[TelemetryEvent] = []

    for i in range(points):
        progress = i / max(1, points - 1)
        trend = 1 + slope * progress
        wave = 1 + 0.035 * math.sin(i / 2)
        spike = 1.0
        if i in {points // 3, points - 2} and rng.random() > 0.55:
            spike = rng.uniform(1.12, 1.35)

        latency = observed["latency_p95_ms"] * trend * wave * spike
        drift = observed["drift_index"] * trend * (1 + rng.uniform(-0.06, 0.06))
        unsupported = observed["unsupported_claim_rate"] * trend * (1 + rng.uniform(-0.08, 0.08))
        retrieval = observed["retrieval_failure_rate"] * trend * (1 + rng.uniform(-0.09, 0.09))
        policy = observed["policy_violation_rate"] * trend * (1 + rng.uniform(-0.12, 0.12))
        grounding = observed["grounding_score"] * (2 - trend) * (1 + rng.uniform(-0.03, 0.03))
        audit_coverage = observed["audit_coverage_pct"] * (2 - trend) * (1 + rng.uniform(-0.015, 0.015))
        accuracy = observed["accuracy_pct"] * (2 - trend) * (1 + rng.uniform(-0.02, 0.02))
        error = observed["error_pct"] * trend * (1 + rng.uniform(-0.04, 0.04))
        cost = observed["cost_per_1k_requests"] * trend * (1 + rng.uniform(-0.05, 0.05))

        security_base = int(observed["security_anomaly_count"])
        if i >= points - 3 and rng.random() > 0.7:
            security = max(0, security_base + rng.randint(0, 3))
        else:
            security = security_base

        risk_signals: list[str] = []
        if drift > (_to_float(row.get("expected_drift_score"), 0.12) or 0.12):
            risk_signals.append("drift_elevated")
        if latency > (_to_float(row.get("expected_latency_p95_ms"), 250) or 250):
            risk_signals.append("latency_elevated")
        if security > 0:
            risk_signals.append("security_anomaly")

        event_time = now - timedelta(hours=(points - i) * 8)
        events.append(
            TelemetryEvent(
                id=f"telem_{system.id}_{i + 1}",
                system_id=system.id,
                model_name=system.model,
                timestamp=event_time,
                accuracy_pct=round(max(0, min(100, accuracy)), 3),
                error_pct=round(max(0, error), 3),
                latency_p95_ms=round(max(1, latency), 2),
                drift_index=round(max(0, drift), 4),
                grounding_score=round(max(0, min(1, grounding)), 4),
                unsupported_claim_rate=round(max(0, unsupported), 4),
                retrieval_failure_rate=round(max(0, retrieval), 4),
                audit_coverage_pct=round(max(0, min(100, audit_coverage)), 2),
                policy_violation_rate=round(max(0, policy), 4),
                security_anomaly_count=security,
                cost_per_1k_requests=round(max(0, cost), 2),
                risk_signals=risk_signals,
            )
        )
    return events


def _build_rules() -> list[Rule]:
    return [
        Rule(
            id=spec.id,
            name=spec.name,
            description=spec.description,
            category=spec.category,
            comparator=spec.comparator,  # type: ignore[arg-type]
            threshold_field=spec.threshold_field,
            observed_field=spec.observed_field,
            severity=spec.severity,  # type: ignore[arg-type]
            enabled=True,
        )
        for spec in RULE_SPECS
    ]


def _breached(observed: float | int | None, threshold: float | int | None, comparator: str) -> bool:
    if observed is None or threshold is None:
        return False
    if comparator == ">":
        return observed > threshold
    if comparator == "<":
        return observed < threshold
    if comparator == ">=":
        return observed >= threshold
    if comparator == "<=":
        return observed <= threshold
    return False


def _incident_lifecycle(severity: str, risk_category: str) -> tuple[str, str, bool]:
    if risk_category == "cyber risk":
        return ("open", "escalated", True)
    if severity == "high":
        return ("pending", "pending", True)
    if severity == "medium":
        return ("pending", "not_escalated", True)
    return ("open", "not_escalated", False)


def _build_incidents(
    systems: list[System],
    telemetry_by_system: dict[str, list[TelemetryEvent]],
    expected_by_system: dict[str, dict[str, float]],
) -> list[Incident]:
    incidents: list[Incident] = []
    for system in systems:
        rng = random.Random(f"{system.id}_incidents")
        latest = telemetry_by_system[system.id][-1]
        expected = expected_by_system[system.id]
        for spec in RULE_SPECS:
            observed_value = getattr(latest, spec.observed_field)
            threshold = expected.get(spec.threshold_field)
            if not _breached(observed_value, threshold, spec.comparator):
                continue

            observed_num = float(observed_value)
            threshold_num = float(threshold)
            if spec.comparator in (">", ">="):
                breach_ratio = (observed_num - threshold_num) / max(abs(threshold_num), 1e-6)
            else:
                breach_ratio = (threshold_num - observed_num) / max(abs(threshold_num), 1e-6)

            # Keep incident volume believable: only material breaches become incidents.
            if breach_ratio < 0.035:
                continue

            fire_probability = min(0.7, 0.12 + breach_ratio * 2.2)
            if rng.random() > fire_probability:
                continue

            incident_id = f"inc_{system.id}_{spec.id}"
            severity: str = spec.severity
            if breach_ratio < 0.1:
                severity = "low"
            elif breach_ratio < 0.28:
                severity = "medium"

            incident_status, escalation_status, review_required = _incident_lifecycle(
                severity, spec.risk_category
            )
            incidents.append(
                Incident(
                    id=incident_id,
                    title=f"{spec.name} on {system.model}",
                    category=spec.category,
                    risk_category=spec.risk_category,  # type: ignore[arg-type]
                    incident_status=incident_status,  # type: ignore[arg-type]
                    escalation_status=escalation_status,  # type: ignore[arg-type]
                    review_required=review_required,
                    severity=severity,  # type: ignore[arg-type]
                    system_id=system.id,
                    system_name=f"{system.use_case} ({system.model})",
                    rule_id=spec.id,
                    trigger_metric=spec.observed_field,
                    trigger_reason=f"{spec.name}: {spec.observed_field} is {round(float(observed_value),4)}, expected {spec.comparator} {round(float(threshold),4)}.",
                    threshold=f"{spec.comparator} {round(float(threshold), 4)}",
                    observed_value=round(float(observed_value), 4),
                    expected_value=round(float(threshold), 4),
                    summary=f"{spec.description} Latest value {round(float(observed_value),4)} breached threshold {spec.comparator} {round(float(threshold),4)}.",
                    recommended_action=spec.recommended_action,
                    owner_team=spec.owner_team,
                    created_at=latest.timestamp,
                )
            )
    incidents.sort(key=lambda item: item.created_at, reverse=True)
    return incidents[:24]


def _recalculate_system_posture(systems: list[System], incidents: list[Incident]) -> None:
    incidents_by_system: dict[str, list[Incident]] = {}
    for incident in incidents:
        incidents_by_system.setdefault(incident.system_id, []).append(incident)

    for system in systems:
        scoped = incidents_by_system.get(system.id, [])
        open_incidents = [item for item in scoped if item.incident_status != "closed"]
        high_incidents = [item for item in open_incidents if item.severity == "high"]
        escalated = [
            item for item in open_incidents if item.escalation_status == "escalated"
        ]
        pending_review = [
            item for item in open_incidents if item.incident_status == "pending"
        ]

        if len(escalated) >= 1 or len(high_incidents) >= 2 or len(open_incidents) >= 4:
            system.risk_posture = "critical"
        elif len(high_incidents) >= 1 or len(open_incidents) >= 2:
            system.risk_posture = "at_risk"
        elif len(open_incidents) >= 1 or len(pending_review) >= 1:
            system.risk_posture = "watch"
        else:
            system.risk_posture = "healthy"


def _build_audit_logs(incidents: list[Incident], telemetry_events: list[TelemetryEvent]) -> list[AuditLogEntry]:
    """Build a richer audit timeline.

    Rather than emitting two nearly-identical rows per incident (created /
    review_required), this generator derives a *realistic mix* of governance
    events from the incident and telemetry state — escalations, resolutions,
    false-positive closures, control triggers, audit breaches, Bob activity,
    and follow-up scheduling. Timestamps are jittered so the feed stops
    feeling like a repeating template.
    """

    logs: list[AuditLogEntry] = []
    rng = random.Random("audit_logs_v2")

    def _jittered(ts: datetime, min_minutes: int, max_minutes: int) -> datetime:
        return ts + timedelta(
            minutes=rng.randint(min_minutes, max_minutes),
            seconds=rng.randint(0, 59),
        )

    for idx, incident in enumerate(incidents, start=1):
        # 1. Incident creation
        logs.append(
            AuditLogEntry(
                id=f"audit_inc_created_{idx}",
                actor="rules-engine",
                action="incident.created",
                target_type="incident",
                target_id=incident.id,
                details=(
                    f"{incident.title} on {incident.system_name}. "
                    f"{incident.trigger_metric} outside threshold {incident.threshold}."
                ),
                timestamp=incident.created_at,
            )
        )

        # 2. Underlying control trigger (separate operational event)
        logs.append(
            AuditLogEntry(
                id=f"audit_ctrl_trigger_{idx}",
                actor="rules-engine",
                action="control.triggered",
                target_type="control",
                target_id=incident.rule_id,
                details=(
                    f"{incident.rule_id.replace('rule_', '').replace('_', ' ').title()} "
                    f"triggered on {incident.system_name}."
                ),
                timestamp=_jittered(incident.created_at, 0, 1),
            )
        )

        # 3. Review assignment (only if review is required)
        if incident.review_required:
            logs.append(
                AuditLogEntry(
                    id=f"audit_review_{idx}",
                    actor="governance-queue",
                    action="incident.review_required",
                    target_type="incident",
                    target_id=incident.id,
                    details=(
                        f"Assigned to {incident.owner_team}. Recommendation: "
                        f"{incident.recommended_action}"
                    ),
                    timestamp=_jittered(incident.created_at, 1, 4),
                )
            )

        # 4. Bob investigation opens shortly after the incident
        logs.append(
            AuditLogEntry(
                id=f"audit_bob_open_{idx}",
                actor="bob-copilot",
                action="bob.investigation_opened",
                target_type="incident",
                target_id=incident.id,
                details=(
                    f"Bob opened an investigation on {incident.title} and began "
                    "reviewing telemetry context and active controls."
                ),
                timestamp=_jittered(incident.created_at, 2, 6),
            )
        )

        # 5. Bob drafts a recommendation
        logs.append(
            AuditLogEntry(
                id=f"audit_bob_rec_{idx}",
                actor="bob-copilot",
                action="bob.recommendation_drafted",
                target_type="incident",
                target_id=incident.id,
                details=(
                    f"Bob drafted a remediation recommendation for {incident.owner_team}: "
                    f"{incident.recommended_action}"
                ),
                timestamp=_jittered(incident.created_at, 4, 18),
            )
        )

        # 6. Lifecycle-specific events
        if incident.escalation_status == "escalated":
            logs.append(
                AuditLogEntry(
                    id=f"audit_escalated_{idx}",
                    actor=rng.choice([incident.owner_team, "governance-queue"]),
                    action="incident.escalated",
                    target_type="incident",
                    target_id=incident.id,
                    details=(
                        f"Escalated {incident.title} to {incident.owner_team} "
                        "after review threshold was breached."
                    ),
                    timestamp=_jittered(incident.created_at, 30, 360),
                )
            )
            # Bob recommends escalation
            logs.append(
                AuditLogEntry(
                    id=f"audit_bob_escalate_{idx}",
                    actor="bob-copilot",
                    action="bob.escalation_suggested",
                    target_type="incident",
                    target_id=incident.id,
                    details=(
                        "Bob suggested escalation after correlating recurrence and severity signals."
                    ),
                    timestamp=_jittered(incident.created_at, 20, 60),
                )
            )

        if incident.incident_status == "closed":
            # Closed incidents: either resolved or closed as false positive
            if rng.random() < 0.35:
                logs.append(
                    AuditLogEntry(
                        id=f"audit_false_positive_{idx}",
                        actor=incident.owner_team,
                        action="incident.false_positive",
                        target_type="incident",
                        target_id=incident.id,
                        details=(
                            "Closed as false positive after reviewer investigation. "
                            "Bob control review recommended for threshold calibration."
                        ),
                        timestamp=_jittered(incident.created_at, 200, 1800),
                    )
                )
                logs.append(
                    AuditLogEntry(
                        id=f"audit_bob_tuning_{idx}",
                        actor="bob-copilot",
                        action="bob.control_tuning_suggested",
                        target_type="control",
                        target_id=incident.rule_id,
                        details=(
                            f"Bob suggested control-tuning review on {incident.rule_id} "
                            "after false-positive classification."
                        ),
                        timestamp=_jittered(incident.created_at, 210, 1900),
                    )
                )
            else:
                logs.append(
                    AuditLogEntry(
                        id=f"audit_resolved_{idx}",
                        actor=incident.owner_team,
                        action="incident.resolved",
                        target_type="incident",
                        target_id=incident.id,
                        details=f"{incident.title} resolved after remediation completed.",
                        timestamp=_jittered(incident.created_at, 240, 1800),
                    )
                )

        # 7. Occasional follow-up scheduling — reinforces auditability
        if rng.random() < 0.25:
            logs.append(
                AuditLogEntry(
                    id=f"audit_followup_{idx}",
                    actor="governance-queue",
                    action="followup.scheduled",
                    target_type="incident",
                    target_id=incident.id,
                    details=(
                        f"Follow-up scheduled with {incident.owner_team} to confirm "
                        "Bob's remediation held after the next telemetry window."
                    ),
                    timestamp=_jittered(incident.created_at, 360, 2880),
                )
            )

    # Audit-coverage-breach events from telemetry
    breach_events = [
        event for event in telemetry_events
        if (event.audit_coverage_pct or 100) < 95
    ]
    for idx, event in enumerate(breach_events[:16], start=1):
        logs.append(
            AuditLogEntry(
                id=f"audit_floor_breach_{idx}",
                actor="audit-sampler",
                action="audit.threshold_breach_detected",
                target_type="telemetry_event",
                target_id=event.id,
                details=(
                    f"Audit coverage dropped to {event.audit_coverage_pct:.1f}% on "
                    f"{event.system_id}, below the 95% governance floor."
                ),
                timestamp=event.timestamp,
            )
        )

    # A handful of raw telemetry-processed events preserved for coverage
    for idx, event in enumerate(telemetry_events[-40:], start=1):
        logs.append(
            AuditLogEntry(
                id=f"audit_telem_{idx}",
                actor="telemetry-ingest",
                action="telemetry.processed",
                target_type="telemetry_event",
                target_id=event.id,
                details=(
                    f"Telemetry processed for {event.system_id} with risk signals: "
                    f"{', '.join(event.risk_signals) or 'none'}."
                ),
                timestamp=event.timestamp,
            )
        )

    logs.sort(key=lambda item: item.timestamp, reverse=True)
    return logs


def generate_mock_store() -> dict[str, list]:
    rows = load_post_go_live_rows()
    systems = [_build_system(row) for row in rows]
    rules = _build_rules()

    telemetry_by_system: dict[str, list[TelemetryEvent]] = {}
    expected_by_system: dict[str, dict[str, float]] = {}
    all_events: list[TelemetryEvent] = []

    for system, row in zip(systems, rows):
        telemetry = _simulate_telemetry(system, row)
        telemetry_by_system[system.id] = telemetry
        expected_by_system[system.id] = _system_expected_metrics(row)
        all_events.extend(telemetry)

    all_events.sort(key=lambda item: item.timestamp, reverse=True)
    incidents = _build_incidents(systems, telemetry_by_system, expected_by_system)
    _recalculate_system_posture(systems, incidents)
    audit_logs = _build_audit_logs(incidents, all_events)

    return {
        "systems": systems,
        "telemetry_events": all_events,
        "incidents": incidents,
        "audit_logs": audit_logs,
        "rules": rules,
    }


MOCK_STORE = generate_mock_store()
