"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { LiveSignalsRawLogPanel } from "@/components/live-signals/live-signals-raw-log-panel";
import { SimulatorControls } from "@/components/live-signals/simulator-controls";
import { TraceGroupPanel } from "@/components/live-signals/trace-group-panel";
import { useGovernanceData } from "@/hooks/use-governance-data";
import { useEventStream } from "@/hooks/use-event-stream";
import { fetchIngestLog, type IngestLogRowDTO } from "@/lib/governance-api";
import {
  groupSignalsByTrace,
  mapLiveSignalsFromApi,
  type GovernanceLiveSignal
} from "@/lib/governance-merge";
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
  const [severity, setSeverity] = useState<LiveSignalSeverity | "all" | "healthy">("all");
  const [category, setCategory] = useState<string>("all");
  const [systemFilter, setSystemFilter] = useState<string>("all");
  const [groupByTrace, setGroupByTrace] = useState(true);
  const { enabled, liveSignals, simulatorStatus, governanceSystems, refresh } = useGovernanceData();
  const [rawRows, setRawRows] = useState<IngestLogRowDTO[]>([]);
  const [rawLoadError, setRawLoadError] = useState<string | null>(null);
  useEventStream(refresh, enabled);

  useEffect(() => {
    if (tab !== "raw" || !enabled) return;

    let cancelled = false;
    const loadRaw = async () => {
      const data = await fetchIngestLog(150);
      if (cancelled) return;
      if (!data) {
        setRawLoadError(
          "Ingest log API unavailable (500). Restart the API — it will auto-migrate the SQLite schema."
        );
        return;
      }
      setRawLoadError(null);
      setRawRows(data.items);
    };

    void loadRaw();
    const pollId = window.setInterval(() => void loadRaw(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [tab, enabled]);

  const fleetSystems = governanceSystems?.items ?? [];

  const signals = useMemo((): GovernanceLiveSignal[] => {
    return mapLiveSignalsFromApi(liveSignals);
  }, [liveSignals]);

  const categories = useMemo(
    () => Array.from(new Set(signals.map((s) => s.category))).sort(),
    [signals]
  );

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      if (severity === "healthy" && s.severity !== "Healthy") return false;
      if (severity !== "all" && severity !== "healthy" && s.severity !== severity) return false;
      if (category !== "all" && s.category !== category) return false;
      if (systemFilter !== "all" && s.canonicalSystemId !== systemFilter) return false;
      return true;
    });
  }, [signals, severity, category, systemFilter]);

  const traceGroups = useMemo(() => groupSignalsByTrace(filtered), [filtered]);

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
        <>
          {rawLoadError ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-900">
              {rawLoadError}
            </p>
          ) : null}
          <LiveSignalsRawLogPanel rows={rawRows} simulatorStatus={simulatorStatus} />
        </>
      ) : (
        <Card className="overflow-hidden shadow-none">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5">
            <Select
              value={severity}
              onChange={(e) =>
                setSeverity(e.target.value as LiveSignalSeverity | "all" | "healthy")
              }
            >
              <option value="all">Any severity</option>
              <option value="healthy">Healthy only</option>
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
            <Select value={systemFilter} onChange={(e) => setSystemFilter(e.target.value)}>
              <option value="all">All systems</option>
              {fleetSystems.map((s) => (
                <option key={s.system_id} value={s.system_id}>
                  {s.display_system_id} — {s.system_name_alias ?? s.system_name}
                </option>
              ))}
            </Select>
            <button
              type="button"
              onClick={() => setGroupByTrace((v) => !v)}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm",
                groupByTrace
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-800"
              )}
            >
              Group by trace
            </button>
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
          ) : groupByTrace ? (
            <TraceGroupPanel groups={traceGroups} />
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
          {signal.traceId ? (
            <Badge tone="neutral" size="xs">
              trace {signal.traceId.slice(0, 8)}…
            </Badge>
          ) : null}
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
          <Link
            href={routeToSystem(signal.canonicalSystemId)}
            className="font-medium hover:text-slate-900"
          >
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
