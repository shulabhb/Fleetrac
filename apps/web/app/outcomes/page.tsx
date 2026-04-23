import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SectionTitle } from "@/components/ui/section-title";
import { OutcomesView } from "@/components/operations/outcomes-view";
import { getChanges, getSystems } from "@/lib/api";
import { routes, routeToSystem } from "@/lib/routes";

type SearchParams = {
  system?: string;
  tab?: string;
};

export default async function OutcomesPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const systemFilter = params.system ?? null;

  const [changesRes, systemsRes] = await Promise.all([
    getChanges(
      systemFilter ? { target_system_id: systemFilter } : undefined
    ),
    systemFilter
      ? getSystems().catch(() => ({ items: [] as any[] }))
      : Promise.resolve({ items: [] as any[] })
  ]);

  const scopedSystem = systemFilter
    ? systemsRes.items.find((s: any) => s.id === systemFilter)
    : null;

  return (
    <section className="space-y-5">
      {scopedSystem ? (
        <div className="flex items-center justify-between">
          <Link
            href={routes.outcomes()}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            All outcomes
          </Link>
          <Link
            href={routeToSystem(scopedSystem.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300"
          >
            Open system · {scopedSystem.use_case}
          </Link>
        </div>
      ) : null}

      <SectionTitle
        eyebrow={
          scopedSystem
            ? `System · ${scopedSystem.use_case}`
            : "Post-Remediation Review · Measure"
        }
        title="Outcomes"
        caption={
          scopedSystem
            ? `Post-remediation impact on ${scopedSystem.use_case}. Expected vs. actual, follow-up, and rollback.`
            : "Measured post-remediation impact. Expected vs. actual on monitored metrics."
        }
      />
      <OutcomesView
        changes={changesRes.items}
        systemFilter={systemFilter}
      />
    </section>
  );
}
