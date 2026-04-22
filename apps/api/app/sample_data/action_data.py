"""Governed Action generator for Fleetrac's Action Center.

Actions are derived from Bob recommendations plus the target system's
Access & Action Policy. The generator produces:

* one Action per Bob recommendation, typed to a real action taxonomy
  (tickets, threshold changes, rollbacks, routing changes, etc.)
* realistic approval routing and execution state based on recommendation
  confidence, incident status and the system's policy
* monitoring outcomes for executed actions (improvement, no change,
  regression) so the post-approval lifecycle feels real

It also appends rich action-lifecycle audit log entries back into MOCK_STORE
so the dashboard's governance activity feed surfaces action events.
"""

from __future__ import annotations

import hashlib
import random
from datetime import datetime, timedelta, timezone

from app.sample_data.mock_data import MOCK_STORE
from app.sample_data.bob_data import BOB_STORE
from app.sample_data.access_policy_data import POLICY_STORE
from app.schemas.actions import Action, ActionType, ExecutionState
from app.schemas.entities import AuditLogEntry


# ---------------------------------------------------------------------------
# Mapping — recommendation + remediation + signal -> action type
# ---------------------------------------------------------------------------


def _rng(seed_key: str) -> random.Random:
    digest = hashlib.sha256(seed_key.encode("utf-8")).hexdigest()
    return random.Random(int(digest[:8], 16))


# Base map from RecommendationType -> ActionType. Overlaid later with
# remediation-type hints for more specific labels.
_REC_TO_ACTION: dict[str, ActionType] = {
    "retrain_candidate": "prepare_config_suggestion",
    "rollback_candidate": "request_rollback",
    "tighten_review_gate": "prepare_review_gate_tightening",
    "retrieval_freshness_review": "create_followup_review",
    "tune_threshold": "prepare_threshold_change",
    "route_to_owner": "assign_owner",
    "upstream_data_investigation": "open_ticket",
    "escalate": "request_emergency_review_path",
    "increase_audit_sampling": "prepare_config_suggestion",
    "observe_next_window": "schedule_monitoring_window",
    "control_tuning": "prepare_threshold_change",
    "cluster_escalation": "request_emergency_review_path",
}


def _action_type_for(rec) -> ActionType:
    rem = (rec.remediation_type or "").lower()
    # Remediation-type overrides for higher fidelity
    if rem in ("traffic_shaping", "routing_change"):
        return "prepare_routing_change"
    if rem == "rollback_review":
        return "request_rollback"
    if rem == "capacity_tuning":
        return "prepare_config_suggestion"
    if rem == "audit_policy":
        return "prepare_config_suggestion"
    if rem == "review_policy":
        return "prepare_review_gate_tightening"
    if rem == "ownership_handoff":
        return "assign_owner"
    if rem == "observation":
        return "schedule_monitoring_window"
    if rem == "control_tuning":
        # Control-level control split is a more credible medium-risk action.
        if "split" in (rec.title or "").lower():
            return "prepare_control_split"
        return "prepare_threshold_change"
    if rem == "upstream_review":
        return "open_ticket"
    if rem == "escalation":
        return "request_emergency_review_path"
    return _REC_TO_ACTION.get(rec.type, "create_followup_review")


