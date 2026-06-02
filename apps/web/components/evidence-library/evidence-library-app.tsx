"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { getTeamLibrarySummary, TEAM_LIBRARY_ROWS } from "@/lib/evidence-library-mock";
import { createInitialLivePackages } from "@/lib/evidence-library-package-state";
import type { EvidenceLibraryMode } from "@/lib/routes";
import {
  normalizeAiScope,
  withAiScope,
  type AiScopeId
} from "@/lib/ai-scope";
import {
  routeToEvidenceLibraryOwnerPackage,
  routeToEvidenceLibraryTeam
} from "@/lib/routes";
import { GovernancePageShell } from "@/components/layout/governance-page-shell";
import { SummaryMini } from "@/components/ui/summary-mini";
import { EvidenceLibraryIncidentRecord } from "@/components/evidence-library/evidence-library-incident-record";
import { EvidenceLibraryOwnerPackage } from "@/components/evidence-library/evidence-library-owner-package";

function resolveEvidenceMode(sp: URLSearchParams): EvidenceLibraryMode {
  const em = sp.get("evidenceMode");
  if (
    em === "team-library" ||
    em === "owner-package" ||
    em === "incident-record"
  )
    return em;
  if (sp.get("packType") === "owner" && sp.get("owner")) return "owner-package";
  if (sp.get("packType") === "incident" && sp.get("incidentId"))
    return "incident-record";
  if (sp.get("owner") && !sp.get("incidentId") && !sp.get("system"))
    return "owner-package";
  return "team-library";
}

export function EvidenceLibraryApp() {
  const params = useSearchParams();
  const scope = normalizeAiScope(params?.get("scope") ?? undefined);
  const scopeHref = useCallback(
    (path: string) => withAiScope(path, scope as AiScopeId),
    [scope]
  );

  const [livePackages, setLivePackages] = useState(createInitialLivePackages);

  const mode = useMemo(() => resolveEvidenceMode(params), [params]);
  const ownerDecoded = params.get("owner")
    ? decodeURIComponent(String(params.get("owner")).replace(/\+/g, " "))
    : null;
  const incidentId = params.get("incidentId");

  return (
    <div className="space-y-6">
      {mode === "team-library" ? (
        <TeamLibraryView scopeHref={scopeHref} />
      ) : null}

      {mode === "owner-package" && ownerDecoded ? (
        <EvidenceLibraryOwnerPackage
          ownerTeam={ownerDecoded}
          scopeHref={scopeHref}
          livePackages={livePackages}
        />
      ) : null}

      {mode === "incident-record" && incidentId ? (
        <EvidenceLibraryIncidentRecord
          incidentId={incidentId}
          ownerTeam={ownerDecoded}
          scopeHref={scopeHref}
          livePackages={livePackages}
          setLivePackages={setLivePackages}
        />
      ) : null}
    </div>
  );
}

function TeamLibraryView({
  scopeHref
}: {
  scopeHref: (path: string) => string;
}) {
  const router = useRouter();
  const summary = getTeamLibrarySummary();

  return (
    <GovernancePageShell
      loop="measure"
      eyebrow="Measure · Evidence and verification"
      title="Evidence Library"
      subtitle={`${summary.activeOwnerPackages} owner packages · ${summary.awaitingReview} awaiting review`}
      workflowLine="Living governance evidence by owner team, incident status, and lifecycle stage"
      summary={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <SummaryMini label="Active owner packages" value={String(summary.activeOwnerPackages)} />
          <SummaryMini
            label="Active incident records"
            value={String(summary.activeIncidentRecords)}
          />
          <SummaryMini label="Awaiting review" value={String(summary.awaitingReview)} />
          <SummaryMini label="Under verification" value={String(summary.underVerification)} />
          <SummaryMini
            label="Archived / resolved"
            value={String(summary.archivedResolved)}
          />
        </div>
      }
    >
      <div className="space-y-5">

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-[13px]">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Owner Team</th>
              <th className="px-3 py-2 text-left font-medium">Handoff</th>
              <th className="px-3 py-2 text-right font-medium">Active</th>
              <th className="px-3 py-2 text-right font-medium">Critical</th>
              <th className="px-3 py-2 text-left font-medium">Bottleneck</th>
              <th className="px-3 py-2 text-left font-medium">Evidence</th>
              <th className="px-3 py-2 text-left font-medium">Updated</th>
              <th className="px-3 py-2 text-right font-medium"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {TEAM_LIBRARY_ROWS.map((row) => (
              <tr key={row.ownerTeam} className="hover:bg-slate-50/80">
                <td className="px-3 py-2.5 font-medium text-slate-900">{row.ownerTeam}</td>
                <td className="px-3 py-2.5 text-slate-600">{row.handoff}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">
                  {row.activeIncidents}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-900">
                  {row.critical}
                </td>
                <td className="max-w-[140px] px-3 py-2.5 text-[12px] text-slate-700">
                  {row.bottleneck}
                </td>
                <td className="px-3 py-2.5 text-[12px] text-slate-700">
                  {row.evidenceStatus}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-slate-600">
                  {row.lastUpdated}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(scopeHref(routeToEvidenceLibraryOwnerPackage(row.ownerTeam)))
                    }
                    className="text-[12px] font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
                  >
                    Open package
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </GovernancePageShell>
  );
}
