import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DemoWorkflowActionItem } from "@/lib/governance-demo-actions";
import { formatRelativeTime } from "@/lib/format";
import { routeToEvidenceLibraryIncidentRecord } from "@/lib/routes";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

/**
 * Demo workflow action from Incident Queue or Evidence Library (session store).
 */
export function WorkflowActionCard({
  item,
  className
}: {
  item: DemoWorkflowActionItem;
  className?: string;
}) {
  const href = routeToEvidenceLibraryIncidentRecord(item.incidentId, item.ownerTeam);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300",
        className
      )}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px] bg-amber-500"
      />

      <div className="flex items-start justify-between gap-3 pl-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="outline" size="xs" className="font-semibold uppercase tracking-wide">
              From {item.source}
            </Badge>
            <Badge tone="info" size="xs">
              {item.status}
            </Badge>
            {item.severity ? (
              <Badge tone="outline" size="xs">
                {item.severity}
              </Badge>
            ) : null}
          </div>

          <h4 className="mt-2 text-sm font-semibold tracking-tight text-slate-900">
            {item.incidentTitle}
          </h4>

          {item.recommendedAction ? (
            <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
              <span className="text-slate-400">Recommended: </span>
              {item.recommendedAction}
            </p>
          ) : null}

          <dl className="mt-2.5 grid gap-1 text-[11px] text-slate-600 sm:grid-cols-2">
            <div>
              <dt className="text-slate-400">Incident</dt>
              <dd className="font-medium text-slate-800">{item.incidentId}</dd>
            </div>
            {item.systemName ? (
              <div>
                <dt className="text-slate-400">System</dt>
                <dd className="font-medium text-slate-800">{item.systemName}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-slate-400">Owner team</dt>
              <dd className="font-medium text-slate-800">{item.ownerTeam}</dd>
            </div>
            {item.assignedTo ? (
              <div>
                <dt className="text-slate-400">Assigned to</dt>
                <dd className="font-medium text-slate-800">{item.assignedTo}</dd>
              </div>
            ) : null}
            {item.riskCategory ? (
              <div>
                <dt className="text-slate-400">Risk category</dt>
                <dd className="font-medium text-slate-800">{item.riskCategory}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-slate-400">Verification</dt>
              <dd className="font-medium text-slate-800">{item.verificationStatus}</dd>
            </div>
          </dl>
        </div>

        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          Open evidence
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      <p className="mt-2 pl-1.5 text-[10px] text-slate-400">
        Queued {formatRelativeTime(new Date(item.createdAt))} · approval required before execution
      </p>
    </div>
  );
}
