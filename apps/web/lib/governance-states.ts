import type { ChangeLifecycleState } from "@/lib/operations-types";

/**
 * Cross-surface helpers for the governed-remediation lifecycle.
 *
 * Fleetrac's governance story is:
 *   Bob drafts → Action Center governs → Outcomes measures
 *
 * These helpers keep Action Center and Outcomes using identical labels,
 * verdicts, and recommended next steps so the workflow reads consistently
 * everywhere it shows up.
 */

export type VerdictTone = "urgent" | "warn" | "ok" | "neutral" | "info";

type ChangeLike = {
  impact_status: ChangeLifecycleState | string;
  rollback_recommended?: boolean;
  follow_up_required?: boolean;
};

/** Outcome labels — single source of truth for the Change lifecycle. */
export function outcomeLabel(state: ChangeLifecycleState | string): string {
  switch (state) {
    case "improvement_observed":
      return "Improvement observed";
    case "no_material_change":
      return "No material change";
    case "regression_detected":
      return "Regression detected";
    case "rollback_candidate":
      return "Rollback candidate";
    case "follow_up_required":
      return "Follow-up required";
    case "monitoring":
      return "Under monitoring";
    case "executed":
      return "Executed · monitoring";
    case "closed":
      return "Closed";
    case "approved":
      return "Approved";
    case "proposed":
      return "Proposed";
    default:
      return String(state).replace(/_/g, " ");
  }
}

/** Tone mapping for the outcome Badge / pill. */
export function outcomeTone(
  state: ChangeLifecycleState | string
): "high" | "medium" | "low" | "info" | "neutral" | "outline" {
  switch (state) {
    case "regression_detected":
    case "rollback_candidate":
      return "high";
    case "follow_up_required":
      return "medium";
    case "improvement_observed":
      return "low";
    case "closed":
      return "low";
    case "monitoring":
    case "executed":
    case "approved":
      return "info";
    case "no_material_change":
      return "neutral";
    default:
      return "neutral";
  }
}

/**
 * A single-sentence verdict used at the top of Outcome detail and as the
 * "eyebrow sentence" in OutcomeRow. Keep it neutral, operational, and
 * non-celebratory — this is the evidence layer, not marketing.
 */
export function outcomeVerdict(c: ChangeLike): {
  sentence: string;
  tone: VerdictTone;
} {
  if (c.rollback_recommended || c.impact_status === "rollback_candidate")
    return {
      sentence:
        "Change regressed on monitored metrics; rollback is recommended.",
      tone: "urgent"
    };
  if (c.impact_status === "regression_detected")
    return {
      sentence: "Monitored metrics worsened beyond the noise threshold.",
      tone: "urgent"
    };
  if (c.impact_status === "improvement_observed")
    return {
      sentence:
        "Monitored metrics moved in the expected direction beyond noise.",
      tone: "ok"
    };
  if (c.impact_status === "no_material_change")
    return {
      sentence:
        "Monitored metrics did not move materially in either direction.",
      tone: "neutral"
    };
  if (c.impact_status === "follow_up_required" || c.follow_up_required)
    return {
      sentence:
        "Partial or ambiguous movement. Reviewer follow-up or extended monitoring required.",
      tone: "warn"
    };
  if (c.impact_status === "closed")
    return { sentence: "Outcome closed. Preserved for audit.", tone: "neutral" };
  return {
    sentence: "Outcome still under measurement. Monitoring window open.",
    tone: "info"
  };
}

/**
 * The recommended next step for a change. Same copy used on OutcomeRow,
 * Outcome detail verdict card, and Action Center rollback context row so
 * the operator sees one consistent instruction.
 */
export function outcomeNextStep(c: ChangeLike): {
  label: string;
  tone: VerdictTone;
} {
  if (c.rollback_recommended || c.impact_status === "rollback_candidate")
    return { label: "Prepare rollback request", tone: "urgent" };
  if (c.impact_status === "regression_detected")
    return { label: "Review regression with control owner", tone: "urgent" };
  if (c.follow_up_required || c.impact_status === "follow_up_required")
    return { label: "Open follow-up monitoring window", tone: "warn" };
  if (c.impact_status === "improvement_observed")
    return { label: "Close outcome with reviewer sign-off", tone: "ok" };
  if (
    c.impact_status === "no_material_change" ||
    c.impact_status === "closed"
  )
    return { label: "None — closed", tone: "neutral" };
  return { label: "Monitor to end of window", tone: "info" };
}

/** Short-form next-step label for tight row layouts. */
export function outcomeNextStepShort(c: ChangeLike): {
  label: string;
  tone: VerdictTone;
} {
  const full = outcomeNextStep(c);
  const short: Record<string, string> = {
    "Prepare rollback request": "Prepare rollback",
    "Review regression with control owner": "Review regression",
    "Open follow-up monitoring window": "Open follow-up",
    "Close outcome with reviewer sign-off": "Close outcome",
    "None — closed": "No action",
    "Monitor to end of window": "Monitor window"
  };
  return { label: short[full.label] ?? full.label, tone: full.tone };
}

export const verdictColor: Record<VerdictTone, string> = {
  urgent: "text-rose-700",
  warn: "text-amber-700",
  ok: "text-emerald-700",
  info: "text-sky-700",
  neutral: "text-slate-600"
};

export const verdictRing: Record<VerdictTone, string> = {
  urgent: "bg-rose-50 text-rose-700 ring-rose-200",
  warn: "bg-amber-50 text-amber-800 ring-amber-200",
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200"
};

/** Compute direction + percent for a metric delta. Used in multiple places. */
export function deltaDirection(d: {
  before?: number | null;
  after?: number | null;
  direction?: string;
}): "improved" | "worse" | "flat" {
  if (d.before == null || d.after == null) return "flat";
  const diff = d.after - d.before;
  const threshold = Math.abs(d.before) * 0.02;
  if (Math.abs(diff) < threshold) return "flat";
  if (d.direction === "lower_is_better") return diff < 0 ? "improved" : "worse";
  return diff > 0 ? "improved" : "worse";
}

export function deltaPct(d: {
  before?: number | null;
  after?: number | null;
}): number | null {
  if (d.before == null || d.after == null || d.before === 0) return null;
  return ((d.after - d.before) / d.before) * 100;
}
