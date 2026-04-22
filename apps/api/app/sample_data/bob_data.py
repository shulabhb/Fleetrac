"""Mock generator for Bob, Fleetrac's agentic governance copilot.

This file is deliberately structured around *investigation archetypes* rather
than one generic template. The goal is that Bob's output reads like a set of
different analyses from a real copilot — drift, latency, grounding, security,
policy, audit, quality, and control-noise investigations each have distinct
language, evidence focus, recommendation types, and confidence spread.

Nothing here calls a model. The heuristics read the current mock store
(incidents, systems, rules, telemetry, audit logs) and phrase Bob's
conclusions in archetype-appropriate terms with deterministic-but-varied
timing so the UI stops feeling like one repeating pattern.
"""

from __future__ import annotations

import hashlib
import random
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Iterable

from app.sample_data.mock_data import MOCK_STORE
from app.schemas.bob import (
    BobActivityEvent,
    BobEvidence,
    BobInvestigation,
    BobRecommendation,
)


# ---------------------------------------------------------------------------
# Signal + risk domain taxonomy
# ---------------------------------------------------------------------------

SIGNAL_BY_FIELD = {
    "drift_index": "Drift",
    "latency_p95_ms": "Latency",
    "grounding_score": "Grounding",
    "accuracy_pct": "Quality",
    "error_pct": "Quality",
    "unsupported_claim_rate": "Grounding",
    "retrieval_failure_rate": "Grounding",
    "audit_coverage_pct": "Audit",
    "policy_violation_rate": "Policy",
    "security_anomaly_count": "Security",
    "cost_per_1k_requests": "Cost",
}


def _signal_for_rule(rule_id: str, observed_field: str | None) -> str:
    if observed_field and observed_field in SIGNAL_BY_FIELD:
        return SIGNAL_BY_FIELD[observed_field]
    key = rule_id.lower()
    if "drift" in key:
        return "Drift"
    if "latency" in key:
        return "Latency"
    if "ground" in key or "unsupported" in key or "retrieval" in key:
        return "Grounding"
    if "audit" in key:
        return "Audit"
    if "policy" in key:
        return "Policy"
    if "security" in key:
        return "Security"
    if "quality" in key or "error" in key:
        return "Quality"
    return "Technology"


def _risk_domain_for(category: str | None) -> str:
    if not category:
        return "Governance / Compliance"
    key = category.lower()
    if "cyber" in key:
        return "Cyber Risk"
    if "governance" in key or "compliance" in key:
        return "Governance / Compliance"
    if "output" in key or "reliability" in key:
        return "Output Reliability"
    return "Technology Risk"


# ---------------------------------------------------------------------------
# Archetype content library
# ---------------------------------------------------------------------------
#
# For each signal we list multiple archetype variants. Each variant carries
# its own root cause, alternative hypothesis, and typed recommendation block.
# The selector (below) picks a variant deterministically from the incident id
# so Bob reads differently per investigation without losing reproducibility.

Variant = dict  # {root_cause, alt_hypothesis, recommendations: [...], flavor}


DRIFT_VARIANTS: list[Variant] = [
    {
        "flavor": "distribution_shift",
        "root_cause": (
            "Recent input-distribution shift on upstream features is pushing the "
            "model away from its validated baseline; the shape of the drift curve "
            "matches a sustained feature-space change rather than a single-day spike."
        ),
        "alt_hypothesis": (
            "A short-lived upstream batch anomaly; one more telemetry window should "
            "confirm whether the shift is sustained."
        ),
        "recommendations": [
            (
                "upstream_data_investigation",
                "Validate recent upstream dataset shift on feature pipeline",
                "upstream_review",
                "The drift shape (sustained elevation, not spike) historically traces to feature-side changes rather than model weights.",
                0.74,
            ),
            (
                "retrain_candidate",
                "Compare to prior stable model version before promoting a refresh",
                "model_refresh",
                "If the upstream shift is confirmed, a refreshed candidate should be evaluated against the last stable version before promoting.",
                0.62,
            ),
        ],
    },
    {
        "flavor": "refresh_regression",
        "root_cause": (
            "Drift signature aligns with the most recent model refresh window; the "
            "regression began immediately after promotion, which is consistent with "
            "a refreshed model not matching the prior behavioral envelope."
        ),
        "alt_hypothesis": (
            "Coincidental load pattern change in the same window; verify by checking "
            "whether traffic composition moved at the same time."
        ),
        "recommendations": [
            (
                "rollback_candidate",
                "Evaluate rollback candidate to previous stable model version",
                "rollback_review",
                "Rollback is the lowest-risk reversible action while regression root cause is being confirmed.",
                0.71,
            ),
            (
                "tighten_review_gate",
                "Tighten human review gate on this workflow until refresh is cleared",
                "review_policy",
                "Holding a stricter review gate contains exposure without fully pausing the workflow.",
                0.63,
            ),
        ],
    },
    {
        "flavor": "seasonal_deviation",
        "root_cause": (
            "Drift elevation is concentrated within a narrow daily window that matches "
            "prior seasonal shifts on this workflow, suggesting a periodic behavior "
            "change rather than a sustained regression."
        ),
        "alt_hypothesis": (
            "A genuine regression coinciding with the seasonal window; a like-for-like "
            "compare against the same window last month will disambiguate."
        ),
        "recommendations": [
            (
                "observe_next_window",
                "Hold remediation until one more telemetry window is observed",
                "observation",
                "Acting on a likely-seasonal pattern risks masking real future regressions; one more window resolves the ambiguity cheaply.",
                0.58,
            ),
            (
                "control_tuning",
                "Open control calibration review for seasonal-aware thresholds",
                "control_tuning",
                "The current control has no seasonal component, which inflates false positives during this window.",
                0.52,
            ),
        ],
    },
    {
        "flavor": "pipeline_change",
        "root_cause": (
            "Drift pattern began within 24 hours of a known upstream pipeline change; "
            "the timing correlation is tight enough that the pipeline event is the "
            "most defensible first hypothesis."
        ),
        "alt_hypothesis": (
            "Two unrelated events lining up; unlikely given the tight correlation "
            "but should still be confirmed in a reviewer note."
        ),
        "recommendations": [
            (
                "upstream_data_investigation",
                "Review recent deployment/config change on upstream pipeline",
                "upstream_review",
                "Tight timing correlation places the pipeline change ahead of the model itself as the most likely cause.",
                0.76,
            ),
            (
                "observe_next_window",
                "Re-baseline drift after pipeline is reverted or stabilized",
                "observation",
                "Re-baselining avoids misreading the post-fix curve as a second incident.",
                0.55,
            ),
        ],
    },
]


