"use client";

import { IncidentQueueTable } from "@/components/incident-queue-table";

export function IncidentQueueWorkspace({ incidents }: { incidents: any[] }) {
  return <IncidentQueueTable incidents={incidents} />;
}
