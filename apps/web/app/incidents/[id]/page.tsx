import { redirect } from "next/navigation";
import { findOwnerTeamForQueueIncident } from "@/lib/governance-incident-routing";
import { routeToIncidentsOwnerQueue, routes } from "@/lib/routes";

type IncidentDetailPageProps = {
  params: Promise<{ id: string }>;
};

/** Legacy incident detail — route into the unified Incident Queue workbench. */
export default async function IncidentDetailPage({ params }: IncidentDetailPageProps) {
  const { id } = await params;
  const queueOwner = findOwnerTeamForQueueIncident(id);
  if (queueOwner) {
    redirect(routeToIncidentsOwnerQueue(queueOwner, id));
  }
  redirect(routes.incidents());
}
