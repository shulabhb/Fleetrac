"use client";

import { useMemo, useState } from "react";
import {
  formatRiskMix,
  getOwnerTeamDetails,
  GOVERNED_SYSTEMS,
  OWNER_INSIGHTS,
  ownerPriorityQueueRows,
  primaryRiskConcentrationLabel,
  type OwnerTeamDetails
} from "@/lib/governance-dashboard-mock";
import { OWNER_PACK_EVIDENCE_REFERENCES } from "@/lib/incident-queue-owner-review-mock";

type Props = {
  ownerTeam: string;
};

export function OwnerEvidencePackPanel({ ownerTeam }: Props) {
  const insight = useMemo(
    () => OWNER_INSIGHTS.find((o) => o.ownerTeam === ownerTeam),
    [ownerTeam]
  );
  const details: OwnerTeamDetails = useMemo(() => getOwnerTeamDetails(ownerTeam), [ownerTeam]);
  const priorityRows = useMemo(() => ownerPriorityQueueRows(ownerTeam), [ownerTeam]);
  const [toast, setToast] = useState<string | null>(null);

  const jsonBlob = useMemo(() => {
    const payload = {
      packType: "owner",
      ownerTeam,
      evidencePackId: details.evidencePackId,
      riskMix: insight ? formatRiskMix(insight) : "",
      bottleneck: insight?.bottleneck,
      governanceStage: insight?.governanceStage,
      teamLead: details.teamLead,
      reviewers: details.members,
      lastNotifiedAt: details.lastNotifiedAt
    };
    return JSON.stringify(payload, null, 2);
  }, [ownerTeam, details, insight]);

  const copySummary = async () => {
    const text = [
      `Owner Evidence Pack: ${ownerTeam}`,
      insight
        ? `${insight.open} open · ${insight.critical} critical · ${insight.decisionsNeeded} decisions waiting`
        : "",
      `Lead: ${details.teamLead} · Reviewers: ${details.members.join(", ")}`,
      insight ? `Primary risk: ${primaryRiskConcentrationLabel(insight)}` : ""
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied summary");
      window.setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("Copy failed");
      window.setTimeout(() => setToast(null), 2500);
    }
  };

  const downloadJson = () => {
    const blob = new Blob([jsonBlob], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${details.evidencePackId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generatedLabel =
    details.lastNotifiedAt !== "—" ? details.lastNotifiedAt : "recently";

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Owner evidence pack
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">
        Owner Evidence Pack: {ownerTeam}
      </h2>
      <p className="mt-1 text-[13px] leading-snug text-slate-600">
        Generated automatically from owner queue · Evidence sent to {details.teamLead}{" "}
        <span className="tabular-nums text-slate-500">{generatedLabel}</span>
      </p>

      <dl className="mt-4 grid gap-2 text-[13px] text-slate-700 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-medium text-slate-500">Owner team</dt>
          <dd className="font-medium text-slate-900">{ownerTeam}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium text-slate-500">Team lead</dt>
          <dd>
            {details.teamLead} · {details.leadRole}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[11px] font-medium text-slate-500">Assigned reviewers</dt>
          <dd>{details.members.join(", ") || "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium text-slate-500">Pack type</dt>
          <dd>Owner-level</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium text-slate-500">Generated</dt>
          <dd className="tabular-nums">{generatedLabel}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium text-slate-500">Status</dt>
          <dd>{details.evidencePackStatus}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={copySummary}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-800 hover:bg-slate-50"
        >
          Copy summary
        </button>
        <button
          type="button"
          onClick={downloadJson}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-800 hover:bg-slate-50"
        >
          Download mock JSON
        </button>
        <button
          type="button"
          onClick={() => setToast("Notification resent (demo)")}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-800 hover:bg-slate-50"
        >
          Resend to owner
        </button>
        <button
          type="button"
          onClick={() => setToast("Marked reviewed (demo)")}
          className="rounded-md bg-slate-900 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-slate-800"
        >
          Mark reviewed
        </button>
      </div>

      {insight ? (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Risk snapshot
          </p>
          <ul className="mt-2 space-y-1 text-[12px] text-slate-700">
            <li>{insight.open} open incidents</li>
            <li>{insight.critical} critical</li>
            <li>{insight.decisionsNeeded} decisions waiting</li>
            <li>Oldest: {insight.oldestEvidenceAge}</li>
            <li>Primary risk: {primaryRiskConcentrationLabel(insight)}</li>
            <li>Bottleneck: {insight.bottleneck}</li>
            <li>SLA risk: {insight.slaRisk}</li>
            <li>Risk mix: {formatRiskMix(insight)}</li>
          </ul>
        </div>
      ) : null}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Included systems
        </p>
        <ul className="mt-2 space-y-3">
          {priorityRows.map((row) => {
            const sys = GOVERNED_SYSTEMS.find((s) => s.id === row.systemId);
            if (!sys) return null;
            return (
              <li key={row.systemId} className="text-[12px] leading-snug text-slate-700">
                <span className="font-semibold text-slate-900">{sys.name}</span>
                <span className="text-slate-400"> · </span>
                Risk: {sys.primaryRisk}
                <span className="text-slate-400"> · </span>
                Severity: {sys.status}
                <br />
                <span className="text-slate-600">Decision: {row.decisionLine}</span>
                {row.assignedMember ? (
                  <>
                    <span className="text-slate-400"> · </span>
                    <span className="text-slate-500">Assigned: {row.assignedMember}</span>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Evidence references (by system)
        </p>
        <div className="mt-2 space-y-3">
          {priorityRows.map((row) => {
            const sys = GOVERNED_SYSTEMS.find((s) => s.id === row.systemId);
            const bullets = OWNER_PACK_EVIDENCE_REFERENCES[row.systemId];
            if (!sys || !bullets?.length) return null;
            return (
              <div key={row.systemId}>
                <p className="text-[12px] font-semibold text-slate-900">{sys.name}</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px] text-slate-600">
                  {bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 text-[12px] text-slate-700">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Outcome tracking
        </p>
        <p className="mt-1">
          <span className="text-slate-500">Current status:</span> Awaiting owner review
        </p>
        <p className="mt-0.5">
          <span className="text-slate-500">Outcome verification:</span> Not started
        </p>
        <p className="mt-0.5">
          <span className="text-slate-500">Next measurement window:</span> After remediation approval
        </p>
      </div>

      {toast ? (
        <p className="mt-2 text-[11px] font-medium text-slate-600" role="status">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
