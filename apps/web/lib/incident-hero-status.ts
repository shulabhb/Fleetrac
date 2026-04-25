import { migrateLegacyIncidentStatus } from "@/lib/incident-lifecycle";

export type IncidentHeroBadgeTone = "neutral" | "high" | "medium" | "low" | "info" | "outline";

export type IncidentHeroBadge = {
  key: string;
  label: string;
  tone: IncidentHeroBadgeTone;
};

/**
 * Operator-facing status chips for incident hero (lifecycle + review + escalation).
 */
export function incidentHeroStatusBadges(input: {
  incident_status: string | null | undefined;
  review_required?: boolean | null;
  escalation_status?: string | null;
}): IncidentHeroBadge[] {
  const lifecycle = migrateLegacyIncidentStatus(input.incident_status);
  const review = Boolean(input.review_required);
  const escalated = input.escalation_status === "escalated";

  if (lifecycle === "closed") {
    return [{ key: "lifecycle", label: "Closed", tone: "low" }];
  }

  const badges: IncidentHeroBadge[] = [];

  if (lifecycle === "pending") {
    badges.push({ key: "lifecycle", label: "Pending", tone: "medium" });
  } else {
    badges.push({ key: "lifecycle", label: "New", tone: "info" });
  }

  if (review) {
    badges.push({ key: "review", label: "Action required", tone: "high" });
  }

  if (escalated) {
    badges.push({ key: "escalation", label: "Escalated", tone: "high" });
  }

  return badges;
}
