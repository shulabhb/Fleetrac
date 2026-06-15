"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  INCIDENT_LIFECYCLE_ORDER,
  lifecycleLabel,
  type IncidentEvidenceDetail,
  type StructuredEvidenceRow
} from "@/lib/evidence-library-types";
import {
  INCIDENT_EVIDENCE_DETAILS
} from "@/lib/evidence-library-mock";
import {
  archiveIncidentInPackage,
  type LivePackageState
} from "@/lib/evidence-library-package-state";
import {
  INCIDENT_EVIDENCE_PACK_BY_ID,
  type IncidentEvidencePackMock
} from "@/lib/incident-queue-owner-review-mock";
import { handoffIncidentToActionCenter } from "@/lib/governance-api";
import { useGovernanceData } from "@/hooks/use-governance-data";
import {
  mapApiEvidenceToDetail
} from "@/lib/governance-merge";
import {
  routeToEvidenceLibraryOwnerPackage,
  routeToEvidenceLibraryTeam,
  routeToIncidentsOwnerQueue,
  routes
} from "@/lib/routes";

function fallbackStructuredFromPack(pack: IncidentEvidencePackMock): StructuredEvidenceRow[] {
  return pack.evidenceItems.map((title) => ({
    evidenceItem: title,
    source: "Evidence package",
    signal: "See incident record",
    governanceRelevance: "Governance signal recorded",
    status: "Recorded",
    timestamp: "—",
    rawLog: { packaged: true, incident_id: pack.incidentId }
  }));
}

function currentStageLabel(
  lifecycle: IncidentEvidenceDetail["lifecycleTimestamps"] | undefined,
  fallback: string
): string {
  if (!lifecycle) return fallback;
  for (const key of INCIDENT_LIFECYCLE_ORDER) {
    const step = lifecycle[key];
    if (step?.state === "current") return step.label ?? lifecycleLabel(key);
  }
  for (const key of [...INCIDENT_LIFECYCLE_ORDER].reverse()) {
    if (lifecycle[key]?.state === "done") {
      return lifecycle[key]?.label ?? lifecycleLabel(key);
    }
  }
  return fallback;
}

function mergeLifecycle(
  base: IncidentEvidenceDetail["lifecycleTimestamps"] | undefined,
  patch: IncidentEvidenceDetail["lifecycleTimestamps"] | undefined
): IncidentEvidenceDetail["lifecycleTimestamps"] {
  const out: IncidentEvidenceDetail["lifecycleTimestamps"] = { ...(base ?? {}) };
  if (!patch) return out;
  for (const key of Object.keys(patch)) {
    const k = key as keyof typeof patch;
    const p = patch[k];
    if (!p) continue;
    const existing = out[k];
    out[k] = {
      ...(existing && typeof existing === "object" ? existing : {}),
      ...p
    } as (typeof out)[typeof k];
  }
  return out;
}

