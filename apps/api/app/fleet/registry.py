"""Canonical fleet registry — config seed for simulator systems, rules, and incident aliases."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class FleetSystem:
    id: str
    display_id: str
    name: str
    name_alias: str
    owner_team: str
    team_lead: str
    default_reviewer: str
    platform: str
    source_types: tuple[str, ...]
    baseline_metrics: dict[str, float] = field(default_factory=dict)
    applicable_control_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class RuleSpec:
    id: str
    signal_type: str
    threshold_field: str
    threshold_operator: str
    threshold_value: float
    severity: str
    risk_category: str
    priority: str
    lifecycle_final: str


FLEET_SYSTEMS: tuple[FleetSystem, ...] = (
    FleetSystem(
        id="sys-agt-refund-001",
        display_id="REF-001",
        name="Refund Approval Agent",
        name_alias="Refund Approval Agent",
        owner_team="Model Risk Management",
        team_lead="Anika Rao",
        default_reviewer="Anika Rao",
        platform="aws",
        source_types=("aws_bedrock_invocation", "otel_agent_trace"),
        baseline_metrics={"unsupported_claim_rate": 0.01, "policy_violation_rate": 0.0},
        applicable_control_ids=("ctrl-tool-001",),
    ),
    FleetSystem(
        id="sys-agt-cs-002",
        display_id="A12",
        name="Customer Support Routing Agent",
        name_alias="Ticket Routing Agent",
        owner_team="Security Operations",
        team_lead="Marcus Lee",
        default_reviewer="Nora Patel",
        platform="azure",
        source_types=("azure_openai_invocation", "langgraph_trace"),
        baseline_metrics={"latency_ms": 400.0, "error_rate": 0.01},
        applicable_control_ids=("ctrl-latency-001",),
    ),
    FleetSystem(
        id="sys-agt-pep-003",
        display_id="M50",
        name="PEP Screening Agent",
        name_alias="PEP Screening",
        owner_team="Model Risk Management",
        team_lead="Anika Rao",
        default_reviewer="Priya Shah",
        platform="gcp",
        source_types=("vertex_ai_invocation", "otel_agent_trace"),
        baseline_metrics={"grounding_score": 0.85, "model_version_drift": 0.0},
        applicable_control_ids=("ctrl-gov-001",),
    ),
    FleetSystem(
        id="sys-agt-kyc-004",
        display_id="KYC-004",
        name="KYC Document Review Agent",
        name_alias="KYC Document Review",
        owner_team="Model Risk Management",
        team_lead="Anika Rao",
        default_reviewer="Anika Rao",
        platform="aws",
        source_types=("aws_bedrock_invocation", "otel_agent_trace"),
        baseline_metrics={"sensitive_output_rate": 0.0},
        applicable_control_ids=("ctrl-pii-001",),
    ),
    FleetSystem(
        id="sys-agt-inv-005",
        display_id="M44",
        name="Invoice Validation Agent",
        name_alias="Invoice OCR Validation",
        owner_team="Platform Reliability",
        team_lead="Sofia Martinez",
        default_reviewer="James Chen",
        platform="azure",
        source_types=("azure_openai_invocation", "otel_agent_trace"),
        baseline_metrics={"latency_ms": 500.0, "ocr_confidence": 0.9},
        applicable_control_ids=("ctrl-latency-001",),
    ),
    FleetSystem(
        id="sys-agt-treasury-001",
        display_id="M40",
        name="Treasury Commentary Agent",
        name_alias="NII Sensitivity",
        owner_team="Model Risk Management",
        team_lead="Anika Rao",
        default_reviewer="Evan Brooks",
        platform="gcp",
        source_types=("vertex_ai_invocation", "langgraph_trace", "otel_agent_trace"),
        baseline_metrics={"unsupported_claim_rate": 0.01, "grounding_score": 0.85},
        applicable_control_ids=("ctrl-ground-001",),
    ),
    FleetSystem(
        id="sys-agt-rag-007",
        display_id="RAG-007",
        name="Internal Knowledge RAG Agent",
        name_alias="Internal Knowledge RAG",
        owner_team="Platform Reliability",
        team_lead="Sofia Martinez",
        default_reviewer="James Chen",
        platform="aws",
        source_types=("otel_agent_trace", "aws_bedrock_invocation"),
        baseline_metrics={"retrieval_failure_rate": 0.02, "latency_ms": 450.0},
        applicable_control_ids=("ctrl-retrieval-001",),
    ),
    FleetSystem(
        id="sys-agt-phish-008",
        display_id="PHISH-008",
        name="Phishing Triage Agent",
        name_alias="Phishing Triage",
        owner_team="Security Operations",
        team_lead="Marcus Lee",
        default_reviewer="Nora Patel",
        platform="azure",
        source_types=("azure_openai_invocation", "policy_engine_event"),
        baseline_metrics={"security_anomaly_count": 0.0},
        applicable_control_ids=("ctrl-sec-001",),
    ),
    FleetSystem(
        id="sys-agt-access-009",
        display_id="ACCESS-009",
        name="Access Review Agent",
        name_alias="Access Review",
        owner_team="Security Operations",
        team_lead="Marcus Lee",
        default_reviewer="Marcus Lee",
        platform="aws",
        source_types=("aws_bedrock_invocation", "policy_engine_event"),
        baseline_metrics={"unapproved_region_rate": 0.0},
        applicable_control_ids=("ctrl-region-001",),
    ),
    FleetSystem(
        id="sys-agt-reg-010",
        display_id="REG-010",
        name="Regulatory Change Monitor",
        name_alias="Regulatory Change Monitor",
        owner_team="Model Risk Management",
        team_lead="Anika Rao",
        default_reviewer="Priya Shah",
        platform="gcp",
        source_types=("vertex_ai_invocation", "otel_agent_trace"),
        baseline_metrics={"audit_coverage_pct": 1.0},
        applicable_control_ids=("ctrl-audit-001",),
    ),
)

RULE_SPECS: tuple[RuleSpec, ...] = (
    RuleSpec(
        id="rule_unsupported_claim_high",
        signal_type="unsupported_claim_elevated",
        threshold_field="unsupported_claim_rate",
        threshold_operator=">",
        threshold_value=0.03,
        severity="critical",
        risk_category="Output Reliability",
        priority="P1",
        lifecycle_final="Owner Review",
    ),
    RuleSpec(
        id="rule_grounding_low",
        signal_type="grounding_degraded",
        threshold_field="grounding_score",
        threshold_operator="<",
        threshold_value=0.75,
        severity="high",
        risk_category="Output Reliability",
        priority="P2",
        lifecycle_final="Owner Review",
    ),
    RuleSpec(
        id="rule_tool_scope_violation",
        signal_type="tool_scope_violation",
        threshold_field="tool_scope_violation",
        threshold_operator=">=",
        threshold_value=1.0,
        severity="critical",
        risk_category="Cyber",
        priority="P1",
        lifecycle_final="Action Approval",
    ),
    RuleSpec(
        id="rule_retrieval_failure",
        signal_type="retrieval_degradation",
        threshold_field="retrieval_failure_rate",
        threshold_operator=">",
        threshold_value=0.08,
        severity="medium",
        risk_category="Technology",
        priority="P2",
        lifecycle_final="Owner Review",
    ),
    RuleSpec(
        id="rule_latency_high",
        signal_type="latency_regression",
        threshold_field="latency_ms",
        threshold_operator=">",
        threshold_value=800.0,
        severity="medium",
        risk_category="Technology",
        priority="P2",
        lifecycle_final="Owner Review",
    ),
    RuleSpec(
        id="rule_sensitive_output",
        signal_type="sensitive_data_exposure",
        threshold_field="sensitive_output",
        threshold_operator=">=",
        threshold_value=1.0,
        severity="critical",
        risk_category="Output Reliability",
        priority="P1",
        lifecycle_final="Owner Review",
    ),
    RuleSpec(
        id="rule_unapproved_region",
        signal_type="unapproved_region",
        threshold_field="unapproved_region",
        threshold_operator=">=",
        threshold_value=1.0,
        severity="high",
        risk_category="Cyber",
        priority="P1",
        lifecycle_final="Action Approval",
    ),
)

# Operational responder team by risk category (incident queue routing).
RESPONDER_TEAM_BY_RISK_CATEGORY: dict[str, str] = {
    "Output Reliability": "Model Risk Management",
    "Cyber": "Security Operations",
    "Technology": "Platform Reliability",
}


def responder_team_for_risk(risk_category: str, *, fallback: str = "Model Risk Management") -> str:
    return RESPONDER_TEAM_BY_RISK_CATEGORY.get(risk_category, fallback)


def system_archetype(system_id: str) -> str:
    from app.fleet.system_metadata import SYSTEM_METADATA

    return str(SYSTEM_METADATA.get(system_id, {}).get("archetype", "decision"))


# system_id + signal_type -> pitch alias for deep links (locked E2E aliases in plan)
INCIDENT_ALIAS_BY_SIGNAL: dict[tuple[str, str], str] = {
    ("sys-agt-treasury-001", "unsupported_claim_elevated"): "inc-mrm-001",
    ("sys-agt-pep-003", "grounding_degraded"): "inc-mrm-002",
    ("sys-agt-phish-008", "tool_scope_violation"): "inc-sec-001",
    ("sys-agt-cs-002", "latency_regression"): "inc-plat-003",
    ("sys-agt-rag-007", "retrieval_degradation"): "inc-plat-002",
}

SYSTEM_BY_ID = {s.id: s for s in FLEET_SYSTEMS}
SYSTEM_BY_DISPLAY = {s.display_id: s for s in FLEET_SYSTEMS}
RULE_BY_ID = {r.id: r for r in RULE_SPECS}


def canonical_incident_id(system_id: str, signal_type: str) -> str:
    return f"inc_{system_id}_{signal_type}_001"


def incident_alias(system_id: str, signal_type: str) -> str:
    return INCIDENT_ALIAS_BY_SIGNAL.get(
        (system_id, signal_type),
        canonical_incident_id(system_id, signal_type),
    )