# Risk / blast-radius / reversibility metadata per action type.
_ACTION_META: dict[str, dict] = {
    "open_ticket": {
        "risk": "low",
        "reversible": True,
        "blast": "reversible_only",
        "scope": "Administrative ticket — no production change",
    },
    "create_followup_review": {
        "risk": "low",
        "reversible": True,
        "blast": "reversible_only",
        "scope": "Scheduled follow-up review — no production change",
    },
    "assign_owner": {
        "risk": "low",
        "reversible": True,
        "blast": "reversible_only",
        "scope": "Ownership handoff — no production change",
    },
    "draft_runbook": {
        "risk": "low",
        "reversible": True,
        "blast": "reversible_only",
        "scope": "Documentation change only",
    },
    "request_review": {
        "risk": "low",
        "reversible": True,
        "blast": "reversible_only",
        "scope": "Reviewer task — no production change",
    },
    "schedule_monitoring_window": {
        "risk": "low",
        "reversible": True,
        "blast": "reversible_only",
        "scope": "Observation window — no production change",
    },
    "prepare_threshold_change": {
        "risk": "medium",
        "reversible": True,
        "blast": "single_system",
        "scope": "Control threshold adjustment prepared for review",
    },
    "prepare_control_split": {
        "risk": "medium",
        "reversible": True,
        "blast": "workflow_slice",
        "scope": "Split control into scoped variants",
    },
    "prepare_config_suggestion": {
        "risk": "medium",
        "reversible": True,
        "blast": "single_system",
        "scope": "Configuration change prepared for owner review",
    },
    "prepare_routing_change": {
        "risk": "medium",
        "reversible": True,
        "blast": "workflow_slice",
        "scope": "Traffic routing change prepared for review",
    },
    "prepare_review_gate_tightening": {
        "risk": "medium",
        "reversible": True,
        "blast": "workflow_slice",
        "scope": "Human review gate tightening for affected slice",
    },
    "prepare_fallback_activation": {
        "risk": "medium",
        "reversible": True,
        "blast": "workflow_slice",
        "scope": "Fallback path activation prepared for review",
    },
    "request_rollback": {
        "risk": "high",
        "reversible": True,
        "blast": "system_fleet",
        "scope": "Rollback to last stable model version",
    },
    "request_workflow_pause": {
        "risk": "high",
        "reversible": True,
        "blast": "system_fleet",
        "scope": "Pause affected workflow until reviewed",
    },
    "request_traffic_reroute": {
        "risk": "high",
        "reversible": True,
        "blast": "system_fleet",
        "scope": "Reroute production traffic away from affected path",
    },
    "request_model_disablement": {
        "risk": "high",
        "reversible": True,
        "blast": "system_fleet",
        "scope": "Disable model endpoint while investigation continues",
    },
    "request_emergency_review_path": {
        "risk": "high",
        "reversible": True,
        "blast": "workflow_slice",
        "scope": "Route to named emergency review path",
    },
    "prepare_auto_remediation_candidate": {
        "risk": "medium",
        "reversible": True,
        "blast": "single_system",
        "scope": "Auto-remediation candidate prepared for bounded execution",
    },
}


# ---------------------------------------------------------------------------
# Approval routing
# ---------------------------------------------------------------------------


def _required_approver(action_type: str, policy, rec) -> tuple[str, str]:
    """Return (required_approver, approval_policy_text)."""
    risk = _ACTION_META[action_type]["risk"]
    if risk == "low":
        return (
            policy.primary_approver if policy else rec.owner_team,
            "Low-risk pre-approved — owner confirmation only",
        )
    if risk == "high":
        primary = "Fleet Governor"
        secondary = (policy.secondary_approver if policy else None) or "Compliance Reviewer"
        return (
            f"{primary} + {secondary}",
            f"Dual approval: {primary} and {secondary}",
        )
    # medium
    if policy and policy.secondary_approver:
        return (
            policy.primary_approver,
            f"{policy.primary_approver} approval · {policy.secondary_approver} notified",
        )
    return (
        policy.primary_approver if policy else "Fleet Governor",
        f"{policy.primary_approver if policy else 'Fleet Governor'} approval required",
    )


def _allowed_by_policy(action_type: str, policy) -> tuple[bool, str | None]:
    if policy is None:
        return (True, None)
    if action_type in (policy.allowed_actions or []):
        return (True, None)
    meta = _ACTION_META[action_type]
    risk = meta["risk"]
    if risk == "high":
        return (
            False,
            "High-risk action not enabled under current Bob operating mode; requires policy escalation",
        )
    if policy.bob_operating_mode in ("observe_only", "recommend_only"):
        return (
            False,
            "System is in recommend-only mode; Bob cannot prepare this action directly",
        )
    if policy.bob_operating_mode == "prepare_actions" and risk == "medium":
        # medium risks are preparable but not executable here; still allowed to prepare.
        return (True, None)
    return (
        False,
        "Action outside current system policy scope — requires governance review",
    )


def _execution_mode(policy, action_type: str, allowed: bool) -> str:
    if not allowed:
        return "manual_handoff"
    meta = _ACTION_META[action_type]
    risk = meta["risk"]
    if policy is None:
        return "approval_gated"
    if policy.bob_operating_mode in ("observe_only", "recommend_only"):
        return "manual_handoff"
    if policy.bob_operating_mode == "prepare_actions":
        return "bob_prepares"
    if policy.bob_operating_mode == "approval_gated_execution":
        return "approval_gated"
    if policy.bob_operating_mode == "limited_auto_execution" and risk == "low":
        return "auto_within_bounds"
    return "approval_gated"


