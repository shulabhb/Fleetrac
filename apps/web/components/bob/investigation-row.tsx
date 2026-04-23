import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { BobInvestigation } from "@/lib/bob-types";
import { cn } from "@/lib/cn";
import {
  ApprovalBadge,
  ConfidenceBadge,
  InvestigationStatusBadge
} from "./bob-badges";
import { formatRelativeTime } from "@/lib/format";
import { humanizeLabel } from "@/lib/present";
import { appendReturnTo, routeToBobInvestigation } from "@/lib/routes";

export function InvestigationRow({
  investigation,
  returnTo,
  className
}: {
  investigation: BobInvestigation;
  returnTo?: string;
  className?: string;
}) {
  const top = investigation.recommendations.find(
    (r) => r.id === investigation.top_recommendation_id
  );

  return (
    <Link
      href={appendReturnTo(routeToBobInvestigation(investigation.id), returnTo)}
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5 transition hover:border-slate-300 hover:shadow-card-hover",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            {humanizeLabel(investigation.target_type)}
          </span>
          <InvestigationStatusBadge status={investigation.status} />
          <ConfidenceBadge
            tier={investigation.confidence}
            score={investigation.confidence_score}
            withScore
          />
          {investigation.recurring_issue_flag ? (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
              Recurring
            </span>
          ) : null}
        </div>
        <h3 className="mt-1.5 truncate text-sm font-semibold text-slate-900">
          {investigation.title}
        </h3>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {investigation.target_label}
          {investigation.signal_type ? ` · ${investigation.signal_type} signal` : ""}
          {investigation.risk_domain ? ` · ${investigation.risk_domain}` : ""}
        </p>
        <p className="mt-2 line-clamp-2 text-xs leading-snug text-slate-600">
          {top ? top.title : investigation.summary}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          <span>
            Suggested owner:{" "}
            <span className="font-medium text-slate-700">
              {investigation.suggested_owner}
            </span>
          </span>
          {top ? <ApprovalBadge status={top.approval_status} /> : null}
          <span className="tabular-nums">
            Updated {formatRelativeTime(investigation.updated_at)}
          </span>
        </div>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
    </Link>
  );
}
