"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BobRecommendation, ApprovalStatus } from "@/lib/bob-types";
import { ApprovalBadge, ConfidenceBadge } from "./bob-badges";
import { humanizeLabel } from "@/lib/present";
import { setRecommendationOverride } from "@/lib/bob-state";

type RecommendationCardProps = {
  recommendation: BobRecommendation;
  initialStatus?: ApprovalStatus;
  onStatusChange?: (status: ApprovalStatus) => void;
  density?: "default" | "compact";
  showActions?: boolean;
  className?: string;
};

export function RecommendationCard({
  recommendation,
  initialStatus,
  onStatusChange,
  density = "default",
  showActions = true,
  className
}: RecommendationCardProps) {
  const [status, setStatus] = useState<ApprovalStatus>(
    initialStatus ?? recommendation.approval_status
  );

  const handle = (next: ApprovalStatus) => {
    setStatus(next);
    setRecommendationOverride(recommendation.id, { approvalStatus: next });
    onStatusChange?.(next);
  };

  const isCompact = density === "compact";

  return (
    <div
      className={cn(
        "relative rounded-lg border transition hover:border-slate-300",
        isCompact
          ? "border-slate-200 bg-white"
          : "border-indigo-200 bg-indigo-50/30 shadow-sm",
        isCompact ? "p-3" : "p-4",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-3 bottom-3 w-0.5 rounded-full",
          status === "approved"
            ? "bg-emerald-400"
            : status === "rejected"
            ? "bg-rose-400"
            : "bg-indigo-300"
        )}
      />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
              {humanizeLabel(recommendation.type)}
            </span>
            {!isCompact ? (
              <>
                <ConfidenceBadge
                  tier={recommendation.confidence}
                  score={recommendation.confidence_score}
                />
                <ApprovalBadge status={status} />
              </>
            ) : null}
          </div>
          <h4 className="mt-1.5 text-sm font-semibold tracking-tight text-slate-900">
            {recommendation.title}
          </h4>
          {!isCompact ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {recommendation.rationale_summary}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            <span>
              <span className="text-slate-400">Owner</span>{" "}
              <span className="font-medium text-slate-700">{recommendation.owner_team}</span>
            </span>
            <span>
              <span className="text-slate-400">Target</span>{" "}
              <span className="font-medium text-slate-700">
                {recommendation.target_label ?? recommendation.target_id}
              </span>
            </span>
            <span>
              <span className="text-slate-400">Remediation</span>{" "}
              <span className="font-medium text-slate-700">
                {humanizeLabel(recommendation.remediation_type)}
              </span>
            </span>
            {isCompact ? (
              <span>
                <span className="text-slate-400">Approval</span>{" "}
                <span className="font-medium text-slate-700">
                  {humanizeLabel(status)}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {showActions && recommendation.approval_required ? (
        <div className="mt-3 flex items-center justify-between border-t border-indigo-100 pl-2 pt-2.5">
          <p className="text-[11px] text-slate-500">
            Requires governance approval before execution.
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handle("rejected")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition",
                status === "rejected"
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-700"
              )}
            >
              <XCircle className="h-3 w-3" />
              Reject
            </button>
            <button
              type="button"
              onClick={() => handle("approved")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition",
                status === "approved"
                  ? "border-emerald-500 bg-emerald-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
              )}
            >
              <CheckCircle2 className="h-3 w-3" />
              Approve
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
