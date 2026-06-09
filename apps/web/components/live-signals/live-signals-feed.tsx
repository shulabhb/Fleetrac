"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { LiveSignalsRawLogPanel } from "@/components/live-signals/live-signals-raw-log-panel";
import { SimulatorControls } from "@/components/live-signals/simulator-controls";
import { useGovernanceData } from "@/hooks/use-governance-data";
import { useEventStream } from "@/hooks/use-event-stream";
import { mapLiveSignalsFromApi, type GovernanceLiveSignal } from "@/lib/governance-merge";
import type { LiveSignalSeverity } from "@/lib/live-signals-types";
import {
  routeToEvidenceLibraryIncidentRecord,
  routeToIncidentsOwnerQueue,
  routeToSystem
} from "@/lib/routes";
import { cn } from "@/lib/cn";

type FeedTab = "governed" | "raw";

function severityTone(sev: LiveSignalSeverity): "high" | "medium" | "low" {
  if (sev === "Critical" || sev === "High") return "high";
  if (sev === "Medium") return "medium";
  return "low";
}

export function LiveSignalsFeed() {
  const [tab, setTab] = useState<FeedTab>("governed");
  const [severity, setSeverity] = useState<LiveSignalSeverity | "all">("all");
  const [category, setCategory] = useState<string>("all");
  const { enabled, liveSignals, ingestLog, simulatorStatus, refresh } = useGovernanceData();
  useEventStream(refresh, enabled);

  const signals = useMemo((): GovernanceLiveSignal[] => {
    return mapLiveSignalsFromApi(liveSignals);
  }, [liveSignals]);

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
      <SimulatorControls status={simulatorStatus} onRefresh={refresh} />

      <div className="inline-flex rounded-md border border-slate-200 p-0.5">
        <button
          type="button"
          onClick={() => setTab("governed")}
          className={cn(
            "rounded px-3 py-1.5 text-[11px] font-semibold transition",
            tab === "governed" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
          )}
        >
          Governed signals
        </button>
        <button
          type="button"
          onClick={() => setTab("raw")}
          className={cn(
            "rounded px-3 py-1.5 text-[11px] font-semibold transition",
            tab === "raw" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
          )}
        >
          View raw simulated logs
        </button>
      </div>

      {tab === "raw" ? (
        <LiveSignalsRawLogPanel rows={ingestLog?.items ?? []} />
      ) : (
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
            {filtered.length} signals · live from API
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-slate-600">
            No live signals yet. Use{" "}
            <span className="font-medium text-slate-800">Run pitch</span> or{" "}
            <span className="font-medium text-slate-800">Start continuous</span> above to ingest
            telemetry.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((s) => (
              <SignalRow key={s.id} signal={s} />
            ))}
          </ul>
        )}
      </Card>
      )}
    </div>
  );
}

function SignalRow({ signal }: { signal: GovernanceLiveSignal }) {
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
          {signal.governanceSource === "api" ? (
            <Badge tone="info" size="xs">
              Live API
            </Badge>
          ) : null}
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
          {signal.modelLabel ? (
            <>
              <span className="font-medium text-slate-700">{signal.modelLabel}</span>
              <span className="text-slate-300"> · </span>
            </>
          ) : null}
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
