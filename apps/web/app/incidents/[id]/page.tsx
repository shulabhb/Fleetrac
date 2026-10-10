import { redirect } from "next/navigation";
import { routeToIncidentsQueue } from "@/lib/routes";

type IncidentDetailPageProps = {
  params: Promise<{ id: string }>;
};

/** Legacy incident detail — route into the unified Incident Queue workbench. */
export default async function IncidentDetailPage({ params }: IncidentDetailPageProps) {
  const { id } = await params;
  redirect(routeToIncidentsQueue({ incidentId: id }));
}