# ---------------------------------------------------------------------------
# Lifecycle / monitoring
# ---------------------------------------------------------------------------


_MONITORING_OPTIONS = [
    ("improvement_observed", "Telemetry improvement observed in the first post-action window."),
    ("improvement_observed", "Drift envelope moved back inside validated band after action."),
    ("no_meaningful_change", "No meaningful change yet; continuing to monitor next window."),
    ("awaiting_telemetry", "Awaiting next telemetry window before drawing a conclusion."),
    ("regression_detected", "Regression detected in first post-action window; rollback is being evaluated."),
    ("rollback_recommended", "Outcome has not improved; rollback is the current recommended next step."),
    ("reviewer_signoff_pending", "Improvement observed; reviewer sign-off pending."),
]


def _lifecycle_for(
    rec,
    investigation,
    policy,
    allowed: bool,
    rng: random.Random,
    now: datetime,
) -> tuple[ExecutionState, str, str, datetime | None, datetime | None, str | None, str | None]:
    """Return (exec_state, approval_state, monitoring_status, executed_at, monitored_until, monitoring_note, rejection_reason)."""
    if not allowed:
        return (
            "drafted",
            "escalated",
            "not_applicable",
            None,
            None,
            None,
            None,
        )
    inv_status = investigation.status if investigation else "ready_for_review"
    rec_status = rec.approval_status
    action_meta = _ACTION_META[_action_type_for(rec)]

    # -- Deterministic variety ------------------------------------------------
    # Without this, actions inherit Bob's primary state too strongly and the
    # Action Center would be 95% "awaiting approval". We seed a per-recommendation
    # variety roll so a realistic fraction of recs land in approved/executed/
    # monitoring/rejected lifecycle without touching Bob's own state machine.
    variety = _rng(f"variety::{rec.id}").random()
    treat_as_approved = False
    treat_as_rejected = False
    treat_as_ready = False
    if inv_status not in ("executed", "monitoring_outcome", "approved", "rejected"):
        if rec_status == "pending":
            if variety < 0.18:
                treat_as_approved = True
            elif variety < 0.28:
                treat_as_rejected = True
            elif variety < 0.40:
                treat_as_ready = True
        elif rec_status == "not_required":
            if variety < 0.35:
                treat_as_approved = True
            elif variety < 0.45:
                treat_as_ready = True

    if treat_as_rejected or rec_status == "rejected":
        reasons = [
            "Reviewer chose to hold for one more telemetry window before acting",
            "Owner team prefers a scoped fix rather than fleet-wide change",
            "Compliance Reviewer flagged policy-sensitive surface — alternative path requested",
        ]
        return (
            "rejected",
            "rejected",
            "not_applicable",
            None,
            None,
            None,
            rng.choice(reasons),
        )

    if (
        treat_as_approved
        or rec_status == "approved"
        or inv_status in ("executed", "monitoring_outcome", "approved")
    ):
        # Build an executed / monitoring / closed lifecycle
        # Low-risk approved actions close quickly; higher-risk enter monitoring.
        executed_at = now - timedelta(minutes=rng.randint(20, 720))
        if action_meta["risk"] == "low":
            return (
                "closed",
                "approved",
                "not_applicable",
                executed_at,
                None,
                None,
                None,
            )
        status, note = rng.choice(_MONITORING_OPTIONS)
        monitored_until = executed_at + timedelta(hours=rng.randint(6, 72))
        exec_state: ExecutionState = (
            "monitoring_outcome" if status != "reviewer_signoff_pending" else "follow_up_required"
        )
        if status == "rollback_recommended":
            exec_state = "follow_up_required"
        return (
            exec_state,
            "approved",
            status,
            executed_at,
            monitored_until,
            note,
            None,
        )

    if inv_status == "awaiting_approval" or rec_status == "pending":
        return (
            "awaiting_approval",
            "pending",
            "not_applicable",
            None,
            None,
            None,
            None,
        )

    if treat_as_ready:
        # Action has been approved but is waiting for an execution window.
        return (
            "ready_to_execute",
            "approved",
            "not_applicable",
            None,
            None,
            None,
            None,
        )

    if inv_status == "ready_for_review":
        # Bob has prepared but not yet requested approval.
        state = "prepared" if action_meta["risk"] != "low" else "drafted"
        return (
            state,
            "pending" if rec.approval_required else "not_required",
            "not_applicable",
            None,
            None,
            None,
            None,
        )

    return (
        "drafted",
        "pending" if rec.approval_required else "not_required",
        "not_applicable",
        None,
        None,
        None,
        None,
    )


