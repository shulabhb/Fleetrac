/**
 * Shared incident lifecycle + next-required-step resolver.
 * State-based — not alias-hardcoded. No backend model change.
 */

export type IncidentLifecycleStage =
  | "DETECTED"
  | "EVIDENCE_REVIEW"
  | "DECISION_REQUIRED"
  | "APPROVED_READY_TO_VERIFY"
  | "VERIFICATION_IMPROVED"
  | "VERIFICATION_ROLLBACK"
  | "VERIFICATION_REGRESSION"
  | "VERIFICATION_FOLLOW_UP"
  | "CLOSED";

export type ClosureState =
  | "open"
  | "close_ready"
  | "closed"
  | "open_rollback"
  | "open_follow_up";

export type NextStepCategory =
  | "review_evidence"
  | "decision_required"
  | "verify_impact"
  | "rollback_review"
  | "follow_up"
  | "outcome_evidence"
  | "critical_review"
  | "monitoring";

export type NextStepSurface = "risk_detail" | "action_center" | "outcomes_audit";

export type NextStepUrgency = "critical" | "high" | "medium" | "low" | "neutral";

export type NextStepDestination = {
  surface: NextStepSurface;
  href: string;
  actionCenterTab?: "pending" | "ready" | "closed";
};

export type ResolvedIncidentLifecycle = {
  currentStage: IncidentLifecycleStage;
  currentStageLabel: string;
  nextRequiredStep: string;
  nextStepExplanation: string;
  primaryCtaLabel: string;
  primaryDestination: NextStepDestination;
  secondaryCtaLabel?: string;
  secondaryDestination?: NextStepDestination;
  canClose: boolean;
  closureState: ClosureState;
  urgency: NextStepUrgency;
  category: NextStepCategory;
};

/** Alias used by existing surfaces — maps 1:1 from lifecycle. */
export type ResolvedNextStep = {
  category: NextStepCategory;
  title: string;
  explanation: string;
  primaryCtaLabel: string;
  primaryDestination: NextStepDestination;
  secondaryCtaLabel?: string;
  secondaryDestination?: NextStepDestination;
  urgency: NextStepUrgency;
};

export type NextStepCtaSurface =
  | "overview"
  | "risk_detail"
  | "action_center"
  | "outcomes";