LATENCY_VARIANTS: list[Variant] = [
    {
        "flavor": "routing_bottleneck",
        "root_cause": (
            "p95 inflation is concentrated on a single routing path; other routes on "
            "the same workflow remain inside SLA, which points at a routing-layer "
            "bottleneck rather than a global inference slowdown."
        ),
        "alt_hypothesis": (
            "A noisy cross-tenant caller saturating one path; segmenting by tenant "
            "will distinguish infrastructure from workload."
        ),
        "recommendations": [
            (
                "tune_threshold",
                "Route affected traffic to fallback inference path",
                "traffic_shaping",
                "Rerouting affected traffic preserves SLA while the primary path is investigated.",
                0.68,
            ),
            (
                "upstream_data_investigation",
                "Investigate routing-layer saturation before tuning capacity",
                "upstream_review",
                "Increasing capacity on a routing bottleneck just moves the queue; the routing layer itself needs inspection first.",
                0.55,
            ),
        ],
    },
    {
        "flavor": "autoscaling_lag",
        "root_cause": (
            "Latency peaks coincide with traffic ramps faster than the autoscaling "
            "minimums react to. Baseline p95 is stable between peaks, which is "
            "characteristic of scaling lag rather than model-side regression."
        ),
        "alt_hypothesis": (
            "An inference-side regression that only manifests under load; a cold-pool "
            "benchmark would disambiguate."
        ),
        "recommendations": [
            (
                "tune_threshold",
                "Raise inference pool minimum capacity during peak windows",
                "capacity_tuning",
                "Autoscaling minimums have not kept up with concurrency growth; raising the floor contains SLA risk.",
                0.72,
            ),
            (
                "observe_next_window",
                "Confirm the pattern repeats on the next peak before committing",
                "observation",
                "One more peak window confirms this is structural, not a one-off spike.",
                0.58,
            ),
        ],
    },
    {
        "flavor": "upstream_timeout",
        "root_cause": (
            "The majority of p95 degradation is attributable to a specific downstream "
            "dependency whose call duration moved at the same time; inference-path "
            "latency excluding that call is within SLA."
        ),
        "alt_hypothesis": (
            "A shared network path degrading both services; a direct health check on "
            "the dependency will isolate it."
        ),
        "recommendations": [
            (
                "upstream_data_investigation",
                "Investigate downstream dependency response times",
                "upstream_review",
                "Dependency call duration explains most of the p95 regression; fixing the dependency is cheaper than tuning inference.",
                0.70,
            ),
            (
                "escalate",
                "Route latency alert to Platform Reliability on-call",
                "escalation",
                "Dependency-side regressions typically need a second team for resolution; a named escalation avoids ownership drift.",
                0.60,
            ),
        ],
    },
    {
        "flavor": "saturation",
        "root_cause": (
            "Inference pool saturation is sustained rather than bursty; queueing time "
            "explains the p95 regression and CPU utilization on the pool is near "
            "headroom limits."
        ),
        "alt_hypothesis": (
            "A single hot prompt shape inflating average batch time; prompt-length "
            "histogram can rule this in or out."
        ),
        "recommendations": [
            (
                "tune_threshold",
                "Raise inference pool capacity and revisit SLA alert threshold",
                "capacity_tuning",
                "Sustained saturation rules out a transient spike; structural capacity is the defensible fix.",
                0.74,
            ),
            (
                "tighten_review_gate",
                "Tighten human review only for highest-tier decisions while mitigating",
                "review_policy",
                "Narrowing review scope reduces user-facing impact without halting the workflow.",
                0.52,
            ),
        ],
    },
]


GROUNDING_VARIANTS: list[Variant] = [
    {
        "flavor": "retrieval_freshness",
        "root_cause": (
            "Grounding and unsupported-claim metrics moved together, which historically "
            "indicates stale retrieval sources rather than a generator regression. The "
            "re-indexing schedule appears to have slipped."
        ),
        "alt_hypothesis": (
            "Transient retrieval-connector flakiness rather than a corpus regression; "
            "review retry rates before tuning retrieval."
        ),
        "recommendations": [
            (
                "retrieval_freshness_review",
                "Review retrieval source freshness and re-indexing schedule",
                "retrieval_refresh",
                "The correlated move in grounding and unsupported claim rate points at corpus freshness.",
                0.74,
            ),
            (
                "tighten_review_gate",
                "Require citation checks for this workflow family until corpus is refreshed",
                "review_policy",
                "A citation gate contains customer-facing risk while the retrieval fix is validated.",
                0.61,
            ),
        ],
    },
    {
        "flavor": "weak_source_overlap",
        "root_cause": (
            "Grounding regressed for a narrow topic slice where retrieved sources have "
            "weak overlap with the question surface area. The core corpus is healthy; "
            "the regression is specific to an under-covered topic."
        ),
        "alt_hypothesis": (
            "Evaluator drift on the slice; a second evaluator run on the same slice "
            "will confirm whether the regression is real."
        ),
        "recommendations": [
            (
                "tighten_review_gate",
                "Increase human review for the affected topic slice only",
                "review_policy",
                "Scoped review keeps the blast radius small and avoids a broad review increase across the whole workflow.",
                0.67,
            ),
            (
                "retrieval_freshness_review",
                "Expand corpus coverage for under-covered topic slice",
                "retrieval_refresh",
                "The slice can be covered without re-training; a corpus expansion is the smallest effective fix.",
                0.58,
            ),
        ],
    },
    {
        "flavor": "citation_mismatch",
        "root_cause": (
            "Citation-level comparison shows the generator is citing sources that do "
            "not support the claim text. This is a prompt / post-processing failure "
            "rather than a retrieval failure."
        ),
        "alt_hypothesis": (
            "Retrieval is returning the right documents but at lower ranks; reranking "
            "may be under-weighting authority signals."
        ),
        "recommendations": [
            (
                "tighten_review_gate",
                "Require citation check for this workflow family",
                "review_policy",
                "Citation-level checks are the defensible short-term fix while the prompt fix is validated.",
                0.72,
            ),
            (
                "upstream_data_investigation",
                "Review recent prompt-template changes on this workflow",
                "upstream_review",
                "Mismatches of this shape typically trace to a prompt-template change rather than the retrieval stack.",
                0.60,
            ),
        ],
    },
]


QUALITY_VARIANTS: list[Variant] = [
    {
        "flavor": "prompt_degradation",
        "root_cause": (
            "Error rate climbed relative to baseline on a narrow slice right after a "
            "prompt template change; the regression shape and timing match a prompt "
            "degradation rather than a model or data issue."
        ),
        "alt_hypothesis": (
            "An evaluator-set mismatch producing inflated error metrics; re-running "
            "offline evaluation on a held-out set will confirm."
        ),
        "recommendations": [
            (
                "upstream_data_investigation",
                "Review recent prompt template change for regression",
                "upstream_review",
                "Timing correlation places the prompt change ahead of model weights as the most likely driver.",
                0.70,
            ),
            (
                "tighten_review_gate",
                "Route affected slice through stricter human review",
                "review_policy",
                "A narrow review increase preserves user trust without halting the workflow.",
                0.58,
            ),
        ],
    },
    {
        "flavor": "guardrail_bypass",
        "root_cause": (
            "Unsupported-claim rate climbed with a distinct pattern across a handful of "
            "user shapes, suggesting guardrail bypass attempts rather than generator "
            "regression."
        ),
        "alt_hypothesis": (
            "Normal variance in hard-case frequency; a like-for-like compare against "
            "prior weeks would rule this in or out."
        ),
        "recommendations": [
            (
                "tighten_review_gate",
                "Tighten guardrails for affected user shapes",
                "review_policy",
                "Targeted guardrail tightening addresses the bypass pattern without penalizing low-risk users.",
                0.66,
            ),
            (
                "cluster_escalation",
                "Escalate bypass pattern to Responsible AI Review Board",
                "escalation",
                "A sustained bypass shape benefits from a named escalation path and a post-mortem cadence.",
                0.58,
            ),
        ],
    },
]


