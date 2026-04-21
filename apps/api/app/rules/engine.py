from app.schemas.entities import TelemetryEvent


def evaluate_event(event: TelemetryEvent) -> list[str]:
    """
    Placeholder MVP rules engine.
    Returns matched rule IDs for a single telemetry event.
    """
    matched_rules: list[str] = []

    if event.latency_p95_ms and event.latency_p95_ms > 800:
        matched_rules.append("rule_latency_high")

    if event.drift_index and event.drift_index > 0.2:
        matched_rules.append("rule_drift_high")

    return matched_rules
