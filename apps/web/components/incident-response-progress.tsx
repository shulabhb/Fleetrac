"use client";

import { migrateLegacyIncidentStatus, type IncidentLifecycleStatus } from "@/lib/incident-lifecycle";

const STEPS: { status: IncidentLifecycleStatus; label: string }[] = [
  { status: "open", label: "Open" },
  { status: "pending", label: "Review / act" },
  { status: "closed", label: "Closed" }
];

export function IncidentResponseProgress({ incidentStatus }: { incidentStatus: string }) {
  const current = migrateLegacyIncidentStatus(incidentStatus);
  const activeIndex = STEPS.findIndex((s) => s.status === current);

  return (
    <div className="mt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Progress</p>
      <div className="mt-1.5 flex gap-1">
        {STEPS.map((step, idx) => {
          const filled = idx <= activeIndex;
          const active = idx === activeIndex && current !== "closed";
          return (
            <div key={step.status} className="min-w-0 flex-1">
              <div
                className={`h-2 rounded-full transition-colors ${
                  filled ? "bg-indigo-600" : "bg-slate-200"
                } ${active ? "ring-2 ring-indigo-200 ring-offset-1" : ""}`}
                title={step.label}
              />
              <p
                className={`mt-1 truncate text-center text-[9px] font-medium leading-tight ${
                  idx === activeIndex ? "text-indigo-900" : filled ? "text-slate-600" : "text-slate-400"
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
