"""OpenTelemetry GenAI semantic convention allowlist — do not emit attributes outside this set."""

from __future__ import annotations

# Stable GenAI attributes permitted on simulated spans (OTel semconv).
ALLOWED_GEN_AI_ATTRIBUTES: frozenset[str] = frozenset(
    {
        "gen_ai.operation.name",
        "gen_ai.provider.name",
        "gen_ai.request.model",
        "gen_ai.response.model",
        "gen_ai.request.temperature",
        "gen_ai.request.max_tokens",
        "gen_ai.usage.input_tokens",
        "gen_ai.usage.output_tokens",
        "gen_ai.response.finish_reasons",
        "gen_ai.response.id",
        "gen_ai.tool.name",
        "gen_ai.tool.type",
        "server.address",
        "server.port",
    }
)

# Fleetrac span event names (simulator + governance).
ALLOWED_FLEETRAC_SPAN_EVENTS: frozenset[str] = frozenset(
    {
        "fleetrac.model.request.started",
        "fleetrac.model.response.received",
        "fleetrac.policy.evaluated",
        "fleetrac.tool.call.attempted",
        "fleetrac.tool.call.denied",
        "fleetrac.evaluation.completed",
        "fleetrac.evaluation.unsupported_claim.detected",
        "fleetrac.citation.verification.failed",
        "fleetrac.business_outcome.emitted",
    }
)


def filter_gen_ai_attributes(attributes: dict[str, object]) -> dict[str, object]:
    """Return only allowlisted gen_ai.*, server.*, and fleetrac.* keys."""
    return {
        key: value
        for key, value in attributes.items()
        if key in ALLOWED_GEN_AI_ATTRIBUTES or key.startswith("fleetrac.")
    }
