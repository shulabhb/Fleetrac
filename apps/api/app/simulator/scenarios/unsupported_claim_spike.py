from __future__ import annotations

from typing import Any

from app.simulator.system_profiles import build_raw_envelope
from app.slice_a.constants import SYSTEM_ID

TRACE_ID = "trc_slice_a_treasury_unsupported_claim"


def unsupported_claim_spike_sequence(system_id: str | None = None) -> list[dict[str, Any]]:
    sid = system_id or SYSTEM_ID
    evaluations = [
        {"grounding_score": 0.88, "unsupported_claim_rate": 0.01},
        {"grounding_score": 0.55, "retrieval_confidence": 0.42},
        {"grounding_score": 0.58, "unsupported_claim_rate": 0.025},
        {"grounding_score": 0.52, "unsupported_claim_rate": 0.041},
        {"missing_citation_fallback": 1.0, "unsupported_claim_rate": 0.038},
        {"grounding_score": 0.5, "unsupported_claim_rate": 0.036, "recurrence": 1.0},
    ]
    operations = [
        "model_call",
        "retrieval",
        "output_evaluation",
        "output_evaluation",
        "policy_eval",
        "output_evaluation",
    ]
    source_types = ["langgraph_trace", "langgraph_trace", "langgraph_trace", "langgraph_trace", "langgraph_trace", "langgraph_trace"]
    out: list[dict[str, Any]] = []
    for i, (op, ev, st) in enumerate(zip(operations, evaluations, source_types), start=1):
        out.append(
            build_raw_envelope(
                sid,
                seq=i,
                source_type=st,
                trace_id=TRACE_ID,
                operation=op,
                evaluation=ev,
                extra={"idempotency_key": f"slice-a:{TRACE_ID}:spn_{i:02d}"},
            )
        )
    return out
