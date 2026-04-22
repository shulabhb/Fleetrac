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
  ShieldAlert,
  Sparkles,
  ThumbsUp,
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
  "incident.created": "Incident created",
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
  "telemetry.processed": "Telemetry processed"
};

function labelFor(action: string): string {
  return EVENT_LABELS[action] ?? humanizeLabel(action);
}

type ActivityFeedProps = {
  items: ActivityItem[];
  emptyLabel?: string;
  hrefFor?: (item: ActivityItem) => string | null;
  className?: string;
};

export function ActivityFeed({ items, emptyLabel, hrefFor, className }: ActivityFeedProps) {
  if (!items.length) {
    return (
      <p className="text-sm text-slate-500">
        {emptyLabel ?? "No recent governance activity."}
      </p>
    );
  }

  return (
    <ol className={cn("relative space-y-1", className)}>
      {items.map((item, idx) => {
        const { icon: Icon, tone } = iconFor(item.action);
        const href = hrefFor ? hrefFor(item) : null;
        const Content = (
          <div
            className={cn(
              "relative flex items-start gap-3 rounded-md px-2 py-2",
              href && "transition hover:bg-slate-50"
            )}
          >
            {idx !== items.length - 1 ? (
              <span
                aria-hidden
                className="absolute left-[19px] top-9 h-[calc(100%-1.25rem)] w-px bg-slate-200"
              />
            ) : null}
            <span
              className={cn(
                "relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1",
                tone
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium text-slate-900">
                  {labelFor(item.action)}
                </p>
                <span className="shrink-0 text-[11px] text-slate-500">
                  {formatRelativeTime(item.timestamp)}
                </span>
              </div>
              <p className="line-clamp-2 text-xs text-slate-600">{item.details}</p>
            </div>
            {href ? (
              <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:text-slate-700" />
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
