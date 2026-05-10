"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  INCIDENT_EVIDENCE_PACK_BY_ID,
  type IncidentEvidencePackMock
} from "@/lib/incident-queue-owner-review-mock";
import { routes } from "@/lib/routes";
import { normalizeAiScope, withAiScope, type AiScopeId } from "@/lib/ai-scope";
import { useSearchParams } from "next/navigation";

function fallbackPack(incidentId: string): IncidentEvidencePackMock {
  return {
    incidentId,
    title: "Incident",
    summary: "Evidence package prepared from incident queue (demo).",
    systemName: "—",
    systemId: "—",
    ownerTeam: "—",
    assignedReviewer: "—",
    severity: "—",
    riskCategory: "—",
    stage: "Review",
    evidenceItems: ["Packaged signals", "Owner context attached"],
    recommendedAction: "Complete owner review and route to Action Center if needed.",
    timeline: "Packaged → Review pending",
    outcomeStatus: "Not verified yet"
  };
}

export function IncidentEvidencePackPanel({ incidentId }: { incidentId: string }) {
  const params = useSearchParams();
  const scope = normalizeAiScope(params?.get("scope") ?? undefined);
  const scopeHref = (path: string) => withAiScope(path, scope as AiScopeId);
  const pack = useMemo(
    () => INCIDENT_EVIDENCE_PACK_BY_ID[incidentId] ?? fallbackPack(incidentId),
    [incidentId]
  );
  const [toast, setToast] = useState<string | null>(null);

  const jsonBlob = useMemo(() => JSON.stringify({ packType: "incident", ...pack }, null, 2), [pack]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(
        [`Incident Evidence Pack: ${pack.title}`, pack.summary, `Recommended: ${pack.recommendedAction}`].join(
          "\n\n"
        )
      );
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
    a.download = `incident-evidence-${pack.incidentId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Incident evidence pack
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">
        Incident Evidence Pack: {pack.title}
      </h2>
      <p className="mt-1 text-[13px] text-slate-600">
        Generated from incident queue · Assigned to {pack.assignedReviewer}
      </p>

      <dl className="mt-4 space-y-3 text-[13px] text-slate-700">
        <div>
          <dt className="text-[11px] font-medium text-slate-500">Summary</dt>
          <dd className="mt-0.5 leading-snug">{pack.summary}</dd>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-medium text-slate-500">Affected system</dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {pack.systemName}{" "}
              <span className="font-mono text-[11px] font-normal text-slate-400">{pack.systemId}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-slate-500">Owner team</dt>
            <dd className="mt-0.5">{pack.ownerTeam}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-slate-500">Assigned reviewer</dt>
            <dd className="mt-0.5">{pack.assignedReviewer}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-slate-500">Severity / risk</dt>
            <dd className="mt-0.5">
              {pack.severity} · {pack.riskCategory}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-medium text-slate-500">Current stage</dt>
            <dd className="mt-0.5">{pack.stage}</dd>
          </div>
        </div>
        <div>
          <dt className="text-[11px] font-medium text-slate-500">Evidence items</dt>
          <dd className="mt-1">
            <ul className="list-inside list-disc space-y-0.5 text-[12px] text-slate-600">
              {pack.evidenceItems.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium text-slate-500">Recommended action</dt>
          <dd className="mt-0.5 font-medium text-slate-900">{pack.recommendedAction}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium text-slate-500">Timeline</dt>
          <dd className="mt-0.5 text-[12px] text-slate-600">{pack.timeline}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium text-slate-500">Outcome</dt>
          <dd className="mt-0.5">{pack.outcomeStatus}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={copySummary}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-800 hover:bg-slate-50"
        >
          Copy incident summary
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
          onClick={() => {
            setToast("Sent to Action Center");
            window.setTimeout(() => setToast(null), 2500);
          }}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-800 hover:bg-slate-50"
        >
          Send to Action Center
        </button>
        <button
          type="button"
          onClick={() => {
            setToast("Marked reviewed (demo)");
            window.setTimeout(() => setToast(null), 2500);
          }}
          className="rounded-md bg-slate-900 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-slate-800"
        >
          Mark reviewed
        </button>
        <Link
          href={scopeHref(routes.actions())}
          className="inline-flex items-center rounded-md px-2.5 py-1.5 text-[12px] font-medium text-slate-600 underline hover:text-slate-900"
        >
          Action Center
        </Link>
      </div>
      {toast ? (
        <p className="mt-2 text-[11px] font-medium text-slate-600" role="status">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