AUDIT_VARIANTS: list[Variant] = [
    {
        "flavor": "reviewer_capacity",
        "root_cause": (
            "Audit coverage dipped below the governance minimum coincident with the "
            "reviewer rotation window; sampling capacity rather than the sampling "
            "pipeline appears to be the bottleneck."
        ),
        "alt_hypothesis": (
            "A sampling pipeline defect dropping events silently; a pipeline health "
            "check confirms which of the two is at fault."
        ),
        "recommendations": [
            (
                "increase_audit_sampling",
                "Increase sampled reviews until coverage is restored above 95%",
                "audit_policy",
                "Restoring coverage is a hard compliance requirement; nothing else on this investigation should block it.",
                0.80,
            ),
            (
                "route_to_owner",
                "Notify control owner to confirm sampling pipeline health",
                "ownership_handoff",
                "The control owner should confirm reviewer capacity and pipeline health before the next audit window closes.",
                0.62,
            ),
        ],
    },
    {
        "flavor": "pipeline_gap",
        "root_cause": (
            "Audit pipeline appears to be silently dropping a fraction of events "
            "during the affected window; the coverage curve shape matches a pipeline "
            "gap rather than reviewer-side slowdown."
        ),
        "alt_hypothesis": (
            "A one-day reviewer crunch rather than a pipeline defect; a queue-depth "
            "inspection resolves the ambiguity."
        ),
        "recommendations": [
            (
                "increase_audit_sampling",
                "Backfill sampling on affected window and raise coverage floor",
                "audit_policy",
                "Backfilling restores compliance posture; raising the floor prevents the same dip from recurring.",
                0.76,
            ),
            (
                "escalate",
                "Escalate pipeline gap to AI Governance Office",
                "escalation",
                "Governance-floor breaches are a named-escalation event even when the fix itself is low-risk.",
                0.64,
            ),
        ],
    },
]


POLICY_VARIANTS: list[Variant] = [
    {
        "flavor": "new_surface",
        "root_cause": (
            "Policy violations are concentrated on a newer workflow surface that the "
            "current control was not calibrated for; the rest of the fleet remains "
            "within policy."
        ),
        "alt_hypothesis": (
            "A noisy tenant distorting the global rate; segmenting by tenant will "
            "confirm before broader policy changes."
        ),
        "recommendations": [
            (
                "control_tuning",
                "Split the control into narrower scope variants for the new surface",
                "control_tuning",
                "A scoped variant calibrates to the new surface without weakening the global policy.",
                0.68,
            ),
            (
                "cluster_escalation",
                "Escalate cluster to Policy Compliance leadership for scope decision",
                "escalation",
                "A named escalation avoids ad-hoc scope decisions on a regulated workflow.",
                0.56,
            ),
        ],
    },
    {
        "flavor": "approval_loop",
        "root_cause": (
            "Violations repeat on approvals that did not close out their associated "
            "mitigation; the control is correctly firing, but the mitigation closure "
            "workflow appears broken."
        ),
        "alt_hypothesis": (
            "A downstream logging gap misclassifying closed mitigations as open; a "
            "workflow-log inspection would rule this in."
        ),
        "recommendations": [
            (
                "escalate",
                "Escalate closure-gap pattern to Policy Compliance leadership",
                "escalation",
                "Repeated approvals without closure is a governance-drift signal and warrants named ownership.",
                0.62,
            ),
            (
                "control_tuning",
                "Tighten approval gate temporarily until closure workflow is fixed",
                "review_policy",
                "A temporary gate contains exposure while the closure workflow is repaired.",
                0.58,
            ),
        ],
    },
]


SECURITY_VARIANTS: list[Variant] = [
    {
        "flavor": "scanner_vs_real",
        "root_cause": (
            "Traffic anomaly cluster has characteristics of automated scanner activity "
            "more than a targeted probe, but the volume is high enough that a benign "
            "classification should not be made unilaterally."
        ),
        "alt_hypothesis": (
            "A genuine probing pattern mimicking scanner noise; correlating against "
            "upstream WAF events sharpens the classification."
        ),
        "recommendations": [
            (
                "cluster_escalation",
                "Escalate anomaly cluster to Cyber Risk Operations",
                "escalation",
                "Classification of this cluster benefits from a second pair of eyes; Cyber Risk Ops should own the call.",
                0.78,
            ),
            (
                "observe_next_window",
                "Correlate with upstream WAF events before tuning controls",
                "observation",
                "Confirming against WAF telemetry prevents over-tuning the inference-side control.",
                0.54,
            ),
        ],
    },
    {
        "flavor": "endpoint_misuse",
        "root_cause": (
            "Unusual endpoint usage pattern from a small set of sources looks less like "
            "random noise and more like targeted probing of a less-monitored surface."
        ),
        "alt_hypothesis": (
            "A third-party integration regressed its rate-limiting and is spraying "
            "requests; confirm with the integration owner."
        ),
        "recommendations": [
            (
                "cluster_escalation",
                "Isolate suspicious sources before further escalation",
                "traffic_shaping",
                "Source isolation contains risk while the classification is being firmed up.",
                0.82,
            ),
            (
                "escalate",
                "Escalate to SOC with full endpoint-usage snapshot",
                "escalation",
                "A named SOC handoff avoids governance drift on an active security signal.",
                0.66,
            ),
        ],
    },
]


COST_VARIANTS: list[Variant] = [
    {
        "flavor": "prompt_expansion",
        "root_cause": (
            "Cost per 1k requests climbed faster than traffic volume; unbounded prompt "
            "expansion on a new workflow is the most consistent explanation for the "
            "curve shape."
        ),
        "alt_hypothesis": (
            "A promo campaign inflating traffic mix toward higher-cost segments; "
            "period-over-period segmentation would confirm."
        ),
        "recommendations": [
            (
                "control_tuning",
                "Open control calibration review for prompt-length budgets",
                "control_tuning",
                "A prompt-length budget on this workflow caps worst-case cost without impacting normal flow.",
                0.66,
            ),
            (
                "observe_next_window",
                "Hold remediation until one more cost window is observed",
                "observation",
                "Cost curves can move temporarily with campaigns; one more window confirms structural vs transient.",
                0.54,
            ),
        ],
    },
]


FALLBACK_VARIANTS: list[Variant] = [
    {
        "flavor": "unclassified",
        "root_cause": (
            "The signal is outside Bob's pre-wired taxonomy; Bob has not narrowed this "
            "to a single driver and recommends clearer ownership before action."
        ),
        "alt_hypothesis": None,
        "recommendations": [
            (
                "route_to_owner",
                "Route to owning team for triage ownership",
                "ownership_handoff",
                "The most defensible next step is a clear ownership handoff so human triage can resolve it.",
                0.48,
            ),
        ],
    },
]


VARIANTS_BY_SIGNAL: dict[str, list[Variant]] = {
    "Drift": DRIFT_VARIANTS,
    "Latency": LATENCY_VARIANTS,
    "Grounding": GROUNDING_VARIANTS,
    "Quality": QUALITY_VARIANTS,
    "Audit": AUDIT_VARIANTS,
    "Policy": POLICY_VARIANTS,
    "Security": SECURITY_VARIANTS,
    "Cost": COST_VARIANTS,
}


OWNER_OVERRIDES = {
    "Drift": ["Model Risk Engineering", "AI Governance Office"],
    "Latency": ["Platform Reliability", "Model Risk Engineering"],
    "Grounding": ["Knowledge Systems Team", "LLM Quality Operations"],
    "Quality": ["LLM Quality Operations", "Responsible AI Review Board"],
    "Audit": ["AI Governance Office"],
    "Policy": ["Policy Compliance Team", "AI Governance Office"],
    "Security": ["Security Operations"],
    "Cost": ["Platform Reliability", "AI Governance Office"],
}