# ---------------------------------------------------------------------------
# Prepared change summary + title
# ---------------------------------------------------------------------------


_CHANGE_TEMPLATES: dict[str, str] = {
    "prepare_threshold_change": (
        "Bob has prepared a proposed threshold adjustment on {control} to better match the "
        "recent steady-state baseline. Change is reversible with one click and scoped to a "
        "single control."
    ),
    "prepare_control_split": (
        "Bob has prepared a proposed split of {control} into narrower scope variants so the "
        "new surface area can be calibrated independently of the global control."
    ),
    "prepare_config_suggestion": (
        "Bob has prepared a configuration change for {target} based on the triggering "
        "evidence. Change is reversible and scoped to the single target system."
    ),
    "prepare_routing_change": (
        "Bob has prepared a proposed traffic routing change to keep the affected workflow "
        "within SLA while the primary path is investigated."
    ),
    "prepare_review_gate_tightening": (
        "Bob has prepared a tightened human review gate for the affected workflow slice. "
        "Scope is narrow so non-affected traffic is not penalized."
    ),
    "prepare_fallback_activation": (
        "Bob has prepared a fallback path activation for the affected workflow. Action "
        "preserves user experience while the primary path is investigated."
    ),
    "request_rollback": (
        "Bob is requesting a rollback of {target} to the last stable model version. Rollback "
        "is reversible but has fleet-wide blast radius, so dual approval is required."
    ),
    "request_workflow_pause": (
        "Bob is requesting a temporary pause on the affected workflow until investigation "
        "completes. Pause is reversible, but customer-facing impact requires dual approval."
    ),
    "request_traffic_reroute": (
        "Bob is requesting a production traffic reroute away from the affected path. "
        "Change is reversible but requires dual approval due to blast radius."
    ),
    "request_model_disablement": (
        "Bob is requesting temporary disablement of {target} while investigation continues. "
        "Reversible but customer-facing; dual approval required."
    ),
    "request_emergency_review_path": (
        "Bob is routing this cluster to a named emergency review path with evidence "
        "package prepared for the receiving team."
    ),
    "prepare_auto_remediation_candidate": (
        "Bob has prepared a bounded auto-remediation candidate for pre-approved policy. "
        "Scope is reversible and limited to a single system."
    ),
    "open_ticket": (
        "Bob has drafted a ticket summarizing the investigation and attaching the evidence "
        "package. No production change is involved."
    ),
    "create_followup_review": (
        "Bob has scheduled a follow-up review on {target} with the investigation evidence "
        "attached. No production change."
    ),
    "assign_owner": (
        "Bob has prepared an ownership handoff to the recommended owner team with the "
        "evidence package and triage notes."
    ),
    "draft_runbook": (
        "Bob has drafted a runbook entry covering the investigation, the proposed fix, and "
        "the rollback plan. Documentation only."
    ),
    "request_review": (
        "Bob has queued a reviewer task for this investigation. No production change."
    ),
    "schedule_monitoring_window": (
        "Bob has opened a monitoring window on {target} and will re-evaluate once one more "
        "telemetry window lands. No production change."
    ),
}


def _prepared_summary(action_type: str, rec, system_name: str, rule_name: str | None) -> str:
    tpl = _CHANGE_TEMPLATES.get(action_type, rec.rationale_summary)
    return tpl.format(target=system_name, control=rule_name or "this control")


def _action_title(action_type: str, rec) -> str:
    # Keep Bob's human phrasing for the action name when possible
    return rec.title


# ---------------------------------------------------------------------------
# Audit log additions
# ---------------------------------------------------------------------------


