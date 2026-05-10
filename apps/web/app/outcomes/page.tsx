import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { EvidenceLibraryApp } from "@/components/evidence-library/evidence-library-app";
import { SectionTitle } from "@/components/ui/section-title";
import { getSystems } from "@/lib/api";
import { routes, routeToSystem } from "@/lib/routes";
import {
  AI_SCOPE_OPTIONS,
  normalizeAiScope,
  systemMatchesScope,
  withAiScope
} from "@/lib/ai-scope";

export default async function OutcomesPage({
  searchParams
}: {
  searchParams?: Promise<{
    system?: string;
    tab?: string;
    scope?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const systemFilter = params.system ?? null;
  const scope = normalizeAiScope(params.scope);
  const scopeLabel =
    AI_SCOPE_OPTIONS.find((opt) => opt.id === scope)?.label ?? "All";

  const systemsRes = await getSystems().catch(() => ({ items: [] as any[] }));
  const scopedSystems = (systemsRes.items ?? []).filter((s: any) =>
    systemMatchesScope(s, scope)
  );

  const scopedSystem = systemFilter
    ? scopedSystems.find((s: any) => s.id === systemFilter)
    : null;

  const outcomesBaseHref = withAiScope(routes.outcomes(), scope);

  if (systemFilter && scopedSystem) {
    return (
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href={outcomesBaseHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Evidence Library
          </Link>
          <Link
            href={routeToSystem(scopedSystem.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300"
          >
            View production context · {scopedSystem.use_case}
          </Link>
        </div>

        <SectionTitle
          eyebrow={`System · ${scopedSystem.use_case}`}
          title="Evidence Library"
          caption={`Scoped context for ${scopedSystem.use_case}. Owner-team evidence packages are indexed from the main library. Profile scope: ${scopeLabel}.`}
        />

        <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 text-[13px] text-slate-700">
          <p>
            For governed execution and remediation follow-up for this system, use production
            context and Action Center. Team-level evidence packages are unchanged below.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={routeToSystem(scopedSystem.id)}
              className="inline-flex rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-800 hover:bg-slate-50"
            >
              Open system record
            </Link>
            <Link
              href={routes.actions()}
              className="inline-flex rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-800 hover:bg-slate-50"
            >
              Action Center
            </Link>
          </div>
        </div>

        <EvidenceLibraryApp />
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <EvidenceLibraryApp />
    </section>
  );
}
