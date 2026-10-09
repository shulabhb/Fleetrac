"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { LiveSignalsRawLogPanel } from "@/components/live-signals/live-signals-raw-log-panel";
import { TraceGroupPanel } from "@/components/live-signals/trace-group-panel";
import { useEventStream } from "@/hooks/use-event-stream";
import type {
  GovernanceSystemsResponseDTO,
  IngestLogRowDTO,
  LiveSignalsResponseDTO,
  SimulatorStatusDTO
} from "@/lib/governance-api";
import {
  buildTraceGroupsForFeed,
  filterGovernedLiveSignals,
  mapLiveSignalsFromApi,
  type GovernanceLiveSignal
} from "@/lib/governance-merge";
import {
  filterDemoAgents,
  isDemoAgent,
  sortDemoAgentsFirst
} from "@/lib/governed-fleet-registry";
import {
  linkageCopy,
  matchesSignalFilters,
  monitorSignalState,
  type MonitorSignalState
} from "@/lib/live-signal-display";
import type { LiveSignalSeverity } from "@/lib/live-signals-types";
import {
  routeToIncidentsQueue,
  routeToSystem
} from "@/lib/routes";
import { cn } from "@/lib/cn";

type FeedTab = "governed" | "raw";

type LiveSignalsFeedProps = {
  liveSignals: LiveSignalsResponseDTO | null;
  ingestLog: { items: IngestLogRowDTO[] } | null;
  simulatorStatus: SimulatorStatusDTO | null;
  governanceSystems: GovernanceSystemsResponseDTO | null;
  refreshObserve: (force?: boolean) => void;
};

function severityTone(sev: LiveSignalSeverity): "high" | "medium" | "low" {
  if (sev === "Critical" || sev === "High") return "high";
  if (sev === "Medium") return "medium";
  return "low";
}