def _audit_events_for(action: Action, rng: random.Random) -> list[AuditLogEntry]:
    events: list[AuditLogEntry] = []

    def mk(action_name: str, ts: datetime, details: str) -> AuditLogEntry:
        suffix = rng.randint(1000, 9999)
        return AuditLogEntry(
            id=f"audit_{action.id}_{action_name.split('.')[-1]}_{suffix}",
            actor="Bob (Governance Copilot)" if action_name.startswith("action.") else "Governance Workflow",
            action=action_name,
            target_type="action",
            target_id=action.id,
            details=details,
            timestamp=ts,
        )

    created = action.created_at
    updated = action.updated_at
    events.append(mk("action.drafted", created, f"Bob drafted action · {action.title}"))
    if action.approval_status in ("pending", "approved", "rejected", "escalated"):
        events.append(
            mk(
                "action.approval_requested",
                created + timedelta(minutes=rng.randint(1, 12)),
                f"Approval requested from {action.required_approver}",
            )
        )
    if action.approval_status == "approved":
        events.append(
            mk(
                "action.approved",
                updated - timedelta(minutes=rng.randint(5, 45)),
                f"Approved by {action.required_approver}",
            )
        )
        if action.execution_status in ("prepared", "ready_to_execute"):
            events.append(
                mk(
                    "action.prepared",
                    updated - timedelta(minutes=rng.randint(2, 12)),
                    f"Execution package prepared for {action.target_system_name or action.target_system_id}",
                )
            )
        if action.executed_at:
            events.append(
                mk(
                    "action.executed",
                    action.executed_at,
                    f"Action executed · {action.title}",
                )
            )
        if action.monitoring_status not in ("not_applicable", None):
            events.append(
                mk(
                    "action.monitoring_opened",
                    (action.executed_at or updated) + timedelta(minutes=rng.randint(2, 25)),
                    action.monitoring_note or "Outcome monitoring window opened",
                )
            )
        if action.monitoring_status == "no_meaningful_change":
            events.append(
                mk(
                    "action.no_improvement",
                    updated - timedelta(minutes=rng.randint(5, 20)),
                    "No meaningful change observed in post-action window",
                )
            )
        if action.monitoring_status == "rollback_recommended":
            events.append(
                mk(
                    "action.followup_scheduled",
                    updated,
                    "Rollback recommended as next step — follow-up scheduled",
                )
            )
    if action.approval_status == "rejected":
        events.append(
            mk(
                "action.rejected",
                updated,
                action.rejection_reason or "Action rejected by reviewer",
            )
        )
    if action.approval_status == "escalated":
        events.append(
            mk(
                "action.escalated",
                updated,
                action.blocked_reason or "Action escalated for governance review",
            )
        )
    return events


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------


def _target_system_for_rec(rec, investigation, systems_by_id, incidents_by_id):
    if rec.target_type == "system":
        sys_obj = systems_by_id.get(rec.target_id)
        return sys_obj, None, None
    if rec.target_type == "incident":
        inc = incidents_by_id.get(rec.target_id)
        if inc:
            sys_obj = systems_by_id.get(inc.system_id)
            return sys_obj, inc, None
    if rec.target_type == "control":
        # Pull a representative system from the investigation target id if available.
        if investigation and investigation.target_type == "control":
            # We don't have direct system from rule; pick first incident that used this rule.
            for inc in MOCK_STORE["incidents"]:
                if inc.rule_id == rec.target_id:
                    return systems_by_id.get(inc.system_id), inc, inc.rule_id
        return None, None, rec.target_id
    return None, None, None


