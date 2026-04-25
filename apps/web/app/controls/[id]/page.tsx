import { notFound } from "next/navigation";
import { getActions, getBobInvestigations, getIncidents, getRules } from "@/lib/api";
import { ControlDetailSurface } from "@/components/control-detail-surface";
import {
  buildControlOperationalSnapshot,
  mergeBobIntoSnapshot
} from "@/lib/control-operational-context";
import { routes, safeReturnTo } from "@/lib/routes";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
};

export default async function ControlDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const returnTo = safeReturnTo(sp.returnTo, routes.controls());
  const here = `/controls/${encodeURIComponent(id)}`;

  const [rulesRes, incidentsRes, bobRes, actionsRes] = await Promise.all([
    getRules(),
    getIncidents(),
    getBobInvestigations().catch(() => ({ items: [] as any[] })),
    getActions({ related_control_id: id }).catch(() => ({ items: [] as any[] }))
  ]);

  const rule = (rulesRes.items ?? []).find((r: any) => r.id === id);
  if (!rule) notFound();

  const bobInvestigation =
    (bobRes.items ?? []).find(
      (inv: any) => inv.target_type === "control" && inv.target_id === id
    ) ?? null;

  let snapshot = buildControlOperationalSnapshot(rule, incidentsRes.items ?? []);
  snapshot = mergeBobIntoSnapshot(snapshot, bobInvestigation);

  return (
    <ControlDetailSurface
      rule={rule}
      snapshot={snapshot}
      bobInvestigation={bobInvestigation}
      relatedActions={actionsRes.items ?? []}
      returnTo={returnTo}
      here={here}
    />
  );
}
