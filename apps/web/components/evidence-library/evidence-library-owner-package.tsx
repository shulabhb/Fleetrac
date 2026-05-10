"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  OWNER_FLEETRAC_ANALYSIS,
  packageMetaForOwner,
  riskMixLabel
} from "@/lib/evidence-library-mock";
import type { LivePackageState } from "@/lib/evidence-library-package-state";
import {
  routeToEvidenceLibraryIncidentRecord,
  routeToEvidenceLibraryTeam
} from "@/lib/routes";

function HealthMetric({
  label,
  value,
  subtext
}: {
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
      {subtext ? (
        <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{subtext}</p>
      ) : null}
    </div>
  );
}

export function EvidenceLibraryOwnerPackage({
  ownerTeam,
  scopeHref,
  livePackages
}: {
  ownerTeam: string;
  scopeHref: (path: string) => string;
  livePackages: LivePackageState;
}) {
  const router = useRouter();
  const [segment, setSegment] = useState<"active" | "resolved">("active");
  const meta = packageMetaForOwner(ownerTeam);
  const insight = meta.insight;
  const pkg = livePackages[ownerTeam] ?? { active: [], resolved: [] };
  const activeList = pkg.active;
  const resolvedList = pkg.resolved;
  const fleetrac = OWNER_FLEETRAC_ANALYSIS[ownerTeam];

  const evidenceRecordCounts = useMemo(
    () => `${activeList.length} active · ${resolvedList.length} archived`,
    [activeList.length, resolvedList.length]
  );

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
        <Link href={scopeHref(routeToEvidenceLibraryTeam())} className="hover:text-slate-800">
          Evidence Library
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
        <span className="font-medium text-slate-800">{ownerTeam}</span>
      </nav>

      <header className="space-y-0.5 border-b border-slate-100 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Owner Evidence Package
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{ownerTeam}</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-slate-600">
          Living evidence package for active governance incidents owned by this team.
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 text-[12px] text-slate-700">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <p>
            <span className="text-slate-500">Team lead:</span>{" "}
            <span className="font-medium text-slate-900">{meta.teamLead}</span>
          </p>
          <p>
            <span className="text-slate-500">Handoff:</span>{" "}
            <span className="font-medium text-slate-900">{meta.handoff}</span>
          </p>
          <p>
            <span className="text-slate-500">Assigned reviewers:</span>{" "}
            <span className="font-medium text-slate-900">{meta.reviewers}</span>
          </p>
          <p>
            <span className="text-slate-500">Evidence status:</span>{" "}
            <span className="font-medium text-slate-900">{meta.evidenceStatus}</span>
          </p>
          <p>
            <span className="text-slate-500">Last updated:</span>{" "}
            <span className="font-medium text-slate-900">{meta.lastUpdated}</span>
          </p>
          <p>
            <span className="text-slate-500">Package scope:</span>{" "}
            <span className="font-medium text-slate-900">Active incidents only</span>
          </p>
          <p className="sm:col-span-2 lg:col-span-3">
            <span className="text-slate-500">Evidence records:</span>{" "}
            <span className="font-medium text-slate-900">{evidenceRecordCounts}</span>
          </p>
        </div>
      </div>

      {insight ? (
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Package health
          </h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            <HealthMetric label="Active incidents" value={insight.open} />
            <HealthMetric label="Critical" value={insight.critical} />
            <HealthMetric label="Decisions waiting" value={insight.decisionsNeeded} />
            <HealthMetric label="Evidence records" value={activeList.length} />
            <HealthMetric label="Oldest active" value={insight.oldestEvidenceAge} />
            <HealthMetric label="Current bottleneck" value={insight.bottleneck} />
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-800 shadow-sm">
            <span className="font-semibold text-slate-500">Risk mix · </span>
            {riskMixLabel(ownerTeam)}
          </div>
        </section>
      ) : null}

      {fleetrac ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Fleetrac analysis
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-700">{fleetrac.summary}</p>
          <p className="mt-3 text-[12px] text-slate-600">
            <span className="font-semibold text-slate-800">Recommended owner action:</span>{" "}
            {fleetrac.recommendedOwnerAction}
          </p>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
        <button
          type="button"
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          onClick={() => {
            navigator.clipboard.writeText(`Owner package · ${ownerTeam}`).catch(() => {});
          }}
        >
          Copy owner summary
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          onClick={() => {
            const blob = new Blob(
              [JSON.stringify({ ownerTeam, active: activeList, resolved: resolvedList }, null, 2)],
              { type: "application/json" }
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `owner-package-${ownerTeam.replace(/\s+/g, "-")}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download mock JSON
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          onClick={() => router.refresh()}
        >
          Resync evidence
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href).catch(() => {});
          }}
        >
          Share with owner
        </button>
      </div>

      <div className="inline-flex rounded-md border border-slate-200 p-0.5">
        <button
          type="button"
          onClick={() => setSegment("active")}
          className={cn(
            "rounded px-3 py-1.5 text-[11px] font-semibold transition",
            segment === "active" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
          )}
        >
          Active incident records
        </button>
        <button
          type="button"
          onClick={() => setSegment("resolved")}
          className={cn(
            "rounded px-3 py-1.5 text-[11px] font-semibold transition",
            segment === "resolved"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-50"
          )}
        >
          Resolved archive
        </button>
      </div>

      {segment === "active" ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Active incident records
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full divide-y divide-slate-200 text-[13px]">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Incident</th>
                  <th className="px-3 py-2 text-left font-medium">System</th>
                  <th className="px-3 py-2 text-left font-medium">Risk</th>
                  <th className="px-3 py-2 text-left font-medium">Severity</th>
                  <th className="px-3 py-2 text-left font-medium">Stage</th>
                  <th className="px-3 py-2 text-left font-medium">Evidence</th>
                  <th className="px-3 py-2 text-left font-medium">Confidence</th>
                  <th className="px-3 py-2 text-left font-medium">Assigned</th>
                  <th className="px-3 py-2 text-left font-medium">Updated</th>
                  <th className="px-3 py-2 text-left font-medium">Next action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeList.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="max-w-[200px] px-3 py-2 font-medium text-slate-900">{row.title}</td>
                    <td className="px-3 py-2 text-slate-700">{row.systemName}</td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">{row.risk}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-[12px] text-rose-900">
                      {row.severity}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-700">{row.stage}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">
                      {row.evidenceCount} items
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[12px] font-medium text-slate-800">
                      {row.confidence}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-700">{row.assigned}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-[12px] text-slate-500">
                      {row.lastUpdated}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            scopeHref(routeToEvidenceLibraryIncidentRecord(row.id, ownerTeam))
                          )
                        }
                        className="text-[12px] font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2"
                      >
                        {row.nextAction}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {activeList.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-slate-500">
              No active incidents in this package.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Resolved / archived records
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-[13px]">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Incident</th>
                  <th className="px-3 py-2 text-left font-medium">System</th>
                  <th className="px-3 py-2 text-left font-medium">Outcome</th>
                  <th className="px-3 py-2 text-left font-medium">Closed at</th>
                  <th className="px-3 py-2 text-left font-medium">Evidence</th>
                  <th className="px-3 py-2 text-left font-medium">Verification result</th>
                  <th className="px-3 py-2 text-right font-medium"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resolvedList.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 font-medium text-slate-900">{row.title}</td>
                    <td className="px-3 py-2 text-slate-700">{row.systemName}</td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">{row.outcome}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-[12px] text-slate-500">
                      {row.closedAt}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-600">{row.evidenceCount} items</td>
                    <td className="px-3 py-2 text-[12px] text-slate-700">{row.verificationResult}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            scopeHref(routeToEvidenceLibraryIncidentRecord(row.id, ownerTeam))
                          )
                        }
                        className="text-[12px] font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2"
                      >
                        Open record
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {resolvedList.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-slate-500">
              No archived incidents yet.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
