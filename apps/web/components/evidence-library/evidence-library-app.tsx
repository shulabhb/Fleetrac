"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import {
  buildLivePackagesFromApi,
  buildTeamLibraryFromApi,
  buildTeamLibrarySummaryFromApi
} from "@/lib/governance-merge";
import { createInitialLivePackages, type LivePackageState } from "@/lib/evidence-library-package-state";
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
import { useGovernanceData } from "@/hooks/use-governance-data";
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

  const { evidenceLibrary } = useGovernanceData();
  const [livePackages, setLivePackages] = useState<LivePackageState>(() =>
    createInitialLivePackages()
  );

  useEffect(() => {
    if (evidenceLibrary) {
      setLivePackages(buildLivePackagesFromApi(evidenceLibrary));
    }
  }, [evidenceLibrary]);

  const mode = useMemo(() => resolveEvidenceMode(params), [params]);
  const ownerDecoded = params.get("owner")
    ? decodeURIComponent(String(params.get("owner")).replace(/\+/g, " "))
    : null;
  const incidentId = params.get("incidentId");

  return (
    <div className="space-y-6">
      {mode === "team-library" ? (
        <TeamLibraryView scopeHref={scopeHref} evidenceLibrary={evidenceLibrary} />
      ) : null}

      {mode === "owner-package" && ownerDecoded ? (
        <EvidenceLibraryOwnerPackage
          ownerTeam={ownerDecoded}
          scopeHref={scopeHref}
          livePackages={livePackages}
          evidenceLibrary={evidenceLibrary}
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
  scopeHref,
  evidenceLibrary
}: {
  scopeHref: (path: string) => string;
  evidenceLibrary: ReturnType<typeof useGovernanceData>["evidenceLibrary"];
}) {
  const router = useRouter();
  const apiOn = Boolean(evidenceLibrary);
  const summary = evidenceLibrary
    ? buildTeamLibrarySummaryFromApi(evidenceLibrary)
    : {
        activeOwnerPackages: 0,
        activeIncidentRecords: 0,
        awaitingReview: 0,
        underVerification: 0,
        archivedResolved: 0
      };
  const rows = evidenceLibrary ? buildTeamLibraryFromApi(evidenceLibrary) : [];

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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  {apiOn
                    ? "No evidence packages yet. Run a simulator scenario to generate incidents."
                    : "No owner packages in catalog."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.ownerTeam}
                  onClick={() =>
                    router.push(scopeHref(routeToEvidenceLibraryOwnerPackage(row.ownerTeam)))
                  }
                  className="cursor-pointer transition hover:bg-slate-50"
                >
                  <td className="px-3 py-2.5 font-medium text-slate-900">{row.ownerTeam}</td>
                  <td className="px-3 py-2.5 text-slate-600">{row.handoff}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">
                    {row.activeIncidents}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                    {row.critical}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">{row.bottleneck}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        row.evidenceStatus === "Synced"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-amber-50 text-amber-900"
                      )}
                    >
                      {row.evidenceStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-500">{row.lastUpdated}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-center text-[12px] text-slate-600">
        Select an owner team to open the living evidence package and incident records.
      </p>
      </div>
    </GovernancePageShell>
  );
}
