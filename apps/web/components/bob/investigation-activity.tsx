import {
  ActivityIcon,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Compass,
  FileSearch,
  Gauge,
  Layers,
  PlayCircle,
  ShieldCheck,
  Sliders,
  TrendingUp
} from "lucide-react";
import type { BobActivityEvent } from "@/lib/bob-types";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

const ICON_BY_ACTION: Record<string, typeof ActivityIcon> = {
  "investigation.opened": PlayCircle,
  "reviewed.telemetry_context": Gauge,
  "reviewed.related_incidents": Layers,
  "reviewed.active_controls": ShieldCheck,
  "reviewed.audit_coverage": FileSearch,
  "reviewed.signal_behavior": TrendingUp,
  "reviewed.recurrence": Layers,
  "reviewed.control_fire_rate": TrendingUp,
  "reviewed.threshold_history": Gauge,
  "reviewed.drift_trend": TrendingUp,
  "reviewed.feature_space": Compass,
  "reviewed.routing_behavior": Compass,
  "reviewed.dependency_latency": Gauge,
  "reviewed.retrieval_freshness": FileSearch,
  "reviewed.citation_match": FileSearch,
  "reviewed.prompt_change": FileSearch,
  "reviewed.guardrail_pattern": ShieldCheck,
  "reviewed.sampling_pipeline": FileSearch,
  "reviewed.reviewer_capacity": Layers,
  "reviewed.workflow_surface": Compass,
  "reviewed.tenant_distribution": Layers,
  "reviewed.traffic_cluster": Compass,
  "reviewed.endpoint_usage": Compass,
  "reviewed.prompt_length": Gauge,
  "reviewed.cache_hit_rate": Gauge,
  "reviewed.systems_affected": Layers,
  "flagged.recurring_pattern": AlertTriangle,
  "flagged.structural_pattern": AlertTriangle,
  "suggested.control_tuning": Sliders,
  "draft.alternative_hypothesis": ClipboardCheck,
  "draft.recommendation": ClipboardCheck,
  "awaiting.owner_decision": Clock3,
  "approved.recommendation": CheckCircle2
};

export function InvestigationActivity({
  events,
  className
}: {
  events: BobActivityEvent[];
  className?: string;
}) {
  if (!events.length) {
    return (
      <p className={cn("text-xs text-slate-500", className)}>No Bob activity yet.</p>
    );
  }
  return (
    <ol className={cn("relative space-y-3 border-l border-slate-200 pl-4", className)}>
      {events.map((event) => {
        const Icon = ICON_BY_ACTION[event.action] ?? ActivityIcon;
        return (
          <li key={event.id} className="relative">
            <span className="absolute -left-[21px] top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
              <Icon className="h-2.5 w-2.5 text-slate-500" />
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-medium text-slate-800">{event.detail}</p>
              <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                {formatRelativeTime(event.timestamp)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
