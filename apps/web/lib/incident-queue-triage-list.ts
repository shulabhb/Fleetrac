import { readDemoState } from "@/lib/demo-state";
import { severityRank } from "@/lib/present";

/**
 * Same default view as {@link IncidentQueueTable} when filters are at defaults:
 * demo session overlay, lifecycle “open” (non-closed), escalated → severity → newest.
 */
export function buildIncidentQueueListForTriageDock(incidents: any[]): any[] {
  const state = readDemoState();
  const overlaid = incidents.map((incident) => {
    const patch = state[incident.id];
    if (!patch) return incident;
    return {
      ...incident,
      incident_status: patch.incidentStatus,
      escalation_status: patch.escalationStatus,
      review_required: patch.reviewRequired
    };
  });

  return overlaid
    .filter((incident) => incident.incident_status !== "closed")
    .sort((a, b) => {
      const escA = a.escalation_status === "escalated" ? 1 : 0;
      const escB = b.escalation_status === "escalated" ? 1 : 0;
      if (escB !== escA) return escB - escA;
      const sev = severityRank(b.severity) - severityRank(a.severity);
      if (sev !== 0) return sev;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}
