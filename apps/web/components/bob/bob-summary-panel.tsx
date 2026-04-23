import Link from "next/link";
import { ArrowRight, RefreshCcw } from "lucide-react";
import type { BobInvestigation } from "@/lib/bob-types";
import { cn } from "@/lib/cn";
import { BobEyebrow } from "./bob-icon";
import {
  ConfidenceBadge,
  InvestigationStatusBadge,
  ApprovalBadge
} from "./bob-badges";
import { EvidenceList } from "./evidence-list";
import { formatRelativeTime } from "@/lib/format";
import {
  routeToBobForTarget,
  routeToBobInvestigation,
  type BobTargetType
} from "@/lib/routes";

type BobSummaryPanelProps = {
  investigation: BobInvestigation;
  variant?: "full" | "compact";
  href?: string;
  className?: string;
};

/**
 * The Bob Analysis module embedded across detail pages (incident / system /
 * control). "full" shows the whole evidence list; "compact" drops the
 * evidence block for tighter surfaces.
 */
export function BobSummaryPanel({
  investigation,
  variant = "full",
  href,
  className
}: BobSummaryPanelProps) {
  const top = investigation.recommendations.find(
    (r) => r.id === investigation.top_recommendation_id
  );
  const detailHref = href ?? routeToBobInvestigation(investigation.id);

  return (
    <div
      className={cn(
        "relative rounded-lg border border-slate-200 bg-white",
        className
      )}
    >
      <span
        aria-hidden
        className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r bg-gradient-to-b from-indigo-400 to-indigo-200"
      />
      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <BobEyebrow />
            <h3 className="mt-1.5 text-sm font-semibold tracking-tight text-slate-900">
              {investigation.title}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <InvestigationStatusBadge status={investigation.status} />
              <ConfidenceBadge
                tier={investigation.confidence}
                score={investigation.confidence_score}
              />
              {investigation.recurring_issue_flag ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
                  Recurring pattern
                </span>
              ) : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              Last run
            </p>
            <p className="text-xs font-medium tabular-nums text-slate-700">
              {formatRelativeTime(investigation.last_bob_run_at)}
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          {investigation.summary}
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <SummaryField
            label="Likely root cause"
            body={investigation.likely_root_cause}
          />
          <SummaryField
            label="Why it matters"
            body={investigation.why_it_matters}
          />
        </div>

        {investigation.alternative_hypothesis ? (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Alternative hypothesis
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-700">
              {investigation.alternative_hypothesis}
            </p>
          </div>
        ) : null}

        {top ? (
          <div className="mt-3 rounded-md border border-indigo-100 bg-indigo-50/50 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                  Top recommendation
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {top.title}
                </p>
                <p className="mt-1 text-xs leading-snug text-slate-600">
                  {top.rationale_summary}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                  <span>
                    <span className="text-slate-400">Owner</span>{" "}
                    <span className="font-medium text-slate-700">
                      {top.owner_team}
                    </span>
                  </span>
                  <ApprovalBadge status={top.approval_status} />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {variant === "full" && investigation.evidence.length > 0 ? (
          <div className="mt-4">
            <p className="label-eyebrow mb-1.5">Evidence reviewed</p>
            <EvidenceList evidence={investigation.evidence.slice(0, 5)} />
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <RefreshCcw className="h-3 w-3" />
              Updated {formatRelativeTime(investigation.updated_at)}
            </span>
            <span>
              Suggested owner:{" "}
              <span className="font-medium text-slate-700">
                {investigation.suggested_owner}
              </span>
            </span>
          </div>
          <Link
            href={detailHref}
            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50"
          >
            Open investigation
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function SummaryField({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="label-eyebrow mb-1">{label}</p>
      <p className="text-xs leading-relaxed text-slate-700">{body}</p>
    </div>
  );
}

/** Minimal fallback when no investigation exists yet for a target. */
export function BobEmptyPanel({
  targetType,
  targetId,
  className
}: {
  targetType: "incident" | "system" | "control";
  targetId: string;
  className?: string;
}) {
  const body =
    targetType === "system"
      ? {
          lead: "Bob has not opened a system-level investigation here.",
          explain:
            "Bob opens a system-level read when telemetry drifts past a governance threshold, a recurrence pattern emerges across incidents, or a control fires repeatedly on this system.",
          triggers: [
            "Telemetry drift or grounding degradation beyond threshold",
            "Recurring incidents across multiple rules",
            "Repeated control fires on the same system",
            "Audit coverage floor breach"
          ],
          cta: "Ask Bob to analyze now"
        }
      : targetType === "control"
        ? {
            lead: `Bob has not opened an analysis on this ${targetType} yet.`,
            explain:
              "Bob analyzes a control when it fires repeatedly, when threshold tuning would reduce noise, or when a correlated root cause appears across the incidents it raised.",
            triggers: [],
            cta: "Run Bob analysis"
          }
        : {
            lead: `Bob has not opened an investigation on this ${targetType} yet.`,
            explain:
              "When telemetry shifts or a recurrence pattern is detected, Bob will draft an investigation here with evidence, likely root cause, and a recommended next action for human approval.",
            triggers: [],
            cta: "Run Bob investigation"
          };

  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-indigo-200 bg-indigo-50/40 p-4",
        className
      )}
    >
      <BobEyebrow />
      <p className="mt-2 text-sm text-slate-700">{body.lead}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        {body.explain}
      </p>
      {body.triggers.length > 0 ? (
        <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-[11px] text-slate-600 md:grid-cols-2">
          {body.triggers.map((t) => (
            <li key={t} className="flex items-start gap-1.5">
              <span
                aria-hidden
                className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-indigo-400"
              />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <Link
        href={routeToBobForTarget(targetType as BobTargetType, targetId)}
        className="mt-3 inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
      >
        {body.cta}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
