/**
 * Canonical incident lifecycle (API + UI). Legacy demo/localStorage values are
 * migrated on read via {@link migrateLegacyIncidentStatus}.
 */
export type IncidentLifecycleStatus = "open" | "pending" | "closed";

const LEGACY_TO_CANONICAL: Record<string, IncidentLifecycleStatus> = {
  detected: "open",
  under_review: "pending",
  escalated: "open",
  mitigated: "pending",
  closed: "closed",
  open: "open",
  pending: "pending"
};

export function migrateLegacyIncidentStatus(
  raw: string | null | undefined
): IncidentLifecycleStatus {
  if (!raw) return "open";
  if (raw === "open" || raw === "pending" || raw === "closed") return raw;
  return LEGACY_TO_CANONICAL[raw] ?? "open";
}
