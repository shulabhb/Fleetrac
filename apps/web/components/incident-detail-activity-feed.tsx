"use client";

import { useEffect, useMemo, useState } from "react";
import { ActivityFeed, type ActivityItem } from "@/components/activity-feed";
import {
  INCIDENT_DEMO_EVENT,
  readIncidentActionLog,
  type DemoIncidentActionEntry
} from "@/lib/demo-state";
import { mergeIncidentDetailActivity } from "@/lib/incident-detail-activity-merge";

export function IncidentDetailActivityFeed({
  incidentId,
  initialItems,
  compact = false,
  newestFirst = false,
  limit
}: {
  incidentId: string;
  initialItems: ActivityItem[];
  compact?: boolean;
  /** When true, sort by timestamp descending (e.g. command-column “recent”). */
  newestFirst?: boolean;
  /** Cap list length after merge/sort (sidebar). */
  limit?: number;
}) {
  const [demoEntries, setDemoEntries] = useState<DemoIncidentActionEntry[]>([]);

  useEffect(() => {
    const sync = () => {
      setDemoEntries(readIncidentActionLog().filter((i) => i.incidentId === incidentId));
    };
    sync();
    window.addEventListener(INCIDENT_DEMO_EVENT, sync as EventListener);
    return () => window.removeEventListener(INCIDENT_DEMO_EVENT, sync as EventListener);
  }, [incidentId]);

  const merged = useMemo(() => {
    let list = mergeIncidentDetailActivity(incidentId, initialItems, demoEntries);
    if (newestFirst) {
      list = [...list].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }
    if (limit != null && limit > 0) {
      list = list.slice(0, limit);
    }
    return list;
  }, [demoEntries, incidentId, initialItems, newestFirst, limit]);

  return (
    <ActivityFeed
      items={merged}
      emptyLabel="No audit entries yet."
      compact={compact}
    />
  );
}
