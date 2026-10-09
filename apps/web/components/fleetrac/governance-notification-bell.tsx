"use client";

import { useMemo } from "react";
import { NotificationBell } from "@/components/fleetrac/notification-bell";
import { useGovernanceData } from "@/hooks/use-governance-data";
import { governanceApiEnabled } from "@/lib/governance-merge";
import type { NotificationEvent } from "@/lib/governance-notification-types";
import { formatRelativeTime } from "@/lib/format";
import type { NotificationDTO } from "@/lib/governance-api";

function mapApiNotification(
  row: NotificationDTO,
  ownerByIncident: Record<string, string>
): NotificationEvent {
  const ownerTeam =
    row.owner_team ||
    (row.alias_id ? ownerByIncident[row.alias_id] : undefined) ||
    (row.incident_id ? ownerByIncident[row.incident_id] : undefined) ||
    "";
  const target = isTarget(row.target) ? row.target : "incident-queue";

  return {
    id: row.id,
    at: formatRelativeTime(new Date(row.created_at)),
    channel: "In-app",
    summary: row.message,
    ownerTeam,
    incidentId: row.alias_id || row.incident_id || undefined,
    target,
    kind: isKind(row.kind) ? row.kind : undefined,
    actionId: row.action_id || undefined
  };
}

function isTarget(value: string | null | undefined): value is NotificationEvent["target"] & string {
  return value === "incident-queue" || value === "action-center" || value === "evidence";
}

function isKind(value: string | null | undefined): value is NonNullable<NotificationEvent["kind"]> {
  return (
    value === "decision" ||
    value === "verify" ||
    value === "rollback" ||
    value === "follow_up" ||
    value === "improvement" ||
    value === "severity" ||
    value === "regression"
  );
}

export function GovernanceNotificationBell({
  scopeHref
}: {
  scopeHref: (path: string) => string;
}) {
  const { enabled, notifications, ownerQueues } = useGovernanceData();

  const events = useMemo((): NotificationEvent[] => {
    if (!governanceApiEnabled() || !enabled) {
      return [];
    }
    if (notifications.length === 0) {
      return [];
    }

    const ownerByIncident: Record<string, string> = {};
    for (const queue of Object.values(ownerQueues)) {
      for (const row of queue?.items ?? []) {
        ownerByIncident[row.id] = row.owner_team;
        if (row.alias_id) ownerByIncident[row.alias_id] = row.owner_team;
      }
    }

    return notifications.map((row) => mapApiNotification(row, ownerByIncident));
  }, [enabled, notifications, ownerQueues]);

  return <NotificationBell events={events} scopeHref={scopeHref} />;
}
