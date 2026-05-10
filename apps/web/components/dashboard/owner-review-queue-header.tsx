"use client";

import {
  getOwnerTeamDetails,
  OWNER_INSIGHTS,
  type OwnerTeamDetails
} from "@/lib/governance-dashboard-mock";

export function OwnerReviewQueueHeader({ ownerTeam }: { ownerTeam: string }) {
  const insight = OWNER_INSIGHTS.find((o) => o.ownerTeam === ownerTeam);
  const details: OwnerTeamDetails = getOwnerTeamDetails(ownerTeam);

  if (!insight) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] text-slate-700">
        <p className="font-semibold text-slate-900">Owner Review Queue</p>
        <p className="mt-1 text-slate-600">{ownerTeam}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] leading-snug text-slate-700">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Owner Review Queue
      </p>
      <p className="mt-1 text-base font-semibold text-slate-900">{ownerTeam}</p>
      <p className="mt-2 text-[13px] text-slate-600">
        {insight.decisionsNeeded} decisions waiting · {insight.critical} critical · oldest{" "}
        {insight.oldestEvidenceAge}
      </p>
      <p className="mt-2 text-[12px] text-slate-600">
        <span className="text-slate-500">Team lead notified:</span>{" "}
        <span className="font-medium text-slate-800">{details.teamLead}</span>
        <span className="text-slate-400"> · </span>
        <span className="tabular-nums text-slate-500">{details.lastNotifiedAt}</span>
      </p>
      <p className="mt-1 text-[12px] text-slate-600">
        <span className="text-slate-500">Assigned reviewers:</span>{" "}
        <span className="font-medium text-slate-800">{details.members.join(", ")}</span>
      </p>
      <p className="mt-1 text-[12px] text-slate-600">
        <span className="text-slate-500">Evidence pack:</span>{" "}
        <span className="font-medium text-slate-800">{details.evidencePackStatus}</span>
      </p>
    </div>
  );
}