def _build_action(
    rec,
    investigation,
    systems_by_id,
    incidents_by_id,
    rules_by_id,
    now: datetime,
) -> Action | None:
    action_type = _action_type_for(rec)
    meta = _ACTION_META[action_type]

    sys_obj, inc, ctrl_id = _target_system_for_rec(
        rec, investigation, systems_by_id, incidents_by_id
    )
    # For system/incident-targeted actions, derive related control from evidence if possible.
    related_control_id = ctrl_id
    if related_control_id is None and inc is not None:
        related_control_id = inc.rule_id
    related_incident_id = inc.id if inc else None
    target_system_id = sys_obj.id if sys_obj else None
    target_system_name = sys_obj.name if sys_obj else None
    rule_name = (
        rules_by_id.get(related_control_id).name
        if related_control_id and rules_by_id.get(related_control_id)
        else None
    )

    policy = POLICY_STORE.get(target_system_id) if target_system_id else None
    allowed, blocked_reason = _allowed_by_policy(action_type, policy)
    required_approver, approval_policy_text = _required_approver(action_type, policy, rec)
    execution_mode = _execution_mode(policy, action_type, allowed)

    rng = _rng(f"action::{rec.id}")
    (
        exec_state,
        approval_state,
        monitoring_status,
        executed_at,
        monitored_until,
        monitoring_note,
        rejection_reason,
    ) = _lifecycle_for(rec, investigation, policy, allowed, rng, now)

    # Create / update timestamps jittered off the investigation
    base_created = (
        investigation.created_at if investigation else now - timedelta(hours=rng.randint(2, 48))
    )
    created_at = base_created + timedelta(minutes=rng.randint(3, 45))
    updated_at = now - timedelta(minutes=rng.randint(2, 120))
    if executed_at:
        updated_at = max(updated_at, executed_at + timedelta(minutes=rng.randint(5, 90)))

    prepared_summary = _prepared_summary(action_type, rec, target_system_name or (sys_obj.use_case if sys_obj else "this system"), rule_name)

    alt_suggestion = None
    if approval_state == "rejected":
        alt_suggestion = (
            "Bob flagged an alternate path in the investigation; reviewer may reconsider "
            "after one more telemetry window."
        )

    execution_notes = None
    if not allowed:
        execution_notes = (
            "Action is drafted but cannot be executed under current system policy. "
            "A governance review is required to change the operating mode or approval scope."
        )
    elif execution_mode == "auto_within_bounds":
        execution_notes = "Eligible for bounded auto-execution under limited-auto policy."
    elif execution_mode == "approval_gated":
        execution_notes = "Execution will proceed immediately after approval."
    elif execution_mode == "bob_prepares":
        execution_notes = "Bob has prepared the change; human operator will execute after review."
    elif execution_mode == "manual_handoff":
        execution_notes = "Bob will not execute; action is a human handoff with full evidence package."

    return Action(
        id=f"act_{rec.id}",
        title=_action_title(action_type, rec),
        action_type=action_type,
        source_type="bob_investigation",
        source_id=investigation.id if investigation else rec.investigation_id,
        bob_investigation_id=investigation.id if investigation else rec.investigation_id,
        recommendation_id=rec.id,
        target_system_id=target_system_id,
        target_system_name=target_system_name,
        related_incident_id=related_incident_id,
        related_control_id=related_control_id,
        suggested_by="bob",
        action_scope=meta["scope"],
        recommended_owner=rec.owner_team,
        required_approver=required_approver,
        approval_policy=approval_policy_text,
        approval_status=approval_state,  # type: ignore[arg-type]
        execution_status=exec_state,
        execution_mode=execution_mode,  # type: ignore[arg-type]
        reversible=meta["reversible"],
        blast_radius=meta["blast"],  # type: ignore[arg-type]
        risk_level=meta["risk"],  # type: ignore[arg-type]
        confidence=rec.confidence,
        confidence_score=rec.confidence_score,
        allowed_by_policy=allowed,
        blocked_reason=blocked_reason,
        prepared_change_summary=prepared_summary,
        execution_notes=execution_notes,
        monitoring_status=monitoring_status,  # type: ignore[arg-type]
        monitoring_note=monitoring_note,
        rejection_reason=rejection_reason,
        alternative_suggestion=alt_suggestion,
        created_at=created_at,
        updated_at=updated_at,
        executed_at=executed_at,
        monitored_until=monitored_until,
    )


def generate_action_store() -> dict[str, list]:
    now = datetime.now(timezone.utc)
    investigations = BOB_STORE["investigations"]
    systems_by_id = {s.id: s for s in MOCK_STORE["systems"]}
    incidents_by_id = {i.id: i for i in MOCK_STORE["incidents"]}
    rules_by_id = {r.id: r for r in MOCK_STORE["rules"]}

    actions: list[Action] = []
    for inv in investigations:
        for rec in inv.recommendations:
            action = _build_action(
                rec, inv, systems_by_id, incidents_by_id, rules_by_id, now
            )
            if action is not None:
                actions.append(action)

    # Priority sort so the Action Center defaults to the most actionable items.
    priority = {
        "awaiting_approval": 0,
        "ready_to_execute": 1,
        "prepared": 2,
        "approved": 3,
        "drafted": 4,
        "monitoring_outcome": 5,
        "follow_up_required": 6,
        "executed": 7,
        "closed": 8,
        "reverted": 9,
        "rejected": 10,
    }
    actions.sort(
        key=lambda a: (
            priority.get(a.execution_status, 99),
            -a.updated_at.timestamp(),
        )
    )

    # Extend audit log with action-lifecycle events so the governance feed
    # surfaces the full Bob-recommendation-to-executed-action story.
    rng = _rng("audit")
    audit_additions: list[AuditLogEntry] = []
    for action in actions:
        audit_additions.extend(_audit_events_for(action, rng))
    MOCK_STORE["audit_logs"].extend(audit_additions)
    MOCK_STORE["audit_logs"].sort(key=lambda e: e.timestamp, reverse=True)

    return {"actions": actions}


ACTION_STORE: dict[str, list] = generate_action_store()
