"""Per-system simulation profiles — align fleet agents with System Registry model codes."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.fleet.registry import FLEET_SYSTEMS, SYSTEM_BY_ID


@dataclass(frozen=True)
class SimulationProfile:
    model_code: str
    use_case: str
    model_type_label: str
    legacy_system_id: str | None
    invocation_model: str
    deployment_name: str | None = None
    model_id: str | None = None
    model_version: str | None = None

    @property
    def registry_model_label(self) -> str:
        return f"{self.model_code} · {self.use_case}"


SIMULATION_PROFILES: dict[str, SimulationProfile] = {
    "sys-agt-refund-001": SimulationProfile(
        model_code="REF-001",
        use_case="Refund approval agent",
        model_type_label="LLM agent",
        legacy_system_id=None,
        invocation_model="anthropic.claude-3-5-sonnet",
        model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
    ),
    "sys-agt-cs-002": SimulationProfile(
        model_code="M49",
        use_case="Ticket routing",
        model_type_label="NLP BERT",
        legacy_system_id="sys_m49_ticket_routing",
        invocation_model="gpt-4o",
        deployment_name="gpt-4o",
    ),
    "sys-agt-pep-003": SimulationProfile(
        model_code="M50",
        use_case="PEP screening",
        model_type_label="Hybrid ML + Rules",
        legacy_system_id="sys_m50_pep_screening",
        invocation_model="gemini-1.5-pro",
        model_version="gemini-1.5-pro",
    ),
    "sys-agt-kyc-004": SimulationProfile(
        model_code="M18",
        use_case="KYC document validation",
        model_type_label="Vision Transformer",
        legacy_system_id="sys_m18_kyc_document_validation",
        invocation_model="anthropic.claude-3-5-sonnet",
        model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
    ),
    "sys-agt-inv-005": SimulationProfile(
        model_code="M44",
        use_case="Invoice OCR validation",
        model_type_label="Vision Transformer",
        legacy_system_id="sys_m44_invoice_ocr_validation",
        invocation_model="gpt-4o",
        deployment_name="gpt-4o",
    ),
    "sys-agt-treasury-001": SimulationProfile(
        model_code="M40",
        use_case="NII sensitivity",
        model_type_label="Time Series ARIMA",
        legacy_system_id="sys_m40_nii_sensitivity",
        invocation_model="gemini-1.5-pro",
        model_version="gemini-1.5-pro",
        deployment_name="gpt-4o",
    ),
    "sys-agt-rag-007": SimulationProfile(
        model_code="M32",
        use_case="Internal FAQ bot",
        model_type_label="Small LLM",
        legacy_system_id="sys_m32_internal_faq_bot",
        invocation_model="anthropic.claude-3-5-sonnet",
        model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
    ),
    "sys-agt-phish-008": SimulationProfile(
        model_code="M45",
        use_case="Cyber alert summarization",
        model_type_label="Multi-agent system",
        legacy_system_id="sys_m45_cyber_alert_summarization",
        invocation_model="gpt-4o",
        deployment_name="gpt-4o",
    ),
    "sys-agt-access-009": SimulationProfile(
        model_code="ACCESS-009",
        use_case="Access review",
        model_type_label="LLM agent",
        legacy_system_id=None,
        invocation_model="anthropic.claude-3-5-sonnet",
        model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
    ),
    "sys-agt-reg-010": SimulationProfile(
        model_code="M37",
        use_case="Regulatory filing assistant",
        model_type_label="LLM with tools",
        legacy_system_id="sys_m37_regulatory_filing_assistant",
        invocation_model="gemini-1.5-pro",
        model_version="gemini-1.5-pro",
    ),
}

LEGACY_SYSTEM_ID_TO_FLEET: dict[str, str] = {
    profile.legacy_system_id: system_id
    for system_id, profile in SIMULATION_PROFILES.items()
    if profile.legacy_system_id
}


def profile_for(system_id: str) -> SimulationProfile:
    if system_id in SIMULATION_PROFILES:
        return SIMULATION_PROFILES[system_id]
    fleet = SYSTEM_BY_ID.get(system_id)
    code = fleet.display_id if fleet else system_id
    return SimulationProfile(
        model_code=code,
        use_case=fleet.name_alias if fleet else system_id,
        model_type_label="LLM agent",
        legacy_system_id=None,
        invocation_model="gpt-4o",
        deployment_name="gpt-4o",
    )


def primary_source_type(system_id: str) -> str:
    fleet = SYSTEM_BY_ID.get(system_id)
    if not fleet:
        return "otel_agent_trace"
    for preferred in fleet.source_types:
        return preferred
    return "otel_agent_trace"


def _provider_for_platform(platform: str) -> str:
    if platform == "aws":
        return "aws"
    if platform == "azure":
        return "azure"
    if platform == "gcp":
        return "gcp"
    return "internal"


def build_raw_envelope(
    system_id: str,
    *,
    seq: int,
    source_type: str | None = None,
    trace_id: str | None = None,
    operation: str = "model_call",
    evaluation: dict[str, Any] | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a raw ingest envelope with model + platform aligned to fleet registry."""
    fleet = SYSTEM_BY_ID[system_id]
    profile = profile_for(system_id)
    st = source_type or primary_source_type(system_id)
    provider = _provider_for_platform(fleet.platform)
    trace = trace_id or f"trc-{fleet.display_id}-{seq}"

    base: dict[str, Any] = {
        "schema_version": "1.0",
        "tenant_id": "tenant-demo",
        "environment": "production",
        "system_id": system_id,
        "registry_model_code": profile.model_code,
        "registry_use_case": profile.use_case,
        "trace_id": trace,
        "timestamp": f"2026-06-02T16:{seq % 60:02d}:00.000Z",
        "content_mode": "metadata_only",
        "idempotency_key": f"{system_id}:{st}:{seq}",
    }

    eval_block = evaluation or {
        "grounding_score": fleet.baseline_metrics.get("grounding_score", 0.88),
        "unsupported_claim_rate": fleet.baseline_metrics.get("unsupported_claim_rate", 0.008),
    }

    if st in ("otel_agent_trace", "langgraph_trace", "custom_agent_trace"):
        model_provider = provider if provider != "internal" else "azure"
        envelope: dict[str, Any] = {
            **base,
            "source_type": st,
            "source_provider": "internal",
            "source_service": "agent-orchestrator",
            "span_id": f"spn-{fleet.display_id}-{seq}",
            "operation": operation,
            "agent_step": profile.use_case.lower().replace(" ", "_"),
            "model": {
                "provider": model_provider,
                "name": profile.invocation_model,
                "registry_code": profile.model_code,
            },
            "latency_ms": fleet.baseline_metrics.get("latency_ms", 200 + seq * 5),
            "evaluation": eval_block,
        }
    elif st == "aws_bedrock_invocation":
        envelope = {
            **base,
            "source_type": st,
            "source_provider": "aws",
            "source_service": "bedrock",
            "invocation_id": f"aws-{fleet.display_id}-{seq}",
            "model_id": profile.model_id or profile.invocation_model,
            "latency_ms": fleet.baseline_metrics.get("latency_ms", 450),
            "evaluation": eval_block,
        }
    elif st == "azure_openai_invocation":
        envelope = {
            **base,
            "source_type": st,
            "source_provider": "azure",
            "source_service": "azure-openai",
            "invocation_id": f"az-{fleet.display_id}-{seq}",
            "deployment_name": profile.deployment_name or profile.invocation_model,
            "latency_ms": fleet.baseline_metrics.get("latency_ms", 380),
            "evaluation": eval_block,
        }
    elif st == "policy_engine_event":
        envelope = {
            **base,
            "source_type": st,
            "source_provider": provider if provider != "internal" else "internal",
            "source_service": "policy-engine",
            "event_id": f"pol-{fleet.display_id}-{seq}",
            "operation": operation,
            "latency_ms": fleet.baseline_metrics.get("latency_ms", 50),
            "evaluation": eval_block,
        }
    else:
        envelope = {
            **base,
            "source_type": "vertex_ai_invocation",
            "source_provider": "gcp",
            "source_service": "vertex-ai",
            "invocation_id": f"vertex-{fleet.display_id}-{seq}",
            "model_version": profile.model_version or profile.invocation_model,
            "latency_ms": fleet.baseline_metrics.get("latency_ms", 410),
            "evaluation": eval_block,
        }

    if extra:
        envelope.update(extra)
    return envelope


def normalized_model_name(system_id: str) -> str:
    return profile_for(system_id).registry_model_label
