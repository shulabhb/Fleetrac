import { Suspense } from "react";
import { IncidentQueueWorkspace } from "@/components/incidents/incident-queue-workspace";

export default function IncidentsPage() {
  return (
    <section className="space-y-5">
      <Suspense fallback={null}>
        <IncidentQueueWorkspace />
      </Suspense>
    </section>
  );
}
