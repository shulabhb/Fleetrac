"""Computed lifecycle view for an incident + its primary governed action.

Read-only. Does not persist a new table. Frontend hrefs still live in the web app;
this payload is the shared stage, next step, and closure state.
"""

from __future__ import annotations

from app.db.models import GovernedActionRow, Incident


def lifecycle_view(
    incident: Incident | None,
    action: GovernedActionRow | None,
) -> dict:
    lifecycle = (incident.lifecycle if incident else "") or ""
    status = (action.status if action else "") or ""
    verification = (action.verification_status if action else "") or ""
    resolution = ((action.resolution_status if action else None) or "").strip().lower()
    s = status.lower()
    v = verification.lower()
    life = lifecycle.lower()

    def pack(
        *,
        stage: str,
        label: str,
        step: str,
        cta: str,
        destination: str,
        closure: str,
        can_close: bool,
    ) -> dict:
        return {
            "current_stage": stage,
            "current_stage_label": label,
            "next_required_step": step,
            "primary_cta": cta,
            "primary_destination": destination,
            "closure_state": closure,
            "can_close": can_close,
            "resolution_status": resolution or None,
        }

    if resolution == "rollback_required":
        return pack(
            stage="VERIFICATION_ROLLBACK",
            label="Rollback required",
            step="View rollback decision",
            cta="View rollback decision",
            destination="action_center",
            closure="open_rollback",
            can_close=False,
        )
    if resolution == "follow_up_assigned":
        return pack(
            stage="VERIFICATION_FOLLOW_UP",
            label="Follow-up assigned",
            step="View follow-up decision",
            cta="View follow-up decision",
            destination="action_center",
            closure="open_follow_up",
            can_close=False,
        )
    if resolution == "monitoring_continued":
        return pack(
            stage="VERIFICATION_FOLLOW_UP",
            label="Monitoring continued",
            step="View recorded decision",
            cta="View recorded decision",
            destination="action_center",
            closure="monitoring",
            can_close=False,
        )
    if resolution in {"externally_handled", "risk_accepted", "resolved"} or life == "closed" and resolution:
        label = {
            "externally_handled": "Resolution recorded",
            "risk_accepted": "Risk accepted",
            "resolved": "Resolved",
        }.get(resolution, "Closed")
        return pack(
            stage="CLOSED",
            label=label,
            step="View outcome evidence",
            cta="View outcome evidence",
            destination="outcomes",
            closure="closed",
            can_close=True,
        )

    if "regression" in v and "rollback" not in v and "rollback" not in s:
        return pack(
            stage="VERIFICATION_REGRESSION",
            label="Critical review required",
            step="Review risk",
            cta="Review risk",
            destination="risk_detail",
            closure="open",
            can_close=False,
        )
    if "rollback" in v or "rollback" in s:
        return pack(
            stage="VERIFICATION_ROLLBACK",
            label="Rollback review required",
            step="Review rollback path",
            cta="Review rollback path",
            destination="action_center",
            closure="open_rollback",
            can_close=False,
        )
    if "no material" in v or "follow" in v:
        return pack(
            stage="VERIFICATION_FOLLOW_UP",
            label="Follow-up required",
            step="Review follow-up",
            cta="Review follow-up",
            destination="action_center",
            closure="open_follow_up",
            can_close=False,
        )
    if "improvement" in v:
        if life == "closed" or s == "closed":
            return pack(
                stage="CLOSED",
                label="Closed",
                step="View outcome evidence",
                cta="View outcome evidence",
                destination="outcomes",
                closure="closed",
                can_close=True,
            )
        return pack(
            stage="VERIFICATION_IMPROVED",
            label="Close-ready: improvement observed",
            step="Close risk",
            cta="Close risk",
            destination="action_center",
            closure="close_ready",
            can_close=True,
        )
    if "reject" in s or "policy" in s:
        return pack(
            stage="CLOSED",
            label="Closed",
            step="View outcome evidence",
            cta="View outcome evidence",
            destination="outcomes",
            closure="closed",
            can_close=True,
        )
    if "await" in s or "pending" in s or life == "action approval":
        return pack(
            stage="DECISION_REQUIRED",
            label="Decision required",
            step="Approve or reject governed action",
            cta="Approve governed action",
            destination="action_center",
            closure="open",
            can_close=False,
        )
    if action is not None and s in {"approved", "executed", "monitoring"}:
        return pack(
            stage="APPROVED_READY_TO_VERIFY",
            label="Approved — verify impact",
            step="Verify impact",
            cta="Verify impact",
            destination="action_center",
            closure="open",
            can_close=False,
        )
    if action is not None:
        return pack(
            stage="DECISION_REQUIRED",
            label="Decision required",
            step="Approve or reject governed action",
            cta="Approve governed action",
            destination="action_center",
            closure="open",
            can_close=False,
        )
    return pack(
        stage="DETECTED",
        label="Detected",
        step="Review risk evidence",
        cta="Review risk evidence",
        destination="risk_detail",
        closure="open",
        can_close=False,
    )
