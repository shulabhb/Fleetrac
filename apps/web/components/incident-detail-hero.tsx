import Link from "next/link";
import { SiOpenai } from "react-icons/si";
import { BriefcaseBusiness } from "lucide-react";
import { LiveRelativeTime } from "@/components/live-relative-time";
import { Badge } from "@/components/ui/badge";
import { incidentHeroStatusBadges } from "@/lib/incident-hero-status";

type Props = {
  recommendedAction?: string | null;
  investigationHref: string;
  hasInvestigation: boolean;
  actionHref: string;
  hasGovernedAction: boolean;
  createdAt: string | number | Date | null | undefined;
  incidentStatus: string | null | undefined;
  reviewRequired?: boolean | null;
  escalationStatus?: string | null;
};

export function IncidentDetailHero({
  recommendedAction,
  investigationHref,
  hasInvestigation,
  actionHref,
  hasGovernedAction,
  createdAt,
  incidentStatus,
  reviewRequired,
  escalationStatus
}: Props) {
  const statusBadges = incidentHeroStatusBadges({
    incident_status: incidentStatus,
    review_required: reviewRequired,
    escalation_status: escalationStatus
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <p className="label-eyebrow">Incident hero</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Reported</span>
          <LiveRelativeTime value={createdAt} className="font-semibold text-slate-800" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Status
          </span>
          {statusBadges.map((b) => (
            <Badge key={b.key} tone={b.tone} size="xs" className="font-semibold">
              {b.label}
            </Badge>
          ))}
        </div>
      </div>

      <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
        Recommended action
      </p>
      <p className="mt-1 text-base font-semibold leading-snug text-indigo-950">
        {recommendedAction?.trim()
          ? recommendedAction
          : "Review breach evidence, confirm owner, then route to governed remediation."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={investigationHref}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-indigo-300 bg-indigo-600 px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <SiOpenai className="h-4 w-4 shrink-0" />
          {hasInvestigation ? "Open Bob investigation" : "Start Bob investigation"}
        </Link>
        <Link
          href={actionHref}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-[12px] font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
        >
          <BriefcaseBusiness className="h-4 w-4 shrink-0 text-slate-600" />
          {hasGovernedAction ? "Review governed action" : "Open Action Center"}
        </Link>
      </div>
    </div>
  );
}