# ---------------------------------------------------------------------------
# Summary phrasing library (multiple shapes per signal, deterministic pick)
# ---------------------------------------------------------------------------

SUMMARY_TEMPLATES: dict[str, list[str]] = {
    "Drift": [
        "Bob identified a drift regression on {use_case}. {recurrence_phrase}",
        "Drift envelope on {use_case} has moved outside its validated band. {recurrence_phrase}",
        "Bob sees sustained drift elevation on {use_case} that does not match normal seasonal variance. {recurrence_phrase}",
    ],
    "Latency": [
        "Bob traced a p95 latency regression on {use_case} to a narrow slice of the inference path. {recurrence_phrase}",
        "Latency on {use_case} is outside SLA on specific peak windows. {recurrence_phrase}",
        "Bob sees a tail-latency issue on {use_case} that looks structural rather than bursty. {recurrence_phrase}",
    ],
    "Grounding": [
        "Bob sees a grounding regression on {use_case} that is correlated with retrieval freshness. {recurrence_phrase}",
        "Grounding score on {use_case} dropped on a narrow topic slice. {recurrence_phrase}",
        "Bob identified a citation-mismatch pattern on {use_case} outputs. {recurrence_phrase}",
    ],
    "Quality": [
        "Bob observed an error-rate regression on {use_case} that started within a recent prompt window. {recurrence_phrase}",
        "Unsupported-claim rate on {use_case} moved on a specific slice. {recurrence_phrase}",
    ],
    "Audit": [
        "Audit coverage on {use_case} fell below the governance floor. {recurrence_phrase}",
        "Bob sees an audit-coverage dip on {use_case} that coincides with reviewer rotation. {recurrence_phrase}",
    ],
    "Policy": [
        "Policy violations on {use_case} are concentrated on a specific surface. {recurrence_phrase}",
        "Bob sees a repeating policy-compliance pattern on {use_case}. {recurrence_phrase}",
    ],
    "Security": [
        "Bob clustered a traffic anomaly on {use_case} that warrants Cyber Risk review. {recurrence_phrase}",
        "Security anomaly count on {use_case} is outside its normal envelope. {recurrence_phrase}",
    ],
    "Cost": [
        "Bob sees a cost-per-1k regression on {use_case} that is out-pacing traffic. {recurrence_phrase}",
    ],
}


def _recurrence_phrase(similar_count: int) -> str:
    if similar_count >= 3:
        return (
            f"{similar_count} similar incidents in the last 7 days reinforce the pattern."
        )
    if similar_count == 2:
        return "Two similar incidents in the last 7 days suggest a recurring pattern."
    if similar_count == 1:
        return "One similar incident in the last 7 days partially supports the pattern."
    return "No similar incidents in the last 7 days, so Bob is treating this as a localized event."


# ---------------------------------------------------------------------------
# Confidence + status heuristics
# ---------------------------------------------------------------------------


def _confidence_tier(score: float) -> str:
    if score >= 0.72:
        return "high"
    if score >= 0.5:
        return "medium"
    return "low"


def _status_for_incident(
    incident, similar_count: int, confidence_score: float, rng: random.Random
) -> str:
    now = datetime.now(timezone.utc)
    age_hours = (now - incident.created_at).total_seconds() / 3600
    if incident.incident_status == "closed":
        return rng.choice(
            ["approved", "executed", "monitoring_outcome", "rejected"]
        )
    if incident.incident_status == "mitigated":
        return rng.choice(["approved", "monitoring_outcome", "executed"])
    # Low-confidence investigations tend to stay in draft/ready_for_review
    if confidence_score < 0.5:
        return rng.choice(["draft", "ready_for_review"])
    if incident.incident_status == "escalated" or incident.severity == "high":
        if age_hours < 48:
            return rng.choice(["awaiting_approval", "awaiting_approval", "ready_for_review"])
        return rng.choice(["approved", "monitoring_outcome"])
    if incident.incident_status == "under_review":
        return rng.choice(["ready_for_review", "awaiting_approval"])
    if age_hours < 6:
        return "draft"
    return rng.choice(["ready_for_review", "awaiting_approval", "approved"])


# ---------------------------------------------------------------------------
# Activity log generator (varied shapes + jitter)
# ---------------------------------------------------------------------------


SIGNAL_ACTIVITY_STEPS: dict[str, list[tuple[str, str]]] = {
    "Drift": [
        ("reviewed.drift_trend", "Compared drift trend against prior stable window"),
        ("reviewed.feature_space", "Inspected feature-space distribution for recent shift"),
    ],
    "Latency": [
        ("reviewed.routing_behavior", "Broke down p95 by routing path and tenant"),
        ("reviewed.dependency_latency", "Compared inference path vs downstream dependency latency"),
    ],
    "Grounding": [
        ("reviewed.retrieval_freshness", "Checked retrieval source freshness and re-indexing cadence"),
        ("reviewed.citation_match", "Sampled citation-level matches against claim text"),
    ],
    "Quality": [
        ("reviewed.prompt_change", "Diffed recent prompt template changes"),
        ("reviewed.guardrail_pattern", "Looked for guardrail-bypass shapes in user input"),
    ],
    "Audit": [
        ("reviewed.sampling_pipeline", "Checked audit sampling pipeline health"),
        ("reviewed.reviewer_capacity", "Assessed reviewer capacity vs. sampling targets"),
    ],
    "Policy": [
        ("reviewed.workflow_surface", "Segmented violations by workflow surface"),
        ("reviewed.tenant_distribution", "Checked tenant-level distribution of violations"),
    ],
    "Security": [
        ("reviewed.traffic_cluster", "Clustered traffic anomaly sources"),
        ("reviewed.endpoint_usage", "Inspected unusual endpoint-usage patterns"),
    ],
    "Cost": [
        ("reviewed.prompt_length", "Inspected prompt-length distribution for inflation"),
        ("reviewed.cache_hit_rate", "Checked caching path health"),
    ],
}