export function LiveSignalsFeed({
  liveSignals,
  ingestLog,
  simulatorStatus,
  governanceSystems,
  refreshObserve
}: LiveSignalsFeedProps) {
  const [tab, setTab] = useState<FeedTab>("governed");
  const [severity, setSeverity] = useState<LiveSignalSeverity | "all" | "healthy">("all");
  const [eventType, setEventType] = useState("all");
  const [signalState, setSignalState] = useState<MonitorSignalState | "all">("all");
  const [systemFilter, setSystemFilter] = useState<string>("all");
  const [groupByTrace, setGroupByTrace] = useState(false);

  const rawRows = ingestLog?.items ?? [];

  useEventStream(refreshObserve, true);

  useEffect(() => {
    void refreshObserve(true);
  }, [refreshObserve]);

  useEffect(() => {
    if (tab !== "raw") return;
    void refreshObserve(true);
    const pollId = window.setInterval(() => void refreshObserve(true), 2000);
    return () => window.clearInterval(pollId);
  }, [tab, refreshObserve]);

  const fleetSystems = useMemo(
    () => sortDemoAgentsFirst(filterDemoAgents(governanceSystems?.items ?? [])),
    [governanceSystems]
  );

  const allSignals = useMemo((): GovernanceLiveSignal[] => {
    return mapLiveSignalsFromApi(liveSignals);
  }, [liveSignals]);

  const governedSignals = useMemo(
    () =>
      filterGovernedLiveSignals(allSignals).filter((s) => isDemoAgent(s.canonicalSystemId)),
    [allSignals]
  );

  const eventTypes = useMemo(
    () => Array.from(new Set(governedSignals.map((s) => s.eventType).filter(Boolean) as string[])).sort(),
    [governedSignals]
  );

  const filteredGoverned = useMemo(() => {
    const rank = (state: MonitorSignalState) => {
      if (state === "Control breached" || state === "Regression") return 0;
      if (state === "Post-action verification") return 1;
      if (state === "Signal degrading") return 2;
      return 3;
    };
    return governedSignals.filter((s) => {
      if (severity === "healthy" && s.severity !== "Healthy") return false;
      if (severity !== "all" && severity !== "healthy" && s.severity !== severity) return false;
      const state = monitorSignalState({
        operationType: s.eventType,
        normalizedSignalType: s.normalizedSignalType,
        signalState: s.signalState,
        severity: s.severity,
        incidentId: s.incidentId
      });
      return matchesSignalFilters(
        { systemId: s.canonicalSystemId, eventType: s.eventType ?? "", state },
        { systemId: systemFilter, eventType, state: signalState }
      );
    }).sort((a, b) => {
      const aState = monitorSignalState({
        operationType: a.eventType,
        normalizedSignalType: a.normalizedSignalType,
        signalState: a.signalState,
        severity: a.severity,
        incidentId: a.incidentId
      });
      const bState = monitorSignalState({
        operationType: b.eventType,
        normalizedSignalType: b.normalizedSignalType,
        signalState: b.signalState,
        severity: b.severity,
        incidentId: b.incidentId
      });
      return rank(aState) - rank(bState);
    });
  }, [governedSignals, severity, eventType, signalState, systemFilter]);

  const traceGroups = useMemo(
    () => buildTraceGroupsForFeed(allSignals, filteredGoverned),
    [allSignals, filteredGoverned]
  );

  const rawLoadError =
    ingestLog === null
      ? "Ingest log unavailable. Confirm the API is running on port 8000 and refresh this page."
      : null;

  return (
    <div className="space-y-5">
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
          Raw ingest log
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
            <Select value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="all">Any event type</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
            <Select
              value={signalState}
              onChange={(e) => setSignalState(e.target.value as MonitorSignalState | "all")}
            >
              <option value="all">Any signal state</option>
              <option value="Healthy">Healthy</option>
              <option value="Signal degrading">Signal degrading</option>
              <option value="Control breached">Control breached</option>
              <option value="Post-action verification">Post-action verification</option>
              <option value="Regression">Regression</option>
            </Select>
            <Select value={systemFilter} onChange={(e) => setSystemFilter(e.target.value)}>
              <option value="all">All focus agents</option>
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
              {filteredGoverned.length} signals · live from API
            </p>
          </div>

          {filteredGoverned.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-slate-600">
              {governedSignals.length === 0
                ? "Start simulator to see runtime telemetry."
                : "No events match these filters."}
            </div>
          ) : groupByTrace ? (
            <TraceGroupPanel groups={traceGroups} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredGoverned.map((s) => (
                <SignalRow key={s.id} signal={s} />
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

function rowState(signal: GovernanceLiveSignal): MonitorSignalState {
  return monitorSignalState({
    operationType: signal.eventType,
    normalizedSignalType: signal.normalizedSignalType,
    signalState: signal.signalState,
    severity: signal.severity,
    incidentId: signal.incidentId
  });
}

function SignalRow({ signal }: { signal: GovernanceLiveSignal }) {
  const state = rowState(signal);
  const linked = Boolean(signal.incidentLinked && signal.incidentId);
  const incidentHref = linked
    ? routeToIncidentsQueue({ incidentId: signal.incidentId })
    : null;

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={state === "Healthy" || state === "Signal degrading" ? "low" : severityTone(signal.severity)} size="xs">
            {state}
          </Badge>
          <span className="text-[11px] text-slate-500">{signal.detectedAt}</span>
        </div>
        <p className="mt-1.5 text-sm font-semibold text-slate-900">
          {(signal.eventType ?? "event").replace(/_/g, " ")}
          {signal.keyMetric ? ` · ${signal.keyMetric}` : ""}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-600">
          <Link
            href={routeToSystem(signal.canonicalSystemId)}
            className="font-medium hover:text-slate-900"
          >
            {signal.systemName}
          </Link>
          {signal.traceId ? (
            <>
              <span className="text-slate-300"> · </span>
              <span className="font-mono text-slate-500">trace {signal.traceId.slice(0, 12)}</span>
            </>
          ) : null}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-600">{linkageCopy(state, signal.incidentId)}</p>
      </div>
      {incidentHref ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={incidentHref}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 shadow-sm hover:border-slate-300"
          >
            Review risk
          </Link>
        </div>
      ) : null}
    </li>
  );
}
