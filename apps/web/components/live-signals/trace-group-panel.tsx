"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { GovernanceLiveSignal } from "@/lib/governance-merge";
import { routeToIncidentsOwnerQueue, routeToSystem } from "@/lib/routes";
import { cn } from "@/lib/cn";

type TraceGroup = {
  traceId: string;
  signals: GovernanceLiveSignal[];
};

function severityTone(sev: GovernanceLiveSignal["severity"]): "high" | "medium" | "low" {
  if (sev === "Critical" || sev === "High") return "high";
  if (sev === "Medium") return "medium";
  return "low";
}

function spanDepth(signal: GovernanceLiveSignal, peers: GovernanceLiveSignal[]): number {
  if (!signal.parentSpanId) return 0;
  const parent = peers.find((p) => p.spanId === signal.parentSpanId);
  if (!parent || parent.id === signal.id) return 1;
  return 1 + spanDepth(parent, peers);
}

function sortSignalsForTrace(signals: GovernanceLiveSignal[]): GovernanceLiveSignal[] {
  return [...signals].sort((a, b) => {
    const da = spanDepth(a, signals);
    const db = spanDepth(b, signals);
    if (da !== db) return da - db;
    return a.summary.localeCompare(b.summary);
  });
}

export function TraceGroupPanel({ groups }: { groups: TraceGroup[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (traceId: string) => {
    setExpanded((prev) => ({ ...prev, [traceId]: !prev[traceId] }));
  };

  return (
    <ul className="divide-y divide-slate-100">
      {groups.map((group) => {
        const head = group.signals[0];
        const isOpen = expanded[group.traceId] ?? false;
        const hasRisk = group.signals.some((s) => s.severity !== "Healthy");
        return (
          <li key={group.traceId} className="px-4 py-3">
            <button
              type="button"
              onClick={() => toggle(group.traceId)}
              className="flex w-full items-start gap-2 text-left"
            >
              <span className="mt-0.5 text-[11px] text-slate-400">{isOpen ? "▼" : "▶"}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={hasRisk ? "high" : "neutral"} size="xs">
                    {group.signals.length} spans
                  </Badge>
                  <span className="font-mono text-[10px] text-slate-500">
                    trace {group.traceId.slice(0, 12)}…
                  </span>
                  {head ? (
                    <Badge tone="outline" size="xs">
                      {head.systemId}
                    </Badge>
                  ) : null}
                </div>
                {head ? (
                  <p className="mt-1 text-sm font-semibold text-slate-900">{head.summary}</p>
                ) : null}
              </div>
            </button>
            {isOpen ? (
              <ul className={cn("mt-2 space-y-2 border-l border-slate-100 pl-6")}>
                {sortSignalsForTrace(group.signals).map((s) => {
                  const depth = spanDepth(s, group.signals);
                  return (
                  <li
                    key={s.id}
                    className="text-[12px] text-slate-700"
                    style={{ marginLeft: depth > 0 ? `${depth * 12}px` : undefined }}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      {depth > 0 ? (
                        <span className="font-mono text-[10px] text-slate-400">↳ child</span>
                      ) : null}
                      <Badge tone={severityTone(s.severity)} size="xs">
                        {s.severity}
                      </Badge>
                      <span>{s.summary}</span>
                      {s.latencyMs != null ? (
                        <span className="text-[10px] text-slate-400">{s.latencyMs}ms</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      <Link
                        href={routeToSystem(s.canonicalSystemId)}
                        className="font-medium hover:text-slate-900"
                      >
                        {s.systemName}
                      </Link>
                      <span className="text-slate-300"> · </span>
                      {s.detectedAt}
                      {s.incidentLinked && s.incidentId ? (
                        <>
                          <span className="text-slate-300"> · </span>
                          <Link
                            href={routeToIncidentsOwnerQueue(s.ownerTeam)}
                            className="font-medium text-slate-700 hover:text-slate-900"
                          >
                            {s.incidentId}
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
