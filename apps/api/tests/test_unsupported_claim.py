from __future__ import annotations

from app.db.models import DetectionRule
from app.detection.engine import evaluate_event
from app.pipeline.normalizer import normalize_adapted
from app.slice_a.constants import RULE_ID, SIGNAL_TYPE, THRESHOLD_VALUE


def test_unsupported_claim_rule_fires_above_threshold():
    adapted = {
        "tenant_id": "tenant-demo",
        "environment": "production",
        "source_provider": "internal",
        "source_service": "svc",
        "source_type": "langgraph_trace",
        "system_id": "sys-agt-treasury-001",
        "trace_id": "t",
        "span_id": "s",
        "operation_type": "output_evaluation",
        "timestamp": "2026-06-02T14:22:04.123Z",
        "evaluation_signals": {"unsupported_claim_rate": 0.041},
    }
    event = normalize_adapted(adapted, raw_event_id="raw-x")
    rules = [
        DetectionRule(
            id=RULE_ID,
            signal_type=SIGNAL_TYPE,
            threshold_field="unsupported_claim_rate",
            threshold_operator=">",
            threshold_value=THRESHOLD_VALUE,
            severity="critical",
            enabled=True,
        )
    ]
    match = evaluate_event(event, rules)
    assert match is not None
    assert match.rule_id == RULE_ID
    assert match.metric_value > THRESHOLD_VALUE


def test_unsupported_claim_rule_silent_below_threshold():
    adapted = {
        "tenant_id": "tenant-demo",
        "environment": "production",
        "source_provider": "internal",
        "source_service": "svc",
        "source_type": "langgraph_trace",
        "system_id": "sys-agt-treasury-001",
        "trace_id": "t",
        "span_id": "s",
        "operation_type": "output_evaluation",
        "timestamp": "2026-06-02T14:22:04.123Z",
        "evaluation_signals": {"unsupported_claim_rate": 0.01},
    }
    event = normalize_adapted(adapted, raw_event_id="raw-y")
    rules = [
        DetectionRule(
            id=RULE_ID,
            signal_type=SIGNAL_TYPE,
            threshold_field="unsupported_claim_rate",
            threshold_operator=">",
            threshold_value=THRESHOLD_VALUE,
            severity="critical",
            enabled=True,
        )
    ]
    assert evaluate_event(event, rules) is None
