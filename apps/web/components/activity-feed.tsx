import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Eye,
  FileSignature,
  Flag,
  GitPullRequestArrow,
  Send,
  ShieldAlert,
  Sparkles,
  Ticket,
  ThumbsUp,
  UserRound,
  Waypoints,
  XCircle
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import { humanizeLabel } from "@/lib/present";

export type ActivityItem = {
  id: string;
  action: string;
  details: string;
  timestamp: string | Date;
  targetId?: string;
  targetType?: string;
  actor?: string;
};

type IconSpec = { icon: LucideIcon; tone: string };

function iconFor(action: string): IconSpec {
  const a = action.toLowerCase();
  if (a.startsWith("outreach.")) {
    if (a.includes("jira"))
      return { icon: Ticket, tone: "text-blue-700 bg-blue-50 ring-blue-100" };
    return { icon: Send, tone: "text-violet-700 bg-violet-50 ring-violet-100" };
  }
  if (a.startsWith("routing."))
    return { icon: Waypoints, tone: "text-indigo-700 bg-indigo-50 ring-indigo-100" };
  if (a === "owner.assigned" || a.startsWith("owner."))
    return { icon: UserRound, tone: "text-slate-700 bg-slate-100 ring-slate-200" };
  // Bob-specific events get the Sparkles icon family (indigo) for quick scan.
  if (a.startsWith("bob.")) {
    if (a.includes("approved"))
      return { icon: ThumbsUp, tone: "text-indigo-600 bg-indigo-50 ring-indigo-100" };
    if (a.includes("rejected"))
      return { icon: XCircle, tone: "text-indigo-600 bg-indigo-50 ring-indigo-100" };
    return { icon: Sparkles, tone: "text-indigo-600 bg-indigo-50 ring-indigo-100" };
  }
  if (a.includes("followup") || a.includes("follow_up") || a.includes("follow-up"))
    return { icon: CalendarClock, tone: "text-slate-600 bg-slate-50 ring-slate-100" };
  if (a.includes("escalat")) return { icon: Flag, tone: "text-rose-600 bg-rose-50 ring-rose-100" };
  if (a.includes("false_positive") || a.includes("false positive"))
    return { icon: GitPullRequestArrow, tone: "text-slate-600 bg-slate-50 ring-slate-100" };
  if (a.includes("resolv") || a.includes("mitigat") || a.includes("closed"))
    return { icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50 ring-emerald-100" };
  if (a.includes("review")) return { icon: Eye, tone: "text-amber-600 bg-amber-50 ring-amber-100" };
  if (a.includes("audit.threshold_breach") || a.includes("threshold_breach"))
    return { icon: ShieldAlert, tone: "text-rose-600 bg-rose-50 ring-rose-100" };
  if (a.includes("audit")) return { icon: FileSignature, tone: "text-slate-600 bg-slate-50 ring-slate-100" };
  if (a.includes("control")) return { icon: ShieldAlert, tone: "text-indigo-600 bg-indigo-50 ring-indigo-100" };
  if (a.includes("created") || a.includes("detected"))
    return { icon: AlertCircle, tone: "text-sky-600 bg-sky-50 ring-sky-100" };
  return { icon: AlertCircle, tone: "text-slate-600 bg-slate-50 ring-slate-100" };
}

const EVENT_LABELS: Record<string, string> = {
  "incident.created": "Incident detected",
  "incident.review_required": "Review required",
  "incident.escalated": "Escalated to owner team",
  "incident.mitigated": "Incident mitigated",
  "incident.resolved": "Incident resolved",
  "incident.closed": "Incident closed",
  "incident.false_positive": "False positive marked",
  "control.triggered": "Control triggered",
  "audit.threshold_breach_detected": "Audit floor breached",
  "bob.investigation_opened": "Bob investigation opened",
  "bob.recommendation_drafted": "Bob recommendation drafted",
  "bob.recommendation_approved": "Bob recommendation approved",
  "bob.recommendation_rejected": "Bob recommendation rejected",
  "bob.escalation_suggested": "Bob suggested escalation",
  "bob.control_tuning_suggested": "Bob suggested control tuning",
  "followup.scheduled": "Follow-up scheduled",
  "telemetry.processed": "Telemetry processed",
  "outreach.slack": "Slack alert sent",
  "outreach.jira": "Jira recorded",
  "routing.bob_queue": "Response routed to Bob queue",
  "owner.assigned": "Assignment updated",
  "bridge.opened": "Incident bridge opened",
  "tool.logs.opened": "Logs opened",
  "tool.debugger.opened": "Debugger opened",
  "tool.traces.opened": "Traces opened",
  "tool.metrics.opened": "Metrics opened",
  "tool.cloud_console.opened": "Cloud console opened",
  "tool.runbook.opened": "Runbook opened"
};

function labelFor(action: string): string {
  return EVENT_LABELS[action] ?? humanizeLabel(action);
}

type ActivityFeedProps = {
  items: ActivityItem[];
  emptyLabel?: string;
  hrefFor?: (item: ActivityItem) => string | null;
  className?: string;
  /** Denser timeline for side panels (e.g. incident command column). */
  compact?: boolean;
};

export function ActivityFeed({
  items,
  emptyLabel,
  hrefFor,
  className,
  compact = false
}: ActivityFeedProps) {
  if (!items.length) {
    return (
      <p className={cn("text-slate-500", compact ? "text-xs leading-relaxed" : "text-sm")}>
        {emptyLabel ?? "No recent governance activity."}
      </p>
    );
  }

  return (
    <ol className={cn("relative", compact ? "space-y-0.5" : "space-y-1", className)}>
      {items.map((item, idx) => {
        const { icon: Icon, tone } = iconFor(item.action);
        const href = hrefFor ? hrefFor(item) : null;
        const Content = (
          <div
            className={cn(
              "relative flex items-start gap-2 rounded-md",
              compact ? "px-1.5 py-1.5" : "gap-3 px-2 py-2",
              href && "transition hover:bg-slate-50"
            )}
          >
            {idx !== items.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute w-px bg-slate-200",
                  compact
                    ? "left-[11px] top-6 h-[calc(100%-0.35rem)]"
                    : "left-[19px] top-9 h-[calc(100%-1.25rem)]"
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-[1] flex shrink-0 items-center justify-center rounded-full ring-1",
                compact ? "h-6 w-6" : "h-7 w-7",
                tone
              )}
            >
              <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={cn(
                    "truncate font-medium text-slate-900",
                    compact ? "text-xs" : "text-sm"
                  )}
                >
                  {labelFor(item.action)}
                </p>
                <span
                  suppressHydrationWarning
                  className={cn("shrink-0 text-slate-500", compact ? "text-[10px]" : "text-[11px]")}
                >
                  {formatRelativeTime(item.timestamp)}
                </span>
              </div>
              <p
                className={cn(
                  "line-clamp-2 text-slate-600",
                  compact ? "text-[11px] leading-snug" : "text-xs"
                )}
              >
                {item.details}
              </p>
            </div>
            {href ? (
              <ArrowUpRight
                className={cn(
                  "shrink-0 text-slate-400 transition group-hover:text-slate-700",
                  compact ? "mt-0.5 h-3 w-3" : "mt-1 h-3.5 w-3.5"
                )}
              />
            ) : null}
          </div>
        );
        return (
          <li key={item.id} className="group">
            {href ? <Link href={href}>{Content}</Link> : Content}
          </li>
        );
      })}
    </ol>
  );
}
