"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { Check, ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  INCIDENT_LIFECYCLE_ORDER,
  lifecycleLabel,
  type IncidentEvidenceDetail,
  type StructuredEvidenceRow
} from "@/lib/evidence-library-types";
import type { LivePackageState } from "@/lib/evidence-library-package-state";
import { handoffIncidentToActionCenter } from "@/lib/governance-api";
import { riskDetailCta } from "@/lib/risk-detail-copy";
import { resolveIncidentLifecycle } from "@/lib/resolve-next-step";
import { NextRequiredStepCard } from "@/components/governance/next-required-step";
import {
  RiskTriageDrawer,
  type RiskDrawerTab
} from "@/components/incidents/risk-detail-panel";
import {
  buildGlobalOwnerQueueRowsFromApi,
  mapApiEvidenceToDetail
} from "@/lib/governance-merge";
import { useGovernanceData } from "@/hooks/use-governance-data";
import {
  routeToEvidenceLibraryOwnerPackage,
  routeToEvidenceLibraryTeam,
  routeToIncidentsOwnerQueue,
  routes
} from "@/lib/routes";

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
  const { evidenceByAlias, actions, ownerQueues } = useGovernanceData();
  const detail = useMemo(() => {
    const apiEvidence = evidenceByAlias[incidentId];
    if (apiEvidence) {
      return mapApiEvidenceToDetail(apiEvidence);
    }
    return undefined;
  }, [incidentId, evidenceByAlias]);
  const resolvedOwner = ownerTeam ?? detail?.ownerTeam ?? "—";

  const resolvedArchiveRow = useMemo(() => {
    const p = livePackages[resolvedOwner];
    return p?.resolved.find((r) => r.id === incidentId);
  }, [livePackages, resolvedOwner, incidentId]);

  const isArchived = Boolean(resolvedArchiveRow);

  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [riskOpen, setRiskOpen] = useState(false);

  const action = useMemo(
    () =>
      actions.find(
        (item) => item.alias_id === incidentId || item.incident_id === incidentId
      ) ?? null,
    [actions, incidentId]
  );

  const structuredRows: StructuredEvidenceRow[] = useMemo(() => {
    return detail?.structuredEvidence ?? [];
  }, [detail]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const subtitleLine = detail?.recordSubtitle ?? "";

  const queueRows = useMemo(
    () => buildGlobalOwnerQueueRowsFromApi(ownerQueues, evidenceByAlias),
    [ownerQueues, evidenceByAlias]
  );
  const drawerRow =
    queueRows.find(
      (row) => row.incidentId === incidentId || row.canonicalId === incidentId
    ) ?? null;
  const awaiting =
    !action ||
    action.status.toLowerCase().includes("awaiting") ||
    action.status.toLowerCase().includes("pending");
  const statusText = `${action?.status ?? ""} ${action?.verification_status ?? ""}`.toLowerCase();
  const drawerTab: RiskDrawerTab = !action
    ? "evidence"
    : awaiting
      ? "decision"
      : statusText.includes("approved") || statusText.includes("monitor")
        ? "verification"
        : "history";
  const rejected = (action?.status ?? "").toLowerCase().includes("reject");
  const recordedDecision = action
    ? riskDetailCta(action.status, action.verification_status)
    : "Send to Action Center";
  const resolvedStep = resolveIncidentLifecycle({
    incidentId,
    lifecycle: detail?.recordSubtitle,
    actionId: action?.id,
    actionStatus: action?.status,
    verificationStatus: action?.verification_status,
    resolutionStatus: action?.resolution_status,
    serverStage: action?.current_stage,
    serverLabel: action?.current_stage_label,
    serverStep: action?.next_required_step,
    serverCta: action?.primary_cta,
    serverDestination: action?.primary_destination,
    serverClosure: action?.closure_state,
    ownerTeam: resolvedOwner === "—" ? null : resolvedOwner,
    outcome: action?.verification_status,
    evidenceCount: detail?.structuredEvidence?.length,
    ctaSurface: "outcomes"
  });

  const sendToActionCenter = async () => {
    setBusy("handoff");
    const actionId = action?.id ?? (await handoffIncidentToActionCenter(incidentId));
    setBusy(null);
    if (!actionId) {
      showToast("Could not send to Action Center — check API connection");
      return;
    }
    const tab = awaiting ? "pending" : rejected ? "closed" : "ready";
    router.push(scopeHref(`${routes.actions()}?tab=${tab}&action=${encodeURIComponent(actionId)}`));
  };

  if (!detail) {
    return (
      <div className="space-y-4">
        <NextRequiredStepCard
        lifecycle={resolvedStep}
        scopeHref={scopeHref}
        hideActions={resolvedStep.primaryDestination.surface === "outcomes_audit"}
      />
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center shadow-sm">
          <p className="text-[13px] text-slate-600">
            No evidence record for <span className="font-medium text-slate-900">{incidentId}</span> yet.
            Run a simulator pitch to generate governed evidence from live logs.
          </p>
          <Link
            href={scopeHref(routeToEvidenceLibraryTeam())}
            className="mt-3 inline-block text-[12px] font-semibold text-slate-800 hover:underline"
          >
            Back to Outcomes
          </Link>
        </div>
      </div>
    );
  }

  const title = detail.title;
  const summary = detail.summary ?? "";
  const timelineSource = detail.lifecycleTimestamps;
  const stageDisplay = currentStageLabel(
    timelineSource,
    detail.recordSubtitle?.split(" · ").pop() ?? "—"
  );
  const recordKind = isArchived ? "Resolved" : "Active";
  const handoffReady = Boolean(action);

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
        <Link href={scopeHref(routeToEvidenceLibraryTeam())} className="hover:text-slate-800">
          Outcomes
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
            <dd className="font-medium text-slate-900">{detail.assigned}</dd>
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

      <NextRequiredStepCard
        lifecycle={resolvedStep}
        scopeHref={scopeHref}
        hideActions={resolvedStep.primaryDestination.surface === "outcomes_audit"}
      />

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
            const blob = new Blob([JSON.stringify({ incidentId, detail }, null, 2)]);
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
          <p className="mt-2 text-[13px] text-slate-700">{detail.summary}</p>
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
            {detail.recommendedAction}
          </p>
          <p className="mt-2 text-[12px] text-slate-600">
            Recorded decision:
            <span className="ml-1 font-medium text-slate-900">
              {action ? `${action.status} · ${action.verification_status}` : "No governed action yet"}
            </span>
          </p>
          <p className="mt-1 text-[12px] text-slate-600">
            Next step: {recordedDecision}. Approval does not change agent code. More evidence arrives from telemetry; there is no separate evidence-request integration.
          </p>
          {resolvedStep.primaryDestination.surface === "outcomes_audit" ? null : (
            <Link
              href={scopeHref(resolvedStep.primaryDestination.href)}
              className="mt-4 inline-flex rounded-md bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white hover:bg-slate-800"
            >
              {resolvedStep.primaryCtaLabel}
            </Link>
          )}
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
          <p className="mt-1 text-[11px] text-slate-600">
            {action
              ? "Opens the governed action. A later visit does not rewind an approved or verified risk."
              : "Creates the governed action and opens Action Center."}
          </p>
          <p className="mt-2 text-[13px] font-medium text-slate-900">
            Next step · {recordedDecision}
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
            {busy === "handoff" ? "Opening…" : "Open in Action Center →"}
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
          <p className="mt-2 text-[13px] text-slate-700">{detail.decisionStatus}</p>
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
          Outcomes
        </Link>
        <Link href={routes.actions()} className="font-medium text-slate-600 underline hover:text-slate-900">
          Action Center
        </Link>
      </div>

      <RiskTriageDrawer
        open={riskOpen && Boolean(drawerRow)}
        row={drawerRow}
        evidence={evidenceByAlias[incidentId] ?? null}
        actions={actions}
        scopeHref={scopeHref}
        initialTab={drawerTab}
        sending={busy === "handoff"}
        onToast={showToast}
        onSendToActionCenter={() => void sendToActionCenter()}
        onClose={() => setRiskOpen(false)}
      />

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
