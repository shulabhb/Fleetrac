"use client";

import Link from "next/link";
import { postResolveAction } from "@/lib/governance-api";
import type { GovernedAction } from "@/lib/governed-actions-types";
import { routeToEvidenceLibraryIncidentRecord } from "@/lib/routes";
import { cn } from "@/lib/cn";

export type ResolutionKind = "rollback" | "follow_up" | "improved";

const COPY: Record<
  ResolutionKind,
  { title: string; body: string }
> = {
  rollback: {
    title: "Rollback review",
    body: "Verification recorded a rollback candidate. Fleetrac did not execute rollback. Record how the team will handle this risk."
  },
  follow_up: {
    title: "Follow-up review",
    body: "Verification did not show enough improvement. Choose the next follow-up path."
  },
  improved: {
    title: "Close-ready",
    body: "Verification shows improvement. Review outcome evidence, then close or keep monitoring."
  }
};

const RECORDED_LABEL: Record<string, string> = {
  rollback_required: "Rollback required",
  externally_handled: "Rollback required — externally handled",
  follow_up_assigned: "Follow-up assigned",
  monitoring_continued: "Monitoring continued",
  risk_accepted: "Risk accepted",
  resolved: "Resolved"
};

type Choice = {
  id: string;
  label: string;
  rank: "primary" | "secondary" | "link";
};

function choicesFor(kind: ResolutionKind): Choice[] {
  if (kind === "rollback") {
    return [
      { id: "rollback_required", label: "Record rollback required", rank: "primary" },
      { id: "externally_handled", label: "Mark externally handled", rank: "secondary" },
      { id: "follow_up_assigned", label: "Assign follow-up review", rank: "secondary" },
      { id: "monitoring_continued", label: "Keep monitoring", rank: "link" }
    ];
  }
  if (kind === "follow_up") {
    return [
      { id: "follow_up_assigned", label: "Create follow-up review", rank: "primary" },
      { id: "monitoring_continued", label: "Keep monitoring", rank: "secondary" },
      { id: "risk_accepted", label: "Accept risk for now", rank: "secondary" },
      { id: "externally_handled", label: "Mark externally handled", rank: "link" }
    ];
  }
  return [
    { id: "resolved", label: "Mark risk resolved", rank: "primary" },
    { id: "monitoring_continued", label: "Keep monitoring", rank: "secondary" }
  ];
}

function buttonClass(rank: Choice["rank"]) {
  if (rank === "primary") {
    return "inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-slate-800";
  }
  if (rank === "secondary") {
    return "inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 shadow-sm hover:border-slate-300";
  }
  return "inline-flex items-center justify-center text-[12px] font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900";
}

export function VerificationResolutionPanel({
  action,
  kind,
  onRecorded,
  onToast
}: {
  action: GovernedAction;
  kind: ResolutionKind;
  onRecorded: () => void;
  onToast: (msg: string) => void;
}) {
  const recorded = Boolean(action.resolutionStatus);
  const copy = COPY[kind];
  const evidenceHref = routeToEvidenceLibraryIncidentRecord(
    action.incidentId,
    action.ownerTeam
  );

  const handle = async (status: string) => {
    const result = await postResolveAction(action.id, status);
    if (!result) {
      onToast("Could not record resolution — check API connection");
      return;
    }
    onRecorded();
    onToast(`${RECORDED_LABEL[status] ?? "Resolution recorded"} · decision recorded`);
  };

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2.5",
        kind === "rollback"
          ? "border-rose-200 bg-rose-50/50"
          : kind === "improved"
            ? "border-emerald-200 bg-emerald-50/40"
            : "border-slate-200 bg-slate-50/80"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {copy.title}
      </p>
      {recorded ? (
        <>
          <p className="mt-1 text-[13px] font-semibold text-slate-900">
            {RECORDED_LABEL[action.resolutionStatus ?? ""] ?? "Resolution recorded"}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-700">
            {action.resolutionNote ||
              "Decision recorded. Fleetrac did not execute rollback or change agent code."}
          </p>
          <Link
            href={evidenceHref}
            className="mt-2 inline-flex text-[12px] font-semibold text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-600"
          >
            View outcome evidence
          </Link>
        </>
      ) : (
        <>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-700">{copy.body}</p>
          <div className="mt-2.5 flex flex-col gap-1.5">
            {choicesFor(kind).map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => void handle(choice.id)}
                className={buttonClass(choice.rank)}
              >
                {choice.label}
              </button>
            ))}
            {kind === "improved" ? (
              <Link href={evidenceHref} className={buttonClass("link")}>
                View outcome evidence
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

export function resolutionKindFromVerification(
  resultKind: string
): ResolutionKind | null {
  if (resultKind === "rollback") return "rollback";
  if (resultKind === "no_material_change" || resultKind === "follow_up") return "follow_up";
  if (resultKind === "improved") return "improved";
  return null;
}