export function EvidenceLibraryIncidentRecord({
  incidentId,
  ownerTeam,
  scopeHref,
  livePackages,
  setLivePackages
}: {
  incidentId: string;
  ownerTeam: string | null;
  scopeHref: (path: string) => string;
  livePackages: LivePackageState;
  setLivePackages: Dispatch<SetStateAction<LivePackageState>>;
}) {
  const router = useRouter();
  const pack = INCIDENT_EVIDENCE_PACK_BY_ID[incidentId];
  const mockDetail = INCIDENT_EVIDENCE_DETAILS[incidentId];
  const { evidenceByAlias } = useGovernanceData();
  const detail = useMemo(() => {
    const apiEvidence = evidenceByAlias[incidentId];
    if (apiEvidence) {
      return mapApiEvidenceToDetail(apiEvidence);
    }
    return undefined;
  }, [incidentId, evidenceByAlias]);
  const resolvedOwner = ownerTeam ?? pack?.ownerTeam ?? detail?.ownerTeam ?? "—";

  const resolvedArchiveRow = useMemo(() => {
    const p = livePackages[resolvedOwner];
    return p?.resolved.find((r) => r.id === incidentId);
  }, [livePackages, resolvedOwner, incidentId]);

  const isArchived = Boolean(resolvedArchiveRow);

  const [lifecycle, setLifecycle] = useState<
    IncidentEvidenceDetail["lifecycleTimestamps"] | undefined
  >(detail?.lifecycleTimestamps);
  const [decisionLabel, setDecisionLabel] = useState<string | null>(null);
  const [needsMoreEvidence, setNeedsMoreEvidence] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLifecycle(detail?.lifecycleTimestamps);
    setDecisionLabel(null);
    setNeedsMoreEvidence(false);
  }, [incidentId, detail]);

  const structuredRows: StructuredEvidenceRow[] = useMemo(() => {
    return detail?.structuredEvidence ?? [];
  }, [detail]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const subtitleLine = detail?.recordSubtitle ?? "";

  const sendToActionCenter = async () => {
    const ok = await handoffIncidentToActionCenter(incidentId);
    if (!ok) {
      showToast("Could not send to Action Center — check API connection");
      return;
    }
    showToast("Sent to Action Center");
    if (!isArchived) {
      setLifecycle((prev) =>
        mergeLifecycle(prev ?? detail?.lifecycleTimestamps, {
          action_approval: { label: "Action approval", at: "Awaiting approval", state: "current" },
          owner_review: { label: "Owner review", at: "Complete", state: "done" },
          remediation: { label: "Remediation", state: "pending" },
          verification: { label: "Verification", state: "pending" },
          closed: { label: "Closed / archived", state: "pending" }
        })
      );
    }
  };

  const approveRemediation = () => {
    setDecisionLabel("Approved");
    setNeedsMoreEvidence(false);
    setLifecycle((prev) =>
      mergeLifecycle(prev ?? detail?.lifecycleTimestamps, {
        owner_review: { label: "Owner review", at: "Complete", state: "done" },
        action_approval: { label: "Action approval", at: "Pending", state: "current" },
        remediation: { label: "Remediation", state: "pending" },
        verification: { label: "Verification", state: "pending" },
        closed: { label: "Closed / archived", state: "pending" }
      })
    );
    showToast("Remediation approved");
  };

  const requestMoreEvidence = () => {
    setDecisionLabel("More evidence requested");
    setNeedsMoreEvidence(true);
    setLifecycle((prev) =>
      mergeLifecycle(prev ?? detail?.lifecycleTimestamps, {
        owner_review: { label: "Owner review", at: "In progress", state: "current" }
      })
    );
    showToast("More evidence requested");
  };

  const markFalsePositive = () => {
    if (!detail || resolvedOwner === "—") return;
    setDecisionLabel("False positive");
    setLivePackages((prev) =>
      archiveIncidentInPackage(prev, resolvedOwner, incidentId, {
        title: detail.title,
        systemName: detail.systemName,
        outcome: "False positive",
        evidenceCount: structuredRows.length,
        verificationResult: "Closed without material risk"
      })
    );
    showToast("Incident moved to resolved archive");
    router.push(scopeHref(routeToEvidenceLibraryOwnerPackage(resolvedOwner)));
  };

  if (!detail) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center shadow-sm">
        <p className="text-[13px] text-slate-600">
          No evidence record for <span className="font-medium text-slate-900">{incidentId}</span> yet.
          Run a simulator pitch to generate governed evidence from live logs.
        </p>
        <Link
          href={scopeHref(routeToEvidenceLibraryTeam())}
          className="mt-3 inline-block text-[12px] font-semibold text-slate-800 hover:underline"
        >
          Back to Evidence Library
        </Link>
      </div>
    );
  }

  const title = detail.title;
  const summary = detail.summary ?? "";
  const timelineSource = lifecycle ?? detail.lifecycleTimestamps;
  const stageDisplay = currentStageLabel(
    timelineSource,
    detail.recordSubtitle?.split(" · ").pop() ?? "—"
  );
  const recordKind = isArchived ? "Resolved" : "Active";
  const handoffReady = decisionLabel === "Approved";

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
        <Link href={scopeHref(routeToEvidenceLibraryTeam())} className="hover:text-slate-800">
          Evidence Library
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
        <Link
          href={scopeHref(routeToEvidenceLibraryOwnerPackage(resolvedOwner))}
          className="hover:text-slate-800"
        >
          {resolvedOwner}
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
        <span className="font-medium text-slate-800">{title}</span>
      </nav>

      <header className="border-b border-slate-100 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Incident Evidence Record
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-[13px] text-slate-700">{subtitleLine}</p>
        <dl className="mt-3 grid gap-2 text-[12px] text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-slate-500">Assigned</dt>
            <dd className="font-medium text-slate-900">{detail?.assigned ?? pack?.assignedReviewer}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Owner</dt>
            <dd className="font-medium text-slate-900">{resolvedOwner}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Updated</dt>
            <dd className="font-medium text-slate-900">{detail?.lastUpdated ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Evidence confidence</dt>
            <dd className="font-medium text-slate-900">
              {detail?.evidenceConfidence ?? "Medium"}
              {needsMoreEvidence ? (
                <span className="ml-2 text-amber-800">· Needs more evidence</span>
              ) : null}
            </dd>
          </div>
        </dl>
        <p className="mt-3 rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2 text-[12px] text-slate-600">
          <span className="text-slate-500">Source:</span>{" "}
          <Link
            href={scopeHref(routeToIncidentsOwnerQueue(resolvedOwner, incidentId))}
            className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
          >
            {resolvedOwner} owner queue
          </Link>
          <span className="text-slate-400"> · </span>
          <span className="font-medium text-slate-800">{recordKind} evidence record</span>
          <span className="text-slate-400"> · </span>
          <span>
            <span className="text-slate-500">Current stage:</span>{" "}
            <span className="font-medium text-slate-800">{stageDisplay}</span>
          </span>
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
        <Link
          href={scopeHref(routeToEvidenceLibraryOwnerPackage(resolvedOwner))}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-800 hover:bg-slate-50"
        >
          Back to owner package
        </Link>
        <button
          type="button"
          onClick={() => {
            const blob = new Blob([JSON.stringify({ incidentId, pack, detail }, null, 2)]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${incidentId}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-800 hover:bg-slate-50"
        >
          Download JSON
        </button>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(summary).catch(() => {});
            showToast("Summary copied");
          }}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
        >
          Copy summary
        </button>
      </div>

      {!isArchived && timelineSource ? (
        <LifecycleTimeline lifecycle={timelineSource} />
      ) : isArchived ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Lifecycle timeline
          </h2>
          <p className="mt-2 text-[13px] text-slate-700">
            This record is archived. Outcome:{" "}
            <span className="font-medium text-slate-900">{resolvedArchiveRow?.outcome}</span>.
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Lifecycle timeline
          </h2>
          <p className="mt-2 text-[13px] text-slate-700">{pack?.timeline ?? "—"}</p>
        </section>
      )}

      {detail?.fleetracAnalysis ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Fleetrac analysis
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
            {detail.fleetracAnalysis.narrative}
          </p>
          <dl className="mt-4 space-y-2 text-[13px]">
            <div>
              <dt className="text-[11px] font-medium text-slate-500">Root signal</dt>
              <dd className="text-slate-800">{detail.fleetracAnalysis.rootSignal}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-slate-500">Likely cause</dt>
              <dd className="text-slate-800">{detail.fleetracAnalysis.likelyCause}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-slate-500">Governance implication</dt>
              <dd className="text-slate-800">{detail.fleetracAnalysis.governanceImplication}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Captured logs / evidence items
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[1040px] w-full divide-y divide-slate-200 text-[12px]">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Evidence item</th>
                <th className="px-2 py-2 text-left font-medium">Source</th>
                <th className="px-2 py-2 text-left font-medium">Signal</th>
                <th className="px-2 py-2 text-left font-medium">Governance relevance</th>
                <th className="px-2 py-2 text-left font-medium">Status</th>
                <th className="px-2 py-2 text-left font-medium">Timestamp</th>
                <th className="px-2 py-2 text-left font-medium">Raw log</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {structuredRows.map((row, i) => (
                <EvidenceRow key={`${incidentId}-${i}`} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!isArchived ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Decision required
          </h2>
          <p className="mt-2 text-[13px] font-medium text-slate-900">
            {detail?.decisionNeeded ?? "Review incident evidence"}
          </p>
          <p className="mt-1 text-[13px] text-slate-700">
            <span className="text-slate-500">Recommended action · </span>
            {detail?.recommendedAction ?? pack?.recommendedAction}
          </p>
          <p className="mt-2 text-[12px] text-slate-600">
            Reviewer decision:
            {decisionLabel ? (
              <span className="ml-1 font-medium text-slate-900">{decisionLabel}</span>
            ) : (
              <span className="ml-1 text-slate-500">None recorded</span>
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={approveRemediation}
              className="rounded-md bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white hover:bg-slate-800"
            >
              Approve remediation
            </button>
            <button
              type="button"
              onClick={requestMoreEvidence}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-800 hover:bg-slate-50"
            >
              Request more evidence
            </button>
            <button
              type="button"
              onClick={markFalsePositive}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-800 hover:bg-slate-50"
            >
              Mark false positive
            </button>
          </div>
        </section>
      ) : null}

      {!isArchived ? (
        <section
          className={cn(
            "rounded-lg border bg-white p-4 shadow-sm",
            handoffReady ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-200"
          )}
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Action handoff
          </h2>
          {handoffReady ? (
            <p className="mt-1 text-[11px] text-slate-600">
              Remediation approved — ready to route to Action Center.
            </p>
          ) : null}
          <p className="mt-2 text-[13px] font-medium text-slate-900">
            Next step · {detail?.nextStep ?? "Send remediation to Action Center"}
          </p>
          {detail?.actionHandoffPreview?.length ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-[13px] text-slate-700">
              <li className="list-none text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Action preview
              </li>
              {detail.actionHandoffPreview.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            onClick={sendToActionCenter}
            className={cn(
              "mt-4 inline-flex rounded-md px-3 py-2 text-[12px] font-semibold",
              handoffReady
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "border border-slate-900 bg-white text-slate-900 hover:bg-slate-50"
            )}
          >
            Send to Action Center →
          </button>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Outcome / verification
        </h2>
        {isArchived && resolvedArchiveRow ? (
          <div className="mt-2 space-y-1 text-[13px] text-slate-700">
            <p>
              <span className="font-medium text-slate-900">Outcome verification:</span> Complete
            </p>
            <p>
              <span className="font-medium text-slate-900">Result:</span>{" "}
              {resolvedArchiveRow.verificationResult}
            </p>
            <p className="text-[12px] text-slate-500">Evidence archived · audit retained</p>
          </div>
        ) : detail?.outcomeVerification === "not_started" ? (
          <div className="mt-2 text-[13px] text-slate-700">
            <p>
              <span className="font-medium text-slate-900">Outcome verification:</span> Not started
            </p>
            <p className="mt-1 text-slate-600">{detail.outcomeReason}</p>
            <p className="mt-1 text-slate-600">{detail.nextMeasurementWindow}</p>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-slate-700">{pack?.outcomeStatus ?? "—"}</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-[13px] text-slate-700">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Incident summary
        </h2>
        <p className="mt-2 leading-relaxed">{summary}</p>
      </section>

      <div className="flex flex-wrap gap-4 border-t border-slate-200 pt-4 text-[12px]">
        <Link
          href={scopeHref(routeToEvidenceLibraryTeam())}
          className="font-medium text-slate-600 underline hover:text-slate-900"
        >
          Evidence Library
        </Link>
        <Link href={routes.actions()} className="font-medium text-slate-600 underline hover:text-slate-900">
          Action Center
        </Link>
      </div>

      {toast ? (
        <div
          className="fixed bottom-4 right-4 z-50 rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function LifecycleTimeline({
  lifecycle
}: {
  lifecycle: IncidentEvidenceDetail["lifecycleTimestamps"];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Lifecycle timeline
      </h2>
      <ol className="mt-3 space-y-0">
        {INCIDENT_LIFECYCLE_ORDER.map((key) => {
          const custom = lifecycle?.[key];
          const state = custom?.state ?? "pending";
          const lab = custom?.label ?? lifecycleLabel(key);
          return (
            <li
              key={key}
              className={cn(
                "flex items-start gap-3 border-b border-slate-50 py-2.5 last:border-0",
                state === "pending" && "opacity-70"
              )}
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                {state === "done" ? (
                  <Check className="h-3.5 w-3.5 text-slate-500" strokeWidth={2.5} />
                ) : state === "current" ? (
                  <Circle className="h-3 w-3 fill-slate-900 text-slate-900" />
                ) : (
                  <Circle className="h-3 w-3 text-slate-200" />
                )}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 text-[13px]",
                  state === "done" && "text-slate-700",
                  state === "current" && "font-semibold text-slate-900",
                  state === "pending" && "text-slate-400"
                )}
              >
                {lab}
              </span>
              {custom?.at ? (
                <span
                  className={cn(
                    "shrink-0 text-[11px] tabular-nums",
                    state === "current" ? "font-medium text-slate-700" : "text-slate-500"
                  )}
                >
                  {custom.at}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function EvidenceRow({ row }: { row: StructuredEvidenceRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="align-top">
        <td className="px-2 py-2 font-medium text-slate-900">{row.evidenceItem}</td>
        <td className="px-2 py-2 text-slate-700">{row.source}</td>
        <td className="max-w-[200px] px-2 py-2 font-mono text-[11px] text-slate-600">{row.signal}</td>
        <td className="max-w-[180px] px-2 py-2 text-slate-700">{row.governanceRelevance}</td>
        <td className="whitespace-nowrap px-2 py-2 text-slate-700">{row.status}</td>
        <td className="whitespace-nowrap px-2 py-2 text-slate-500">{row.timestamp}</td>
        <td className="px-2 py-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[11px] font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2"
            aria-expanded={open}
          >
            {open ? "Hide raw log" : "Expand raw log"}
          </button>
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={7} className="bg-slate-50/80 px-3 py-2">
            <pre className="max-h-48 overflow-auto rounded-md border border-slate-200 bg-slate-100 p-2 font-mono text-[10px] leading-relaxed text-slate-800">
              {JSON.stringify(row.rawLog, null, 2)}
            </pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}
