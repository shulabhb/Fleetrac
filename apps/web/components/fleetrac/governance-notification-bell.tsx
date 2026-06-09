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
  const ownerTeam = row.incident_id
    ? ownerByIncident[row.incident_id] ?? "Model Risk Management"
    : "Model Risk Management";
  const target = row.message.toLowerCase().includes("action")
    ? ("action-center" as const)
    : row.message.toLowerCase().includes("evidence")
      ? ("evidence" as const)
      : ("incident-queue" as const);

  return {
    id: row.id,
    at: formatRelativeTime(new Date(row.created_at)),
    channel: capitalizeChannel(row.channel),
    summary: row.message,
    ownerTeam,
    incidentId: row.incident_id ?? undefined,
    target
  };
}

function capitalizeChannel(channel: string): NotificationEvent["channel"] {
  if (channel === "slack") return "Slack";
  if (channel === "email") return "Email";
  if (channel === "in_app" || channel === "in-app") return "In-app";
  return "In-app";
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
