/**
 * Action Center + Risk Detail verification UX helpers.
 *
 * Maps existing governed-action status / verification_status strings into
 * operator-facing lanes, labels, and next-step CTAs. No backend mutation.
 */

export type ActionLane =
  | "awaiting_decision"
  | "ready_to_verify"
  | "verification_result";

export type VerificationResultKind =
  | "not_started"
  | "under_verification"
  | "improved"
  | "follow_up"
  | "rollback"
  | "regression"
  | "no_material_change"
  | "rejected"
  | "policy_blocked";

export type ActionVerificationUx = {
  lane: ActionLane;
  /** Operator-facing decision state */
  decisionLabel: string;
  /** Operator-facing verification state */
  verificationLabel: string;
  /** Strong next-step CTA label */
  nextStepCta: string;
  /** Short line for Risk Detail / list meta */
  statusLine: string;
  /** Badge tone hint */
  tone: "amber" | "indigo" | "emerald" | "rose" | "slate";
  resultKind: VerificationResultKind;
  /** True when operator can still record a verification outcome */
  canRecordVerification: boolean;
  /** True when human decision (approve/reject) is still open */
  awaitingDecision: boolean;
};

type ActionLike = {
  status: string;
  verificationStatus?: string | null;
  rawVerificationStatus?: string | null;
  incidentId?: string | null;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Parse raw API verification_status into a result kind. */
export function parseVerificationResultKind(
  status: string,
  verificationRaw: string
): VerificationResultKind {
  const s = norm(status);
  const v = norm(verificationRaw);

  if (s.includes("reject")) return "rejected";
  if (s.includes("policy-blocked") || s.includes("policy blocked")) {
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
    (s.includes("monitoring") &&
      (v.includes("no material") || v.includes("follow")))
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
    // Approved with Monitoring verification = under verification unless terminal
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

export function resolveActionVerificationUx(action: ActionLike): ActionVerificationUx {
  const status = action.status ?? "";
  const raw =
    action.rawVerificationStatus ??
    action.verificationStatus ??
    "Not started";
  const kind = parseVerificationResultKind(status, raw);
  const s = norm(status);

  const awaitingDecision =
    s.includes("awaiting") || s.includes("pending") || status === "Awaiting approval";

  const terminalResult =
    kind === "improved" ||
    kind === "follow_up" ||
    kind === "rollback" ||
    kind === "regression" ||
    kind === "no_material_change" ||
    kind === "rejected" ||
    kind === "policy_blocked";

  const canRecordVerification =
    !awaitingDecision &&
    !terminalResult &&
    (s === "approved" ||
      s === "executed" ||
      s === "monitoring" ||
      kind === "under_verification");

  if (awaitingDecision) {
    return {
      lane: "awaiting_decision",
      decisionLabel: "Awaiting approval",
      verificationLabel: "Not started",
      nextStepCta: "Review decision",
      statusLine: "Governed action: awaiting approval",
      tone: "amber",
      resultKind: "not_started",
      canRecordVerification: false,
      awaitingDecision: true
    };
  }

  if (kind === "improved") {
    return {
      lane: "verification_result",
      decisionLabel: "Approved",
      verificationLabel: "Improvement observed",
      nextStepCta: "View outcome evidence",
      statusLine: "Verification: improvement observed",
      tone: "emerald",
      resultKind: "improved",
      canRecordVerification: false,
      awaitingDecision: false
    };
  }

  if (kind === "follow_up" || kind === "no_material_change") {
    return {
      lane: "verification_result",
      decisionLabel: "Approved",
      verificationLabel:
        kind === "follow_up" ? "Follow-up required" : "No material change",
      nextStepCta: "Review follow-up",
      statusLine:
        kind === "follow_up"
          ? "Verification: follow-up required"
          : "Verification: no material change",
      tone: "amber",
      resultKind: kind,
      canRecordVerification: false,
      awaitingDecision: false
    };
  }

  if (kind === "regression") {
    return {
      lane: "verification_result",
      decisionLabel: "Approved",
      verificationLabel: "Regression detected",
      nextStepCta: "Review risk",
      statusLine: "Verification: regression — critical review",
      tone: "rose",
      resultKind: "regression",
      canRecordVerification: false,
      awaitingDecision: false
    };
  }

  if (kind === "rollback") {
    return {
      lane: "verification_result",
      decisionLabel: "Approved",
      verificationLabel: "Rollback candidate",
      nextStepCta: "Review rollback path",
      statusLine: "Verification: rollback candidate",
      tone: "rose",
      resultKind: "rollback",
      canRecordVerification: false,
      awaitingDecision: false
    };
  }

  if (kind === "rejected") {
    return {
      lane: "verification_result",
      decisionLabel: "Rejected",
      verificationLabel: "Not started",
      nextStepCta: "View outcome",
      statusLine: "Governed action: rejected",
      tone: "slate",
      resultKind: "rejected",
      canRecordVerification: false,
      awaitingDecision: false
    };
  }

  if (kind === "policy_blocked") {
    return {
      lane: "verification_result",
      decisionLabel: "Policy-blocked",
      verificationLabel: "Not started",
      nextStepCta: "Review decision",
      statusLine: "Governed action: policy-blocked",
      tone: "rose",
      resultKind: "policy_blocked",
      canRecordVerification: false,
      awaitingDecision: false
    };
  }

  // Approved / monitoring / executed — verification pending or in progress
  if (kind === "under_verification" || canRecordVerification) {
    const under = kind === "under_verification" || s === "monitoring";
    return {
      lane: "ready_to_verify",
      decisionLabel: under ? "Approved — under verification" : "Approved — verify impact",
      verificationLabel: "Verification pending",
      nextStepCta: "Verify impact",
      statusLine: "Governed action: verification pending",
      tone: "indigo",
      resultKind: "under_verification",
      canRecordVerification: true,
      awaitingDecision: false
    };
  }

  return {
    lane: "ready_to_verify",
    decisionLabel: "Approved — verify impact",
    verificationLabel: "Awaiting verification",
    nextStepCta: "Verify impact",
    statusLine: "Governed action: approved — verification pending",
    tone: "indigo",
    resultKind: "under_verification",
    canRecordVerification: true,
    awaitingDecision: false
  };
}

/** Suggested verification story for flagship pitch aliases (UI guidance only). */
export type FlagshipVerifyHint = {
  preferredOutcome:
    | "improvement_observed"
    | "no_material_change"
    | "regression_detected"
    | "rollback_candidate";
  preferredLabel: string;
  story: string;
};

export const FLAGSHIP_VERIFY_HINTS: Record<string, FlagshipVerifyHint> = {
  "inc-mrm-001": {
    preferredOutcome: "improvement_observed",
    preferredLabel: "Improved",
    story:
      "Treasury output-reliability remediation — expect citation / unsupported-claim signals to drop after approval."
  },
  "inc-sec-001": {
    preferredOutcome: "rollback_candidate",
    preferredLabel: "Rollback candidate",
    story:
      "Phishing tool-governance containment is high-blast-radius — verify carefully; rollback if quarantine scope widens."
  },
  "inc-plat-003": {
    preferredOutcome: "no_material_change",
    preferredLabel: "Follow-up / no material change",
    story:
      "Customer Support provider degradation often needs an extended monitoring window after fallback routing."
  }
};

export function flagshipVerifyHint(
  incidentId: string | null | undefined
): FlagshipVerifyHint | null {
  if (!incidentId) return null;
  return FLAGSHIP_VERIFY_HINTS[incidentId] ?? null;
}

export function verificationToneClass(
  tone: ActionVerificationUx["tone"]
): string {
  switch (tone) {
    case "amber":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "indigo":
      return "bg-indigo-50 text-indigo-800 ring-indigo-200";
    case "emerald":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "rose":
      return "bg-rose-50 text-rose-800 ring-rose-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

/** Expected metric movement copy for verification checkpoint (derived, not invented metrics). */
export function expectedImpactCopy(incidentId: string | null | undefined): string {
  const hint = flagshipVerifyHint(incidentId);
  if (hint?.preferredOutcome === "improvement_observed") {
    return "Expect governed signal recurrence and unsupported-claim rate to fall in the next monitoring window.";
  }
  if (hint?.preferredOutcome === "rollback_candidate") {
    return "Expect tool-scope denials to stay contained; watch quarantine blast radius and blocked-tool attempts.";
  }
  if (hint?.preferredOutcome === "no_material_change") {
    return "Expect operation latency and routing availability to stabilize; ambiguous movement → follow-up.";
  }
  return "Compare post-approval telemetry to the pre-remediation baseline for this agent.";
}
