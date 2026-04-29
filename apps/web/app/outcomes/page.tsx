import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SectionTitle } from "@/components/ui/section-title";
import { OutcomesView } from "@/components/operations/outcomes-view";
import { getChanges, getSystems } from "@/lib/api";
import { routes, routeToSystem } from "@/lib/routes";
import {
  AI_SCOPE_OPTIONS,
  normalizeAiScope,
  systemMatchesScope,
  withAiScope
} from "@/lib/ai-scope";

type SearchParams = {
  system?: string;
  tab?: string;
  scope?: string;
};

export default async function OutcomesPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const systemFilter = params.system ?? null;
  const scope = normalizeAiScope(params.scope);
  const scopeLabel =
    AI_SCOPE_OPTIONS.find((opt) => opt.id === scope)?.label ?? "All";

  const [changesRes, systemsRes] = await Promise.all([
    getChanges(
      systemFilter ? { target_system_id: systemFilter } : undefined
    ),
    getSystems().catch(() => ({ items: [] as any[] }))
  ]);
  const scopedSystems = (systemsRes.items ?? []).filter((s: any) =>
    systemMatchesScope(s, scope)
  );
  const scopedSystemIds = new Set(scopedSystems.map((s: any) => s.id));
  const scopedChanges = (changesRes.items ?? []).filter((change: any) =>
    scopedSystemIds.has(change.target_system_id)
  );

  const scopedSystem = systemFilter
    ? scopedSystems.find((s: any) => s.id === systemFilter)
    : null;

  return (
    <section className="space-y-5">
      {scopedSystem ? (
        <div className="flex items-center justify-between">
          <Link
            href={withAiScope(routes.outcomes(), scope)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            All outcomes
          </Link>
          <Link
            href={routeToSystem(scopedSystem.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300"
          >
            View production context · {scopedSystem.use_case}
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
            ? `Measured post-remediation evidence for ${scopedSystem.use_case}. Close, follow up, or prepare rollback from actual impact.`
            : `Proof and verification queue for governed changes: measured outcome, follow-up, closure, and rollback evidence. Profile scope: ${scopeLabel}.`
        }
      />
      <OutcomesView
        changes={scopedChanges}
        systemFilter={systemFilter}
      />
    </section>
  );
}