export type NextStepInput = {
  incidentId?: string | null;
  lifecycle?: string | null;
  severity?: string | null;
  actionId?: string | null;
  actionStatus?: string | null;
  verificationStatus?: string | null;
  resolutionStatus?: string | null;
  ownerTeam?: string | null;
  openIncidents?: number;
  evidenceCount?: number | null;
  outcome?: string | null;
  ctaSurface?: NextStepCtaSurface;
  /** From the API lifecycle read-model. Local rules are the fallback. */
  serverStage?: string | null;
  serverLabel?: string | null;
  serverStep?: string | null;
  serverExplanation?: string | null;
  serverCta?: string | null;
  serverDestination?: "risk_detail" | "action_center" | "outcomes" | null;
  serverClosure?: string | null;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function parseVerificationResultKind(
  status: string,
  verificationRaw: string,
  outcome?: string | null
):
  | "not_started"
  | "under_verification"
  | "improved"
  | "follow_up"
  | "rollback"
  | "regression"
  | "no_material_change"
  | "rejected"
  | "policy_blocked" {
  const s = norm(status);
  const v = norm(verificationRaw) || norm(outcome);

  if (s.includes("reject")) return "rejected";
  if (s.includes("policy-blocked") || s.includes("policy blocked") || v.includes("policy-blocked")) {
    return "policy_blocked";
  }
  if (v.includes("regression")) return "regression";
  if (v.includes("rollback") || s.includes("rollback")) {
    return "rollback";
  }
  if (v.includes("improvement") || (s.includes("closed") && v.includes("improv"))) {
    return "improved";
  }
  if (s.includes("closed") && (v.includes("improvement") || v === "complete")) {
    return "improved";
  }
  if (
    v.includes("follow") ||
    v.includes("no material") ||
    (s.includes("monitoring") && (v.includes("no material") || v.includes("follow")))
  ) {
    if (v.includes("no material")) return "no_material_change";
    if (v.includes("follow")) return "follow_up";
  }
  if (v.includes("no material")) return "no_material_change";
  if (
    v.includes("monitor") ||
    v.includes("awaiting measurement") ||
    s === "approved" ||
    s === "executed" ||
    s === "monitoring"
  ) {
    if (
      !v.includes("improvement") &&
      !v.includes("rollback") &&
      !v.includes("regression") &&
      !v.includes("no material") &&
      !v.includes("follow") &&
      v !== "complete"
    ) {
      if (s.includes("awaiting") || s.includes("pending")) return "not_started";
      return "under_verification";
    }
  }
  if (s.includes("awaiting") || s.includes("pending") || v.includes("not started")) {
    return "not_started";
  }
  if (s.includes("closed")) return "improved";
  return "not_started";
}

function riskDetailDest(incidentId: string | null | undefined): NextStepDestination {
  const id = incidentId?.trim() || "";
  const qs = new URLSearchParams();
  if (id) qs.set("incident", id);
  return {
    surface: "risk_detail",
    href: qs.toString() ? `/incidents?${qs.toString()}` : "/incidents"
  };
}

function actionCenterDest(
  tab: "pending" | "ready" | "closed",
  actionId: string | null | undefined,
  incidentId: string | null | undefined
): NextStepDestination {
  const actionKey = (actionId || incidentId || "").trim();
  const incidentKey = (incidentId || "").trim();
  const qs = new URLSearchParams();
  if (tab !== "pending") qs.set("tab", tab);
  if (actionKey) qs.set("action", actionKey);
  if (incidentKey) qs.set("incident", incidentKey);
  return {
    surface: "action_center",
    actionCenterTab: tab,
    href: qs.toString() ? `/actions?${qs.toString()}` : "/actions"
  };
}

function outcomesDest(
  incidentId: string | null | undefined,
  ownerTeam: string | null | undefined
): NextStepDestination {
  const qs = new URLSearchParams({ surface: "audit", evidenceMode: "incident-record" });
  const id = incidentId?.trim() || "";
  if (id) qs.set("incidentId", id);
  if (ownerTeam?.trim()) qs.set("owner", ownerTeam.trim());
  return {
    surface: "outcomes_audit",
    href: `/outcomes?${qs.toString()}`
  };
}

function stageToCategory(stage: IncidentLifecycleStage): NextStepCategory {
  switch (stage) {
    case "DETECTED":
    case "EVIDENCE_REVIEW":
      return "review_evidence";
    case "DECISION_REQUIRED":
      return "decision_required";
    case "APPROVED_READY_TO_VERIFY":
      return "verify_impact";
    case "VERIFICATION_ROLLBACK":
      return "rollback_review";
    case "VERIFICATION_REGRESSION":
      return "critical_review";
    case "VERIFICATION_FOLLOW_UP":
      return "follow_up";
    case "VERIFICATION_IMPROVED":
    case "CLOSED":
      return "outcome_evidence";
    default:
      return "review_evidence";
  }
}

export function resolveIncidentLifecycle(input: NextStepInput): ResolvedIncidentLifecycle {
  const incidentId = input.incidentId?.trim() || null;
  const actionId = input.actionId?.trim() || null;
  const ownerTeam = input.ownerTeam?.trim() || null;
  const lifecycle = norm(input.lifecycle);
  const severity = norm(input.severity);
  const status = input.actionStatus ?? "";
  const verification = input.verificationStatus ?? "";
  const hasAction = Boolean(actionId || status.trim());
  const kind = parseVerificationResultKind(status, verification, input.outcome);
  const resolution = norm(input.resolutionStatus);
  const s = norm(status);
  const outcomes = input.ctaSurface === "outcomes";
  const critical = severity === "critical";
  const evidenceCount = input.evidenceCount ?? 0;
  const awaitingDecision =
    hasAction &&
    (s.includes("awaiting") || s.includes("pending") || status === "Awaiting approval");
  const approvedUnverified =
    hasAction &&
    !awaitingDecision &&
    (kind === "under_verification" ||
      (kind === "not_started" &&
        (s === "approved" ||
          s === "executed" ||
          s === "monitoring" ||
          lifecycle === "verification" ||
          lifecycle === "remediation")));
  const lifecycleClosed =
    lifecycle.includes("closed") ||
    lifecycle.includes("resolved") ||
    lifecycle.includes("accepted") ||
    lifecycle.includes("superseded");
  const decisionClosed =
    kind === "rejected" ||
    kind === "policy_blocked" ||
    lifecycle.includes("accepted") ||
    lifecycle.includes("superseded");

  const pack = (partial: Omit<ResolvedIncidentLifecycle, "category">): ResolvedIncidentLifecycle => ({
    ...partial,
    category: stageToCategory(partial.currentStage)
  });

  if (input.serverStage && input.serverCta && input.serverDestination) {
    const stage = input.serverStage as IncidentLifecycleStage;
    const tab =
      stage === "APPROVED_READY_TO_VERIFY"
        ? "ready"
        : stage === "DECISION_REQUIRED"
          ? "pending"
          : "closed";
    const primaryDestination =
      input.serverDestination === "outcomes"
        ? outcomesDest(incidentId, ownerTeam)
        : input.serverDestination === "risk_detail"
          ? riskDetailDest(incidentId)
          : actionCenterDest(tab, actionId, incidentId);
    const rawClosure = input.serverClosure || "open";
    const closure: ClosureState =
      rawClosure === "closed" ||
      rawClosure === "close_ready" ||
      rawClosure === "open_rollback" ||
      rawClosure === "open_follow_up"
        ? rawClosure
        : "open";
    return pack({
      currentStage: stage,
      currentStageLabel: input.serverLabel || stage,
      nextRequiredStep: input.serverStep || input.serverCta,
      nextStepExplanation: input.serverExplanation || input.serverStep || input.serverCta,
      primaryCtaLabel:
        outcomes && input.serverCta === "Review rollback path"
          ? "Open rollback review"
          : outcomes && input.serverCta === "Review follow-up"
            ? "Open follow-up review"
            : input.serverCta,
      primaryDestination,
      canClose: closure === "closed" || closure === "close_ready",
      closureState: closure,
      urgency: critical ? "high" : "medium"
    });
  }

  if (
    !incidentId &&
    (input.openIncidents ?? 0) === 0 &&
    !hasAction &&
    !verification.trim() &&
    !norm(input.outcome)
  ) {
    return pack({
      currentStage: "CLOSED",
      currentStageLabel: "Monitoring",
      nextRequiredStep: "No required step",
      nextStepExplanation: "No threshold is breached for this owner.",
      primaryCtaLabel: "Monitoring",
      primaryDestination: { surface: "risk_detail", href: "/incidents" },
      canClose: true,
      closureState: "closed",
      urgency: "neutral"
    });
  }

  if (resolution) {
    if (resolution === "rollback_required") {
      return pack({
        currentStage: "VERIFICATION_ROLLBACK",
        currentStageLabel: "Rollback required",
        nextRequiredStep: "View rollback decision",
        nextStepExplanation:
          "Rollback required is recorded. Fleetrac did not execute rollback or change agent code.",
        primaryCtaLabel: "View rollback decision",
        primaryDestination: actionCenterDest("closed", actionId, incidentId),
        secondaryCtaLabel: "View outcome evidence",
        secondaryDestination: outcomesDest(incidentId, ownerTeam),
        canClose: false,
        closureState: "open_rollback",
        urgency: critical ? "high" : "medium"
      });
    }
    if (resolution === "follow_up_assigned") {
      return pack({
        currentStage: "VERIFICATION_FOLLOW_UP",
        currentStageLabel: "Follow-up assigned",
        nextRequiredStep: "View follow-up decision",
        nextStepExplanation: "Follow-up review is recorded. This is an operator decision, not a new action.",
        primaryCtaLabel: "View follow-up decision",
        primaryDestination: actionCenterDest("closed", actionId, incidentId),
        secondaryCtaLabel: "View outcome evidence",
        secondaryDestination: outcomesDest(incidentId, ownerTeam),
        canClose: false,
        closureState: "open_follow_up",
        urgency: "medium"
      });
    }
    if (resolution === "monitoring_continued") {
      return pack({
        currentStage: kind === "rollback" ? "VERIFICATION_ROLLBACK" : "VERIFICATION_FOLLOW_UP",
        currentStageLabel: "Monitoring continued",
        nextRequiredStep: "View recorded decision",
        nextStepExplanation: "The team chose to keep monitoring. Fleetrac recorded the decision only.",
        primaryCtaLabel: "View recorded decision",
        primaryDestination: actionCenterDest("closed", actionId, incidentId),
        secondaryCtaLabel: "View outcome evidence",
        secondaryDestination: outcomesDest(incidentId, ownerTeam),
        canClose: false,
        closureState: kind === "rollback" ? "open_rollback" : "open",
        urgency: "medium"
      });
    }
    if (resolution === "externally_handled") {
      return pack({
        currentStage: "CLOSED",
        currentStageLabel:
          kind === "rollback" ? "Rollback required — externally handled" : "Resolution recorded",
        nextRequiredStep: "View outcome evidence",
        nextStepExplanation:
          "Handled outside Fleetrac. Fleetrac recorded the decision and did not execute rollback.",
        primaryCtaLabel: "View outcome evidence",
        primaryDestination: outcomesDest(incidentId, ownerTeam),
        canClose: true,
        closureState: "closed",
        urgency: "low"
      });
    }
    if (resolution === "risk_accepted") {
      return pack({
        currentStage: "CLOSED",
        currentStageLabel: "Risk accepted",
        nextRequiredStep: "View outcome evidence",
        nextStepExplanation: "The operator accepted this risk for now. Review the recorded decision.",
        primaryCtaLabel: "View outcome evidence",
        primaryDestination: outcomesDest(incidentId, ownerTeam),
        canClose: true,
        closureState: "closed",
        urgency: "low"
      });
    }
    if (resolution === "resolved") {
      return pack({
        currentStage: "CLOSED",
        currentStageLabel: "Resolved",
        nextRequiredStep: "View outcome evidence",
        nextStepExplanation: "This risk is resolved. Review the outcome package.",
        primaryCtaLabel: "View outcome evidence",
        primaryDestination: outcomesDest(incidentId, ownerTeam),
        canClose: true,
        closureState: "closed",
        urgency: "low"
      });
    }
  }

  if (kind === "regression") {
    return pack({
      currentStage: "VERIFICATION_REGRESSION",
      currentStageLabel: "Critical review required",
      nextRequiredStep: "Review risk",
      nextStepExplanation:
        "Verification recorded a regression. Review the risk evidence before another governed change.",
      primaryCtaLabel: "Review risk",
      primaryDestination: riskDetailDest(incidentId),
      secondaryCtaLabel: "View outcome evidence",
      secondaryDestination: outcomesDest(incidentId, ownerTeam),
      canClose: false,
      closureState: "open",
      urgency: critical ? "critical" : "high"
    });
  }

  if (kind === "rollback" || s.includes("rollback") || norm(verification).includes("rollback")) {
    const rollbackCta = outcomes ? "Open rollback review" : "Review rollback path";
    return pack({
      currentStage: "VERIFICATION_ROLLBACK",
      currentStageLabel: "Rollback review required",
      nextRequiredStep: rollbackCta,
      nextStepExplanation:
        "Verification recorded a rollback candidate. The risk stays open until rollback or follow-up is recorded.",
      primaryCtaLabel: rollbackCta,
      primaryDestination: actionCenterDest("closed", actionId, incidentId),
      secondaryCtaLabel: "View outcome evidence",
      secondaryDestination: outcomesDest(incidentId, ownerTeam),
      canClose: false,
      closureState: "open_rollback",
      urgency: critical ? "critical" : "high"
    });
  }

  if (kind === "no_material_change" || kind === "follow_up") {
    const followCta = outcomes ? "Open follow-up review" : "Review follow-up";
    return pack({
      currentStage: "VERIFICATION_FOLLOW_UP",
      currentStageLabel: "Follow-up required",
      nextRequiredStep: followCta,
      nextStepExplanation:
        "Verification recorded no material change. The risk stays open until follow-up is recorded or the risk is accepted.",
      primaryCtaLabel: followCta,
      primaryDestination: actionCenterDest("closed", actionId, incidentId),
      secondaryCtaLabel: "View outcome evidence",
      secondaryDestination: outcomesDest(incidentId, ownerTeam),
      canClose: false,
      closureState: "open_follow_up",
      urgency: critical ? "high" : "medium"
    });
  }

  if (kind === "improved") {
    const closeCta = outcomes ? "Mark resolved" : "Close risk";
    return pack({
      currentStage: "VERIFICATION_IMPROVED",
      currentStageLabel: "Close-ready: improvement observed",
      nextRequiredStep: "Close risk",
      nextStepExplanation:
        "Verification recorded improvement. Review outcome evidence, then close or keep monitoring.",
      primaryCtaLabel: closeCta,
      primaryDestination: actionCenterDest("closed", actionId, incidentId),
      secondaryCtaLabel: "View outcome evidence",
      secondaryDestination: outcomesDest(incidentId, ownerTeam),
      canClose: true,
      closureState: "close_ready",
      urgency: "low"
    });
  }

  if (decisionClosed || (lifecycleClosed && !hasAction)) {
    return pack({
      currentStage: "CLOSED",
      currentStageLabel: "Closed",
      nextRequiredStep: "View outcome evidence",
      nextStepExplanation:
        kind === "rejected" || kind === "policy_blocked"
          ? "No action will proceed. Review the recorded decision and outcome evidence."
          : "This risk is resolved, accepted, or superseded.",
      primaryCtaLabel: "View outcome evidence",
      primaryDestination: outcomesDest(incidentId, ownerTeam),
      secondaryCtaLabel: "View history",
      secondaryDestination: riskDetailDest(incidentId),
      canClose: true,
      closureState: "closed",
      urgency: "low"
    });
  }

  if (awaitingDecision || lifecycle.includes("action approval")) {
    return pack({
      currentStage: "DECISION_REQUIRED",
      currentStageLabel: "Decision required",
      nextRequiredStep: "Approve or reject governed action",
      nextStepExplanation: "A governed action is waiting for an approve, reject, or block decision.",
      primaryCtaLabel: "Approve governed action",
      primaryDestination: actionCenterDest("pending", actionId, incidentId),
      secondaryCtaLabel: "Open risk detail",
      secondaryDestination: riskDetailDest(incidentId),
      canClose: false,
      closureState: "open",
      urgency: critical ? "critical" : "high"
    });
  }

  if (approvedUnverified) {
    return pack({
      currentStage: "APPROVED_READY_TO_VERIFY",
      currentStageLabel: "Approved — verify impact",
      nextRequiredStep: "Verify impact",
      nextStepExplanation: "The action is approved. Record whether post-approval telemetry moved.",
      primaryCtaLabel: "Verify impact",
      primaryDestination: actionCenterDest("ready", actionId, incidentId),
      canClose: false,
      closureState: "open",
      urgency: critical ? "high" : "medium"
    });
  }

  if (hasAction) {
    return pack({
      currentStage: "DECISION_REQUIRED",
      currentStageLabel: "Decision required",
      nextRequiredStep: "Approve or reject governed action",
      nextStepExplanation: "A governed action is waiting for an approve, reject, or block decision.",
      primaryCtaLabel: "Approve governed action",
      primaryDestination: actionCenterDest("pending", actionId, incidentId),
      secondaryCtaLabel: "Open risk detail",
      secondaryDestination: riskDetailDest(incidentId),
      canClose: false,
      closureState: "open",
      urgency: critical ? "critical" : "high"
    });
  }

  const evidencePackaged =
    evidenceCount > 0 ||
    lifecycle.includes("owner review") ||
    lifecycle.includes("evidence");

  if (evidencePackaged) {
    return pack({
      currentStage: "EVIDENCE_REVIEW",
      currentStageLabel: "Evidence review",
      nextRequiredStep: "Review risk evidence",
      nextStepExplanation:
        "Evidence is packaged. Continue review in Risk Detail, then send a governed action when ready.",
      primaryCtaLabel: "Continue review",
      primaryDestination: riskDetailDest(incidentId),
      canClose: false,
      closureState: "open",
      urgency: critical ? "high" : "medium"
    });
  }

  return pack({
    currentStage: "DETECTED",
    currentStageLabel: "Detected",
    nextRequiredStep: "Review risk evidence",
    nextStepExplanation: "Telemetry crossed a control threshold. Review the packaged risk evidence.",
    primaryCtaLabel: "Review risk evidence",
    primaryDestination: riskDetailDest(incidentId),
    canClose: false,
    closureState: "open",
    urgency: critical ? "critical" : "medium"
  });
}

export type ActionableLandingMode = "detail" | "drawer" | "list";

export type ActionableDestination = {
  destinationPage: "incidents" | "actions" | "outcomes";
  href: string;
  selectedActionId: string | null;
  selectedIncidentId: string | null;
  targetTab: "pending" | "ready" | "closed" | null;
  primaryTaskLabel: string;
  primaryCtaLabel: string;
  secondaryCtaLabel?: string;
  landingMode: ActionableLandingMode;
  fallbackBehavior: "risk_detail" | "list" | "empty";
};

export function resolveActionableDestination(input: NextStepInput): ActionableDestination {
  const life = resolveIncidentLifecycle(input);
  const dest = life.primaryDestination;
  const actionId = input.actionId?.trim() || null;
  const incidentId = input.incidentId?.trim() || null;
  const destinationPage =
    dest.surface === "action_center"
      ? "actions"
      : dest.surface === "outcomes_audit"
        ? "outcomes"
        : "incidents";
  const landingMode: ActionableLandingMode =
    dest.surface === "risk_detail"
      ? "drawer"
      : dest.surface === "action_center" && !actionId && !incidentId
        ? "list"
        : "detail";
  const fallbackBehavior =
    dest.surface === "action_center" && !actionId && !incidentId
      ? "list"
      : dest.surface === "action_center" && !actionId
        ? "risk_detail"
        : "empty";
  return {
    destinationPage,
    href: dest.href,
    selectedActionId: actionId,
    selectedIncidentId: incidentId,
    targetTab: dest.actionCenterTab ?? null,
    primaryTaskLabel: life.nextRequiredStep,
    primaryCtaLabel: life.primaryCtaLabel,
    secondaryCtaLabel: life.secondaryCtaLabel,
    landingMode,
    fallbackBehavior
  };
}

export function matchRequestedAction(
  param: string | null | undefined,
  action: { id?: string | null; incidentId?: string | null }
): boolean {
  const key = (param ?? "").trim();
  if (!key) return false;
  return action.id === key || action.incidentId === key;
}

export function resolveNextStep(input: NextStepInput): ResolvedNextStep {
  const life = resolveIncidentLifecycle(input);
  return {
    category: life.category,
    title: life.nextRequiredStep,
    explanation: life.nextStepExplanation,
    primaryCtaLabel: life.primaryCtaLabel,
    primaryDestination: life.primaryDestination,
    secondaryCtaLabel: life.secondaryCtaLabel,
    secondaryDestination: life.secondaryDestination,
    urgency: life.urgency
  };
}

export function categoryToOverviewKind(
  category: NextStepCategory
):
  | "governed_action"
  | "verify"
  | "rollback"
  | "follow_up"
  | "outcome"
  | "risk_detail"
  | "monitoring" {
  switch (category) {
    case "decision_required":
      return "governed_action";
    case "verify_impact":
      return "verify";
    case "rollback_review":
      return "rollback";
    case "follow_up":
      return "follow_up";
    case "outcome_evidence":
      return "outcome";
    case "monitoring":
      return "monitoring";
    default:
      return "risk_detail";
  }
}

export function overviewNextStep(input: NextStepInput): {
  kind: ReturnType<typeof categoryToOverviewKind>;
  label: string;
  detail: string;
  step: string;
} {
  const resolved = resolveIncidentLifecycle(input);
  return {
    kind: categoryToOverviewKind(resolved.category),
    label: resolved.primaryCtaLabel,
    detail: resolved.nextStepExplanation,
    step: resolved.nextRequiredStep
  };
}
