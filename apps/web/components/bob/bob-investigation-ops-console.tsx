"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileClock, ShieldCheck } from "lucide-react";
import { setInvestigationOverride } from "@/lib/bob-state";
import type { BobActivityEvent, BobRecommendation } from "@/lib/bob-types";
import { cn } from "@/lib/cn";

type Props = {
  investigationId: string;
  title: string;
  targetLabel: string;
  initialStatus: string;
  activity: BobActivityEvent[];
  recommendations: BobRecommendation[];
};

type LogTab = "bob" | "telemetry" | "audit";

const KEY_PREFIX = "fleetrac:bob:ops:";

export function BobInvestigationOpsConsole({
  investigationId,
  title,
  targetLabel,
  initialStatus,
  activity,
  recommendations
}: Props) {
  const storageKey = `${KEY_PREFIX}${investigationId}`;
  const [assignedToBob, setAssignedToBob] = useState(false);
  const [incidentHandled, setIncidentHandled] = useState(false);
  const [activeLogTab, setActiveLogTab] = useState<LogTab>("bob");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        assignedToBob?: boolean;
        incidentHandled?: boolean;
      };
      setAssignedToBob(Boolean(parsed.assignedToBob));
      setIncidentHandled(Boolean(parsed.incidentHandled));
    } catch {
      // ignore malformed local state
    }
  }, [storageKey]);

  const save = (next: { assignedToBob: boolean; incidentHandled: boolean }) => {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const markAssigned = () => {
    const next = { assignedToBob: true, incidentHandled };
    setAssignedToBob(true);
    save(next);
    setInvestigationOverride(investigationId, {
      status: initialStatus === "draft" ? "ready_for_review" : undefined,
      note: "Assigned to Bob operations queue"
    });
    flash("Assigned to Bob queue.");
  };

  const markHandled = () => {
    const next = { assignedToBob, incidentHandled: true };
    setIncidentHandled(true);
    save(next);
    setInvestigationOverride(investigationId, {
      status: "monitoring_outcome",
      note: "Incident handled by Bob plan and moved to monitoring"
    });
    flash("Incident marked handled; moved to monitoring outcome.");
  };

  const reopen = () => {
    const next = { assignedToBob: false, incidentHandled: false };
    setAssignedToBob(false);
    setIncidentHandled(false);
    save(next);
    setInvestigationOverride(investigationId, {
      status: "ready_for_review",
      note: "Incident reopened for review"
    });
    flash("Investigation reopened for review.");
  };

  const logLines = useMemo(() => {
    if (activeLogTab === "bob") {
      return activity.slice(0, 14).map((e) => `${e.action} — ${e.detail}`);
    }
    if (activeLogTab === "telemetry") {
      return [
        `stream.observe target="${targetLabel}"`,
        `window.aggregate status="${initialStatus}"`,
        `recurrence.scan recommendations=${recommendations.length}`,
        `decision.trace investigation="${investigationId}"`
      ];
    }
    return [
      `audit.investigation.open id=${investigationId}`,
      `audit.reviewer.assignment lane=${assignedToBob ? "bob" : "human"}`,
      `audit.outcome.handled=${incidentHandled ? "true" : "false"}`,
      `audit.recommendations.count=${recommendations.length}`
    ];
  }, [
    activeLogTab,
    activity,
    targetLabel,
    initialStatus,
    recommendations.length,
    investigationId,
    assignedToBob,
    incidentHandled
  ]);

  return (
    <section className="rounded-lg border border-slate-300 bg-slate-100/60 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Bob operations console
          </p>
          <h2 className="mt-0.5 text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-600">
            Assign ownership, mark handling state, and execute Bob-backed plan with logs.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <StatePill on={assignedToBob} onLabel="Assigned to Bob" offLabel="Unassigned" />
          <StatePill on={incidentHandled} onLabel="Handled" offLabel="Open" />
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Action controls
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={markAssigned}
              className="inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Assign to Bob
            </button>
            <button
              type="button"
              onClick={markHandled}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark incident handled
            </button>
            <button
              type="button"
              onClick={reopen}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Re-open
            </button>
          </div>
          {toast ? (
            <p className="mt-2 text-[11px] font-medium text-indigo-700">{toast}</p>
          ) : null}

          <div className="mt-3 border-t border-slate-100 pt-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Proposed plan queue
            </p>
            {recommendations.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">No recommendations drafted yet.</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {recommendations.slice(0, 4).map((r) => (
                  <li
                    key={r.id}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700"
                  >
                    <span className="font-semibold text-slate-900">{r.title}</span>
                    <span className="ml-1 text-slate-500">· owner {r.owner_team}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Investigation logs
          </p>
          <div className="mt-2 flex gap-1">
            {([
              ["bob", "Bob run"],
              ["telemetry", "Telemetry"],
              ["audit", "Audit"]
            ] as Array<[LogTab, string]>).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveLogTab(id)}
                className={cn(
                  "rounded px-2 py-1 text-[10px] font-semibold",
                  activeLogTab === id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2 max-h-36 overflow-y-auto rounded-md border border-slate-200 bg-slate-950 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-slate-200">
            {logLines.map((line, idx) => (
              <p key={idx} className="break-all border-b border-white/10 py-1 last:border-0">
                {line}
              </p>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-slate-500">
            Includes Bob activity plus operational telemetry/audit traces for this investigation.
          </p>
        </div>
      </div>
    </section>
  );
}

function StatePill({
  on,
  onLabel,
  offLabel
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 ring-1 ring-inset",
        on
          ? "bg-emerald-50 text-emerald-800 ring-emerald-300"
          : "bg-white text-slate-600 ring-slate-300"
      )}
    >
      {on ? onLabel : offLabel}
    </span>
  );
}