def _activity_events_for_incident(
    investigation_id: str,
    incident,
    system,
    similar_count: int,
    active_control_count: int,
    audit_coverage: float | None,
    signal: str,
    now: datetime,
    rng: random.Random,
) -> list[BobActivityEvent]:
    # Deterministic-but-varied number of analysis steps per investigation
    base_steps: list[tuple[str, str]] = [
        ("investigation.opened", "Investigation opened by Fleetrac telemetry engine"),
        (
            "reviewed.telemetry_context",
            f"Reviewed telemetry context for {system.use_case if system else incident.system_id}",
        ),
    ]
    if similar_count > 0:
        base_steps.append(
            (
                "reviewed.related_incidents",
                f"Investigated incident cluster over last 7 days ({similar_count} similar)",
            )
        )
    base_steps.append(
        (
            "reviewed.active_controls",
            f"Evaluated active controls on system ({active_control_count} relevant)",
        )
    )
    if audit_coverage is not None:
        base_steps.append(
            (
                "reviewed.audit_coverage",
                f"Checked audit coverage posture ({audit_coverage:.1f}%)",
            )
        )
    # Signal-specific step
    sig_steps = SIGNAL_ACTIVITY_STEPS.get(signal, [])
    if sig_steps:
        base_steps.append(rng.choice(sig_steps))
    if similar_count >= 2:
        base_steps.append(
            (
                "flagged.recurring_pattern",
                f"Flagged possible recurring pattern ({similar_count} in last 7d)",
            )
        )
    base_steps.append(
        (
            "draft.alternative_hypothesis",
            "Logged alternate hypothesis for reviewer consideration",
        )
    )
    base_steps.append(
        (
            "draft.recommendation",
            "Drafted remediation recommendation for human review",
        )
    )
    if similar_count >= 2:
        base_steps.append(
            (
                "suggested.control_tuning",
                "Suggested control-tuning candidate for governance review",
            )
        )
    base_steps.append(
        (
            "awaiting.owner_decision",
            "Marked remediation path as awaiting owner decision",
        )
    )

    # Distribute timestamps across the incident's lifetime with jitter
    start = incident.created_at + timedelta(seconds=rng.randint(10, 40))
    total_span_minutes = max(6.0, min(240.0, (now - start).total_seconds() / 60 * 0.9))
    events: list[BobActivityEvent] = []
    cursor = start
    spacing = total_span_minutes / max(1, len(base_steps))
    for idx, (action, detail) in enumerate(base_steps):
        jitter = rng.uniform(0.55, 1.45)
        cursor = cursor + timedelta(minutes=spacing * jitter)
        if cursor > now:
            cursor = now - timedelta(seconds=(len(base_steps) - idx) * rng.randint(4, 20))
        events.append(
            BobActivityEvent(
                id=f"{investigation_id}_evt_{idx:02d}",
                timestamp=cursor,
                action=action,
                detail=detail,
            )
        )
    return events


# ---------------------------------------------------------------------------
# Evidence builder
# ---------------------------------------------------------------------------


def _evidence_for_incident(
    investigation_id: str,
    incident,
    system,
    latest_telemetry,
    similar_count: int,
    active_controls: list,
    audit_coverage: float | None,
    signal: str,
) -> list[BobEvidence]:
    evidence: list[BobEvidence] = []
    evidence.append(
        BobEvidence(
            id=f"{investigation_id}_ev_snapshot",
            type="telemetry_snapshot",
            label="Triggering telemetry snapshot",
            detail=(
                f"Observed {incident.trigger_metric} = {incident.observed_value} "
                f"against threshold {incident.threshold}"
            ),
            reference_id=latest_telemetry.id if latest_telemetry else None,
            value=str(incident.observed_value),
        )
    )
    evidence.append(
        BobEvidence(
            id=f"{investigation_id}_ev_similar",
            type="similar_incidents",
            label="Similar incidents in last 7 days",
            detail=(
                "No recurrence detected in the last 7 days."
                if similar_count == 0
                else f"{similar_count} similar incident(s) detected in the last 7 days; "
                "recurrence pattern increases Bob's confidence in the root cause."
            ),
            value=str(similar_count),
        )
    )
    evidence.append(
        BobEvidence(
            id=f"{investigation_id}_ev_controls",
            type="active_controls",
            label="Active controls covering this system",
            detail=(
                f"{len(active_controls)} governance control(s) currently monitor this system; "
                f"triggering control {incident.rule_id} is one of them."
            ),
            value=str(len(active_controls)),
        )
    )
    if audit_coverage is not None:
        evidence.append(
            BobEvidence(
                id=f"{investigation_id}_ev_audit",
                type="audit_coverage",
                label="Audit coverage posture",
                detail=(
                    f"Current audit coverage is {audit_coverage:.1f}%, "
                    + (
                        "above the 95% governance floor."
                        if audit_coverage >= 95
                        else "below the 95% governance floor, which is itself a compliance signal."
                    )
                ),
                value=f"{audit_coverage:.1f}%",
            )
        )
    evidence.append(
        BobEvidence(
            id=f"{investigation_id}_ev_threshold",
            type="threshold_history",
            label="Control threshold posture",
            detail=(
                f"Control {incident.rule_id} fired at threshold {incident.threshold}; "
                "Bob compared this against recent fire rate to rule out miscalibration."
            ),
            reference_id=incident.rule_id,
        )
    )
    if signal == "Drift":
        evidence.append(
            BobEvidence(
                id=f"{investigation_id}_ev_drift",
                type="drift_trend",
                label="Recent drift trend",
                detail=(
                    "Drift curve shape: sustained elevation rather than a single spike, "
                    "consistent with a distribution or refresh change rather than noise."
                ),
            )
        )
    return evidence


# ---------------------------------------------------------------------------
# Helpers driven off MOCK_STORE
# ---------------------------------------------------------------------------


def _latest_telemetry_for_system(system_id: str):
    events = [e for e in MOCK_STORE["telemetry_events"] if e.system_id == system_id]
    return events[0] if events else None


def _active_controls_for_incident(incident, incidents_all, rules_all) -> list:
    system_rules = {i.rule_id for i in incidents_all if i.system_id == incident.system_id}
    return [r for r in rules_all if r.id in system_rules or r.id == incident.rule_id]


def _similar_count(incident, incidents_all, now: datetime) -> int:
    window = timedelta(days=7)
    return sum(
        1
        for i in incidents_all
        if i.id != incident.id
        and now - i.created_at <= window
        and (i.system_id == incident.system_id or i.rule_id == incident.rule_id)
    )


def _deterministic_rng(seed_key: str) -> random.Random:
    """Per-entity RNG so the same entity always produces the same variant."""
    digest = hashlib.sha256(seed_key.encode("utf-8")).hexdigest()
    seed = int(digest[:8], 16)
    return random.Random(seed)


def _pick_variant(signal: str, seed_key: str) -> Variant:
    variants = VARIANTS_BY_SIGNAL.get(signal, FALLBACK_VARIANTS)
    rng = _deterministic_rng(f"variant::{seed_key}")
    return variants[rng.randrange(len(variants))]


def _pick_summary(signal: str, seed_key: str, use_case: str, recurrence_phrase: str) -> str:
    templates = SUMMARY_TEMPLATES.get(signal, ["Bob opened an investigation on {use_case}. {recurrence_phrase}"])
    rng = _deterministic_rng(f"summary::{seed_key}")
    template = templates[rng.randrange(len(templates))]
    return template.format(use_case=use_case, recurrence_phrase=recurrence_phrase)


def _pick_owner(signal: str, default: str, seed_key: str) -> str:
    owners = OWNER_OVERRIDES.get(signal, [])
    if not owners:
        return default
    rng = _deterministic_rng(f"owner::{seed_key}")
    return owners[rng.randrange(len(owners))]


# ---------------------------------------------------------------------------
# Confidence spread
# ---------------------------------------------------------------------------


def _confidence_for_incident(incident, similar_count: int, seed_key: str) -> float:
    """Produce realistic confidence spread across the fleet.

    Bob should *not* be always-high. Recurrence and severity raise confidence,
    but fresh / low-evidence investigations stay in the medium-low band.
    """
    rng = _deterministic_rng(f"conf::{seed_key}")
    base = {"high": 0.62, "medium": 0.48, "low": 0.36}.get(incident.severity, 0.5)
    if similar_count >= 3:
        base += 0.18
    elif similar_count == 2:
        base += 0.12
    elif similar_count == 1:
        base += 0.05
    else:
        base -= 0.04
    if incident.escalation_status == "escalated":
        base += 0.05
    if incident.incident_status in ("mitigated", "closed"):
        base += 0.08
    base += rng.uniform(-0.06, 0.06)
    return max(0.28, min(0.92, round(base, 2)))


