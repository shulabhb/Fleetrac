import Link from "next/link";
import { ActivityFeed } from "@/components/activity-feed";
import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";
import { getAuditLogs } from "@/lib/api";
import { activityHrefFor } from "@/lib/activity-links";
import { routes } from "@/lib/routes";

type ActivityFilter = "all" | "incident" | "bob" | "control" | "audit" | "outreach";

function matchFilter(item: any, filter: ActivityFilter): boolean {
  if (filter === "all") return true;
  if (filter === "incident") return item.action?.startsWith("incident.");
  if (filter === "bob") return item.action?.startsWith("bob.");
  if (filter === "control") return item.action?.includes("control");
  if (filter === "audit") return item.action?.startsWith("audit.");
  if (filter === "outreach") return item.action?.startsWith("outreach.");
  return true;
}

export default async function GovernanceActivityPage({
  searchParams
}: {
  searchParams?: Promise<{ type?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const filter = (sp.type as ActivityFilter) || "all";
  const auditRes = await getAuditLogs();

  const activityItems = (auditRes.items ?? [])
    .map((entry: any) => ({
      id: entry.id,
      action: entry.action,
      details: entry.details,
      timestamp: entry.timestamp,
      targetId: entry.target_id,
      targetType: entry.target_type,
      actor: entry.actor
    }))
    .filter((item) => item.action !== "telemetry.processed")
    .filter((item) => matchFilter(item, filter))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 100);

  const tabs: Array<{ id: ActivityFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "incident", label: "Incidents" },
    { id: "bob", label: "Bob" },
    { id: "control", label: "Controls" },
    { id: "audit", label: "Audit" },
    { id: "outreach", label: "Outreach" }
  ];

  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow="Observe · govern"
        title="Recent governance activity"
        caption="Audit-linked operational events across incidents, Bob, controls, and outreach."
        actions={
          <Link
            href={routes.dashboard()}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
          >
            Back to dashboard
          </Link>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => {
          const active = tab.id === filter;
          const href = tab.id === "all" ? routes.activity() : `${routes.activity()}?type=${tab.id}`;
          return (
            <Link
              key={tab.id}
              href={href}
              className={
                active
                  ? "rounded-md border border-slate-900 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white"
                  : "rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <Card>
        <div className="max-h-[min(72vh,46rem)] overflow-y-auto overscroll-contain px-3 py-3">
          <ActivityFeed
            items={activityItems}
            hrefFor={activityHrefFor}
            emptyLabel="No governance activity in this filter."
          />
        </div>
      </Card>
    </section>
  );
}
