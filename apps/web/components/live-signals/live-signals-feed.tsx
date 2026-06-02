"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import {
  liveRuntimeSignals,
  type LiveRuntimeSignal,
  type LiveSignalSeverity
} from "@/lib/live-signals-mock";
import {
  routeToEvidenceLibraryIncidentRecord,
  routeToIncidentsOwnerQueue,
  routeToSystem
} from "@/lib/routes";

function severityTone(sev: LiveSignalSeverity): "high" | "medium" | "low" {
  if (sev === "Critical" || sev === "High") return "high";
  if (sev === "Medium") return "medium";
  return "low";
}

export function LiveSignalsFeed() {
  const [severity, setSeverity] = useState<LiveSignalSeverity | "all">("all");
  const [category, setCategory] = useState<string>("all");

  const signals = useMemo(() => liveRuntimeSignals(), []);

  const categories = useMemo(
    () => Array.from(new Set(signals.map((s) => s.category))).sort(),
    [signals]
  );

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      if (severity !== "all" && s.severity !== severity) return false;
      if (category !== "all" && s.category !== category) return false;
      return true;
    });
  }, [signals, severity, category]);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden shadow-none">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5">
          <Select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as LiveSignalSeverity | "all")}
          >
            <option value="all">Any severity</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">Any category</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <p className="ml-auto text-[11px] tabular-nums text-slate-500">
            {filtered.length} signals
          </p>
        </div>

        <ul className="divide-y divide-slate-100">
          {filtered.map((s) => (
            <SignalRow key={s.id} signal={s} />
          ))}
        </ul>
      </Card>
    </div>
  );
}

function SignalRow({ signal }: { signal: LiveRuntimeSignal }) {
  const incidentHref =
    signal.incidentLinked && signal.incidentId
      ? routeToEvidenceLibraryIncidentRecord(signal.incidentId, signal.ownerTeam)
      : routeToIncidentsOwnerQueue(signal.ownerTeam);

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={severityTone(signal.severity)} size="xs">
            {signal.severity}
          </Badge>
          <Badge tone="outline" size="xs">
            {signal.category}
          </Badge>
          {signal.incidentLinked ? (
            <Badge tone="info" size="xs">
              Incident linked
            </Badge>
          ) : (
            <Badge tone="neutral" size="xs">
              Monitoring
            </Badge>
          )}
        </div>
        <p className="mt-1.5 text-sm font-semibold text-slate-900">{signal.summary}</p>
        <p className="mt-0.5 text-[11px] text-slate-600">
          <Link href={routeToSystem(signal.systemId)} className="font-medium hover:text-slate-900">
            {signal.systemName}
          </Link>
          <span className="text-slate-300"> · </span>
          {signal.ownerTeam}
          <span className="text-slate-300"> · </span>
          <span className="text-slate-500">{signal.detectedAt}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link
          href={incidentHref}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 shadow-sm hover:border-slate-300"
        >
          {signal.incidentLinked ? "Open evidence" : "Open queue"}
        </Link>
      </div>
    </li>
  );
}