def _confidence_for_control(recent_count: int, systems_covered: int, seed_key: str) -> float:
    rng = _deterministic_rng(f"conf::{seed_key}")
    base = 0.5
    base += min(0.22, 0.035 * recent_count)
    base += min(0.12, 0.04 * systems_covered)
    base += rng.uniform(-0.06, 0.04)
    return max(0.3, min(0.9, round(base, 2)))


def _confidence_for_system(recent_count: int, signal_spread: int, seed_key: str) -> float:
    rng = _deterministic_rng(f"conf::{seed_key}")
    base = 0.52 + min(0.25, 0.05 * recent_count) + min(0.08, 0.03 * signal_spread)
    base += rng.uniform(-0.05, 0.05)
    return max(0.32, min(0.92, round(base, 2)))


# ---------------------------------------------------------------------------
# Investigation factories
# ---------------------------------------------------------------------------


def _recommendations_from_variant(
    variant: Variant,
    incident_or_owner_default: str,
    target_type: str,
    target_id: str,
    target_label: str,
    investigation_id: str,
    signal: str,
    seed_key: str,
    rec_confidence_floor: float,
) -> list[BobRecommendation]:
    rng = _deterministic_rng(f"recconf::{seed_key}")
    recs: list[BobRecommendation] = []
    for rec_idx, (rtype, title, rem_type, rationale, base_conf) in enumerate(
        variant["recommendations"]
    ):
        # Confidence jitter so not every rec reads identically
        conf = max(rec_confidence_floor, min(0.92, base_conf + rng.uniform(-0.06, 0.08)))
        approval_required = rec_idx == 0 and conf >= 0.55
        approval_status = (
            "pending" if approval_required else "not_required"
        )
        owner = _pick_owner(signal, incident_or_owner_default, f"{seed_key}::rec::{rec_idx}")
        recs.append(
            BobRecommendation(
                id=f"{investigation_id}_rec_{rec_idx:02d}",
                investigation_id=investigation_id,
                type=rtype,
                title=title,
                rationale_summary=rationale,
                target_type=target_type,  # type: ignore[arg-type]
                target_id=target_id,
                target_label=target_label,
                confidence=_confidence_tier(conf),
                confidence_score=round(conf, 2),
                owner_team=owner,
                approval_required=approval_required,
                approval_status=approval_status,  # type: ignore[arg-type]
                remediation_type=rem_type,
            )
        )
    return recs


def _build_incident_investigation(
    incident,
    systems_by_id: dict,
    rules_by_id: dict,
    incidents_all: list,
    rules_all: list,
    now: datetime,
) -> BobInvestigation:
    system = systems_by_id.get(incident.system_id)
    rule = rules_by_id.get(incident.rule_id)
    observed_field = rule.observed_field if rule else None
    signal = _signal_for_rule(incident.rule_id, observed_field)
    risk_domain = _risk_domain_for(incident.risk_category)
    similar_count = _similar_count(incident, incidents_all, now)
    active_controls = _active_controls_for_incident(incident, incidents_all, rules_all)
    latest_telemetry = _latest_telemetry_for_system(incident.system_id)
    audit_coverage = latest_telemetry.audit_coverage_pct if latest_telemetry else None

    confidence_score = _confidence_for_incident(incident, similar_count, incident.id)
    variant = _pick_variant(signal, incident.id)

    investigation_id = f"inv_{incident.id}"
    recurrence_phrase = _recurrence_phrase(similar_count)
    use_case = system.use_case if system else incident.system_id
    summary = _pick_summary(signal, incident.id, use_case, recurrence_phrase)
    why_it_matters = (
        f"This incident sits in the {risk_domain.lower()} domain. Leaving it "
        "untreated can widen policy exposure, extend reviewer burden, and erode "
        "auditability on a regulated workflow."
    )

    recommendations = _recommendations_from_variant(
        variant=variant,
        incident_or_owner_default=incident.owner_team,
        target_type="incident",
        target_id=incident.id,
        target_label=incident.title,
        investigation_id=investigation_id,
        signal=signal,
        seed_key=f"inc::{incident.id}",
        rec_confidence_floor=0.30,
    )
    top_rec = recommendations[0].id if recommendations else None

    evidence = _evidence_for_incident(
        investigation_id,
        incident,
        system,
        latest_telemetry,
        similar_count,
        active_controls,
        audit_coverage,
        signal,
    )
    rng = _deterministic_rng(f"activity::{incident.id}")
    activity = _activity_events_for_incident(
        investigation_id,
        incident,
        system,
        similar_count,
        len(active_controls),
        audit_coverage,
        signal,
        now,
        rng,
    )
    status_rng = _deterministic_rng(f"status::{incident.id}")
    status = _status_for_incident(incident, similar_count, confidence_score, status_rng)

    update_rng = _deterministic_rng(f"ts::{incident.id}")
    updated_at = now - timedelta(
        minutes=update_rng.randint(3, 60), seconds=update_rng.randint(0, 59)
    )
    last_run_at = now - timedelta(
        minutes=update_rng.randint(1, 28), seconds=update_rng.randint(0, 59)
    )

    return BobInvestigation(
        id=investigation_id,
        title=f"Investigation · {incident.title}",
        target_type="incident",
        target_id=incident.id,
        target_label=incident.title,
        status=status,
        confidence=_confidence_tier(confidence_score),
        confidence_score=confidence_score,
        summary=summary,
        likely_root_cause=variant["root_cause"],
        alternative_hypothesis=variant.get("alt_hypothesis"),
        why_it_matters=why_it_matters,
        suggested_owner=incident.owner_team,
        top_recommendation_id=top_rec,
        recurring_issue_flag=similar_count >= 2,
        evidence=evidence,
        activity=activity,
        recommendations=recommendations,
        signal_type=signal,
        risk_domain=risk_domain,
        created_at=incident.created_at,
        updated_at=updated_at,
        last_bob_run_at=last_run_at,
    )


