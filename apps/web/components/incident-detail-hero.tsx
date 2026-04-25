"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { SiOpenai } from "react-icons/si";
import { BriefcaseBusiness, ChevronDown } from "lucide-react";
import { SiJira, SiSlack } from "react-icons/si";
import { LiveRelativeTime } from "@/components/live-relative-time";
import { Badge } from "@/components/ui/badge";
import { incidentHeroStatusBadges } from "@/lib/incident-hero-status";
import type { BobInvestigation } from "@/lib/bob-types";

type Props = {
  investigation: BobInvestigation | null;
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
  investigation,
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
  const [quickStatus, setQuickStatus] = useState<string | null>(null);

  const flash = (message: string) => {
    setQuickStatus(message);
    window.setTimeout(() => setQuickStatus(null), 2200);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
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

      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-start">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
            Recommended action
          </p>
          <p className="mt-1 text-base font-semibold leading-snug text-indigo-950">
            {recommendedAction?.trim()
              ? recommendedAction
              : "Review breach evidence, confirm owner, then route to governed remediation."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
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
        <div className="md:justify-self-end">
          <BobIncidentOpsList investigation={investigation} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap gap-1">
          <QuickActionHover
            label="Slack"
            tone="slack"
            icon={<SiSlack className="h-3.5 w-3.5" />}
            placement="up"
            items={
              <>
                <QuickMenuButton onClick={() => flash("Slack ping sent to Team manager.")}>
                  Ping Team manager
                </QuickMenuButton>
                <QuickMenuButton onClick={() => flash("Slack ping sent to Maya Chen (SOC lead).")}>
                  Ping SOC lead
                </QuickMenuButton>
                <QuickMenuButton onClick={() => flash("Slack ping sent to owner team channel.")}>
                  Ping owner channel
                </QuickMenuButton>
              </>
            }
          />
          <QuickActionHover
            label="Jira"
            tone="jira"
            icon={<SiJira className="h-3.5 w-3.5" />}
            placement="up"
            items={
              <>
                <QuickMenuButton onClick={() => flash("Jira ticket GOV-142 opened.")}>
                  Open GOV-142 ticket
                </QuickMenuButton>
                <QuickMenuButton onClick={() => flash("Jira escalation ticket GOV-911 opened.")}>
                  Open escalation ticket
                </QuickMenuButton>
              </>
            }
          />
          <QuickActionHover
            label="Routing"
            tone="neutral"
            placement="up"
            items={
              <>
                <QuickMenuButton onClick={() => flash("Routing set to Fleet owner lane.")}>
                  Route to Fleet owner
                </QuickMenuButton>
                <QuickMenuButton onClick={() => flash("Routing set to Bob queue (bounded).")}>
                  Route to Bob queue
                </QuickMenuButton>
              </>
            }
          />
          <QuickActionHover
            label="Tools"
            tone="neutral"
            placement="up"
            items={
              <>
                <QuickMenuButton onClick={() => flash("Opened logs view.")}>
                  Open Logs
                </QuickMenuButton>
                <QuickMenuButton onClick={() => flash("Opened traces view.")}>
                  Open Traces
                </QuickMenuButton>
                <QuickMenuButton onClick={() => flash("Opened runbook.")}>
                  Open Runbook
                </QuickMenuButton>
              </>
            }
          />
        </div>
        {quickStatus ? (
          <p className="text-[10px] font-medium text-indigo-700">{quickStatus}</p>
        ) : (
          <span className="text-[10px] text-slate-400">Quick actions</span>
        )}
      </div>
    </div>
  );
}

function BobIncidentOpsList({ investigation }: { investigation: BobInvestigation | null }) {
  const pingedTo = [
    "Team manager",
    "Maya Chen — SOC lead",
    investigation?.suggested_owner?.trim()
  ].filter(Boolean) as string[];

  const ticketKey = investigation
    ? `GOV-${420 + (investigation.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 800)}`
    : null;
  const tickets = ticketKey ? [ticketKey] : [];

  return (
    <div className="min-w-[220px] rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="grid grid-cols-1 gap-2 text-[11px]">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Pinged to
          </p>
          <ul className="mt-1 space-y-0.5 text-slate-700">
            {pingedTo.map((name) => (
              <li key={name} className="leading-snug">
                • {name}
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-slate-100 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Tickets
          </p>
          {tickets.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-slate-700">
              {tickets.map((t) => (
                <li key={t} className="leading-snug">
                  • {t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-slate-400">No tickets opened</p>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickActionHover({
  label,
  items,
  icon,
  tone = "neutral",
  placement = "down"
}: {
  label: string;
  items: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "slack" | "jira";
  placement?: "down" | "up";
}) {
  const toneCls =
    tone === "slack"
      ? "border-[#4A154B]/35 bg-[#4A154B]/5 text-[#4A154B] hover:border-[#4A154B]/55 hover:bg-[#4A154B]/10"
      : tone === "jira"
        ? "border-[#0052CC]/30 bg-[#0052CC]/5 text-[#0052CC] hover:border-[#0052CC]/50 hover:bg-[#0052CC]/10"
        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50";
  return (
    <div className="group relative">
      <button
        type="button"
        className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition ${toneCls}`}
      >
        {icon ? <span className="shrink-0">{icon}</span> : null}
        {label}
        <ChevronDown className="h-3 w-3 text-slate-400" />
      </button>
      <div
        className={`pointer-events-none absolute left-0 z-20 min-w-[180px] rounded-md border border-slate-200 bg-white p-1.5 opacity-0 shadow-lg transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 ${
          placement === "up" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+4px)]"
        }`}
      >
        {items}
      </div>
    </div>
  );
}

function QuickMenuButton({
  children,
  onClick
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded px-2 py-1 text-left text-[11px] text-slate-700 transition hover:bg-slate-100"
    >
      {children}
    </button>
  );
}