def _build_system_investigation(
    system,
    system_incidents: list,
    now: datetime,
) -> BobInvestigation | None:
    if len(system_incidents) < 2:
        return None
    recent = [i for i in system_incidents if now - i.created_at <= timedelta(days=7)]
    if len(recent) < 2:
        return None

    signal_counts = Counter(_signal_for_rule(inc.rule_id, None) for inc in recent)
    top_signal, top_count = signal_counts.most_common(1)[0]
    signal_spread = len(signal_counts)
    confidence_score = _confidence_for_system(len(recent), signal_spread, system.id)

    investigation_id = f"inv_system_{system.id}"

    if signal_spread >= 3:
        summary = (
            f"Bob sees multi-signal governance pressure on {system.use_case}: "
            f"{len(recent)} incidents across {signal_spread} distinct signal types in the last 7 days."
        )
        likely_root_cause = (
            "Multiple overlapping signals suggest structural weakness rather than a single "
            "failure mode. Bob recommends treating this as a stability review, not a single fix."
        )
        alt_hypothesis = (
            "A short-lived perfect-storm window rather than sustained fragility; one more "
            "7-day window will disambiguate."
        )
    elif len(recent) >= 4:
        summary = (
            f"Bob observes recurring {top_signal.lower()} pressure on {system.use_case}: "
            f"{len(recent)} incidents in 7 days. Pattern is concentrated, not diffuse."
        )
        likely_root_cause = (
            f"The {top_signal.lower()} signal has dominated recent governance pressure on this "
            "system; treating repeat fires as independent events hides a structural driver."
        )
        alt_hypothesis = (
            "Control miscalibration inflating the recurrence count; a threshold review should "
            "be run in parallel with the stabilization plan."
        )
    else:
        summary = (
            f"Bob observes repeated governance pressure on {system.use_case}: "
            f"{len(recent)} incidents in the last 7 days, concentrated in {top_signal.lower()} signals."
        )
        likely_root_cause = (
            f"The pattern is {top_signal.lower()}-dominant without a sharp trigger event; Bob recommends "
            "investigating upstream behavior rather than immediate remediation."
        )
        alt_hypothesis = (
            "Multiple unrelated transient events coinciding; unlikely given the 7-day "
            "concentration but should be ruled out by reviewer."
        )

    why_it_matters = (
        f"This system is operating in {system.business_function.lower()} with "
        f"{system.regulatory_sensitivity.replace('_', ' ')} sensitivity. Sustained signal pressure "
        "increases governance exposure even before individual incidents escalate."
    )

    # Pick recommendations from dominant-signal variant, but phrase at system scope
    variant = _pick_variant(top_signal, system.id)
    system_target_label = system.use_case
    recommendations = _recommendations_from_variant(
        variant=variant,
        incident_or_owner_default=system.control_owner,
        target_type="system",
        target_id=system.id,
        target_label=system_target_label,
        investigation_id=investigation_id,
        signal=top_signal,
        seed_key=f"sys::{system.id}",
        rec_confidence_floor=0.35,
    )
    # Add a structural / monitor-first recommendation to differentiate system reviews
    recommendations.append(
        BobRecommendation(
            id=f"{investigation_id}_rec_99",
            investigation_id=investigation_id,
            type="observe_next_window",
            title="Open system stability review with owning team",
            rationale_summary=(
                "A structured stability review ensures the recurrence pattern is treated as a "
                "system-level finding rather than a sequence of individual incidents."
            ),
            target_type="system",
            target_id=system.id,
            target_label=system_target_label,
            confidence=_confidence_tier(confidence_score),
            confidence_score=confidence_score,
            owner_team=system.control_owner,
            approval_required=False,
            approval_status="not_required",
            remediation_type="review",
        )
    )

    evidence = [
        BobEvidence(
            id=f"{investigation_id}_ev_recurrence",
            type="recurrence_pattern",
            label="Recurrence pattern",
            detail=(
                f"{len(recent)} incidents in 7 days with {top_signal.lower()} as the dominant signal "
                f"({top_count} of {len(recent)})."
            ),
            value=str(len(recent)),
        ),
        BobEvidence(
            id=f"{investigation_id}_ev_spread",
            type="governance_activity",
            label="Signal spread",
            detail=(
                f"{signal_spread} distinct signal types across the last 7 days."
                + (" Multi-signal pattern reinforces a structural read." if signal_spread >= 3 else "")
            ),
            value=str(signal_spread),
        ),
        BobEvidence(
            id=f"{investigation_id}_ev_posture",
            type="governance_activity",
            label="Current posture",
            detail=f"System posture is {system.risk_posture.replace('_', ' ')}. "
            f"Owner: {system.owner}. Control owner: {system.control_owner}.",
            value=system.risk_posture,
        ),
    ]

    rng = _deterministic_rng(f"sysact::{system.id}")
    activity: list[BobActivityEvent] = []
    steps = [
        ("investigation.opened", "System-level investigation opened by recurrence trigger"),
        (
            "reviewed.related_incidents",
            f"Reviewed last {len(recent)} incidents on this system",
        ),
        (
            "reviewed.signal_behavior",
            f"Clustered signals; {top_signal.lower()} dominant across {top_count} of {len(recent)} incidents",
        ),
        (
            "reviewed.active_controls",
            f"Mapped active controls to dominant {top_signal.lower()} signal",
        ),
    ]
    if signal_spread >= 3:
        steps.append(
            (
                "flagged.structural_pattern",
                "Flagged as multi-signal structural pattern, not single failure mode",
            )
        )
    steps.append(
        ("draft.alternative_hypothesis", "Logged alternate hypothesis for reviewer consideration")
    )
    steps.append(
        ("draft.recommendation", "Drafted stabilization recommendation for reviewer approval")
    )

    start = now - timedelta(minutes=rng.randint(18, 80))
    cursor = start
    spacing_minutes = max(2, (now - start).total_seconds() / 60 / (len(steps) + 1))
    for idx, (action, detail) in enumerate(steps):
        cursor = cursor + timedelta(minutes=spacing_minutes * rng.uniform(0.6, 1.5))
        if cursor > now:
            cursor = now - timedelta(seconds=(len(steps) - idx) * 10)
        activity.append(
            BobActivityEvent(
                id=f"{investigation_id}_evt_{idx:02d}",
                timestamp=cursor,
                action=action,
                detail=detail,
            )
        )

    status = (
        "awaiting_approval"
        if system.risk_posture in ("at_risk", "critical")
        else "ready_for_review"
    )

    return BobInvestigation(
        id=investigation_id,
        title=f"System Stability Review · {system.use_case}",
        target_type="system",
        target_id=system.id,
        target_label=system.use_case,
        status=status,
        confidence=_confidence_tier(confidence_score),
        confidence_score=confidence_score,
        summary=summary,
        likely_root_cause=likely_root_cause,
        alternative_hypothesis=alt_hypothesis,
        why_it_matters=why_it_matters,
        suggested_owner=system.control_owner,
        top_recommendation_id=recommendations[0].id if recommendations else None,
        recurring_issue_flag=True,
        evidence=evidence,
        activity=activity,
        recommendations=recommendations,
        signal_type=top_signal,
        risk_domain=_risk_domain_for(recent[0].risk_category if recent else None),
        created_at=now - timedelta(minutes=rng.randint(30, 180)),
        updated_at=now - timedelta(minutes=rng.randint(2, 25)),
        last_bob_run_at=now - timedelta(minutes=rng.randint(1, 12)),
    )


def _build_control_investigation(
    rule,
    rule_incidents: list,
    systems_by_id: dict,
    now: datetime,
) -> BobInvestigation | None:
    recent = [i for i in rule_incidents if now - i.created_at <= timedelta(days=7)]
    if len(recent) < 3:
        return None

    investigation_id = f"inv_control_{rule.id}"
    systems_covered = len({i.system_id for i in recent})
    signal = _signal_for_rule(rule.id, rule.observed_field)
    confidence_score = _confidence_for_control(len(recent), systems_covered, rule.id)

    if systems_covered == 1:
        summary = (
            f"Bob flagged control {rule.name} as potentially over-triggering on a single system: "
            f"{len(recent)} incidents in 7 days concentrated on one target suggests a system-specific tuning issue."
        )
        likely_root_cause = (
            f"The control's {rule.observed_field} threshold appears aggressive for this specific "
            "system's baseline rather than mis-calibrated globally."
        )
    else:
        summary = (
            f"Bob flagged control {rule.name} as potentially over-triggering across the fleet: "
            f"{len(recent)} incidents across {systems_covered} systems in the last 7 days."
        )
        likely_root_cause = (
            f"Threshold for {rule.observed_field} appears set tighter than the "
            "steady-state baseline, producing repeat fires without a clear change in behavior."
        )

    why_it_matters = (
        "Frequently-firing controls increase reviewer fatigue and erode confidence in the "
        "governance signal. Tuning or reframing should be considered before reviewer burden "
        "outruns the control's value."
    )

    # Control recs: always tuning-first, with alternate paths
    rng = _deterministic_rng(f"ctrlrecs::{rule.id}")
    base_specs = [
        (
            "control_tuning",
            f"Tune {rule.name} threshold against recent baseline",
            "control_tuning",
            f"Control fired {len(recent)} times in 7 days across {systems_covered} system(s); the current threshold appears aggressive relative to baseline behavior.",
            0.70,
        ),
        (
            "control_tuning",
            "Split the control into narrower scope variants",
            "control_tuning",
            "A scoped variant per affected system or workflow calibrates to real behavior without weakening the global intent.",
            0.58,
        ),
        (
            "observe_next_window",
            "Observe one more telemetry window before applying tuning",
            "observation",
            "Changing a governance control without one more observation window risks masking a genuine regression.",
            0.52,
        ),
    ]
    # If the control is audit-floor related, swap the primary rec to an audit recommendation
    if signal == "Audit":
        base_specs[0] = (
            "increase_audit_sampling",
            f"Restore audit coverage before tuning {rule.name}",
            "audit_policy",
            "Compliance floor comes first; threshold tuning should not precede coverage restoration.",
            0.78,
        )

    recommendations: list[BobRecommendation] = []
    for rec_idx, (rtype, title, rem_type, rationale, base_conf) in enumerate(base_specs):
        conf = max(0.35, min(0.9, base_conf + rng.uniform(-0.06, 0.06)))
        approval_required = rec_idx == 0
        recommendations.append(
            BobRecommendation(
                id=f"{investigation_id}_rec_{rec_idx:02d}",
                investigation_id=investigation_id,
                type=rtype,  # type: ignore[arg-type]
                title=title,
                rationale_summary=rationale,
                target_type="control",
                target_id=rule.id,
                target_label=rule.name,
                confidence=_confidence_tier(conf),
                confidence_score=round(conf, 2),
                owner_team="AI Governance Office",
                approval_required=approval_required,
                approval_status="pending" if approval_required else "not_required",
                remediation_type=rem_type,
            )
        )

    evidence = [
        BobEvidence(
            id=f"{investigation_id}_ev_fires",
            type="control_fire_rate",
            label="Recent fire rate",
            detail=f"{len(recent)} incidents in the last 7 days across {systems_covered} system(s).",
            value=str(len(recent)),
        ),
        BobEvidence(
            id=f"{investigation_id}_ev_spread",
            type="governance_activity",
            label="Systems affected",
            detail=(
                "Single-system concentration; tuning can be scoped to that system."
                if systems_covered == 1
                else f"Pattern spans {systems_covered} systems, indicating fleet-wide calibration issue."
            ),
            value=str(systems_covered),
        ),
        BobEvidence(
            id=f"{investigation_id}_ev_logic",
            type="threshold_history",
            label="Control logic",
            detail=f"{rule.observed_field} {rule.comparator} {rule.threshold_field}",
        ),
    ]

    activity_rng = _deterministic_rng(f"ctrlact::{rule.id}")
    activity: list[BobActivityEvent] = []
    steps = [
        ("investigation.opened", "Control-level investigation opened by noise detector"),
        (
            "reviewed.control_fire_rate",
            f"Reviewed {len(recent)} fires across {systems_covered} system(s)",
        ),
        ("reviewed.threshold_history", "Compared current threshold against historical baseline"),
        (
            "reviewed.systems_affected",
            (
                "Confirmed single-system concentration"
                if systems_covered == 1
                else f"Confirmed fleet-wide spread across {systems_covered} systems"
            ),
        ),
        (
            "suggested.control_tuning",
            "Suggested control tuning candidate for governance review",
        ),
        ("draft.recommendation", "Drafted tuning recommendation for reviewer approval"),
        ("awaiting.owner_decision", "Marked tuning path as awaiting AI Governance Office decision"),
    ]
    start = now - timedelta(minutes=activity_rng.randint(18, 80))
    cursor = start
    spacing = max(2, (now - start).total_seconds() / 60 / (len(steps) + 1))
    for idx, (action, detail) in enumerate(steps):
        cursor = cursor + timedelta(minutes=spacing * activity_rng.uniform(0.6, 1.5))
        if cursor > now:
            cursor = now - timedelta(seconds=(len(steps) - idx) * 8)
        activity.append(
            BobActivityEvent(
                id=f"{investigation_id}_evt_{idx:02d}",
                timestamp=cursor,
                action=action,
                detail=detail,
            )
        )

    return BobInvestigation(
        id=investigation_id,
        title=f"Control Review · {rule.name}",
        target_type="control",
        target_id=rule.id,
        target_label=rule.name,
        status="awaiting_approval" if confidence_score >= 0.55 else "ready_for_review",
        confidence=_confidence_tier(confidence_score),
        confidence_score=confidence_score,
        summary=summary,
        likely_root_cause=likely_root_cause,
        alternative_hypothesis=(
            "A genuine widespread regression on this signal; a short observation window "
            "should confirm before tuning."
        ),
        why_it_matters=why_it_matters,
        suggested_owner="AI Governance Office",
        top_recommendation_id=recommendations[0].id,
        recurring_issue_flag=True,
        evidence=evidence,
        activity=activity,
        recommendations=recommendations,
        signal_type=signal,
        risk_domain=_risk_domain_for(rule.category),
        created_at=now - timedelta(minutes=activity_rng.randint(30, 120)),
        updated_at=now - timedelta(minutes=activity_rng.randint(2, 20)),
        last_bob_run_at=now - timedelta(minutes=activity_rng.randint(1, 10)),
    )


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


def generate_bob_store() -> dict[str, list]:
    now = datetime.now(timezone.utc)
    systems = MOCK_STORE["systems"]
    incidents = MOCK_STORE["incidents"]
    rules = MOCK_STORE["rules"]

    systems_by_id = {s.id: s for s in systems}
    rules_by_id = {r.id: r for r in rules}

    investigations: list[BobInvestigation] = []

    for incident in incidents:
        inv = _build_incident_investigation(
            incident,
            systems_by_id,
            rules_by_id,
            incidents,
            rules,
            now,
        )
        investigations.append(inv)

    incidents_by_system: dict[str, list] = {}
    for incident in incidents:
        incidents_by_system.setdefault(incident.system_id, []).append(incident)
    for system in systems:
        inv = _build_system_investigation(
            system, incidents_by_system.get(system.id, []), now
        )
        if inv is not None:
            investigations.append(inv)

    incidents_by_rule: dict[str, list] = {}
    for incident in incidents:
        incidents_by_rule.setdefault(incident.rule_id, []).append(incident)
    for rule in rules:
        inv = _build_control_investigation(
            rule, incidents_by_rule.get(rule.id, []), systems_by_id, now
        )
        if inv is not None:
            investigations.append(inv)

    priority = {
        "awaiting_approval": 0,
        "ready_for_review": 1,
        "draft": 2,
        "approved": 3,
        "monitoring_outcome": 4,
        "executed": 5,
        "rejected": 6,
    }
    investigations.sort(
        key=lambda inv: (priority.get(inv.status, 9), -inv.updated_at.timestamp())
    )

    recommendations: list[BobRecommendation] = [
        rec for inv in investigations for rec in inv.recommendations
    ]

    return {
        "investigations": investigations,
        "recommendations": recommendations,
    }


BOB_STORE = generate_bob_store()
