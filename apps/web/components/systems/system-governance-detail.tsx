"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FleetracAnalysisPanel } from "@/components/fleetrac/fleetrac-analysis-panel";
import { Card, CardHeader } from "@/components/ui/card";
import { DisclosureSection } from "@/components/shared/disclosure-section";
import { LiveSignalsRawLogPanel } from "@/components/live-signals/live-signals-raw-log-panel";
import { useGovernanceData } from "@/hooks/use-governance-data";
import {
  fetchGovernanceSystemDetail,
  fetchSystemControls,
  fetchSystemIncidents,
  fetchSystemSignals,
  fetchSystemTelemetry,
  type GovernanceSystemDetailDTO,
  type SystemControlDTO,
  type SystemIncidentDTO,
  type SystemTelemetryPointDTO
} from "@/lib/governance-api";
import { mapLiveSignalsFromApi } from "@/lib/governance-merge";
import {
  routeToEvidenceLibraryIncidentRecord,
  routeToIncidentsOwnerQueue,
  routes
} from "@/lib/routes";
import { cn } from "@/lib/cn";

type Props = {
  systemId: string;
};

export function SystemGovernanceDetail({ systemId }: Props) {
  const { actions, evidenceByAlias, ingestLog, refresh } = useGovernanceData();
  const [detail, setDetail] = useState<GovernanceSystemDetailDTO | null>(null);
  const [incidents, setIncidents] = useState<SystemIncidentDTO[]>([]);
  const [telemetry, setTelemetry] = useState<SystemTelemetryPointDTO[]>([]);
  const [controls, setControls] = useState<SystemControlDTO[]>([]);
  const [signals, setSignals] = useState(
    null as Awaited<ReturnType<typeof fetchSystemSignals>>
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [d, inc, tel, ctrl, sig] = await Promise.all([
        fetchGovernanceSystemDetail(systemId),
        fetchSystemIncidents(systemId),
        fetchSystemTelemetry(systemId),
        fetchSystemControls(systemId),
        fetchSystemSignals(systemId, 30)
      ]);
      if (cancelled) return;
      setDetail(d);
      setIncidents(inc?.items ?? []);
      setTelemetry(tel?.items ?? []);
      setControls(ctrl?.items ?? []);
      setSignals(sig);
    })();
    return () => {
      cancelled = true;
    };
  }, [systemId]);

  const systemActions = useMemo(
    () => actions.filter((a) => a.system_id === systemId),
    [actions, systemId]
  );

  const openIncidents = incidents.filter((i) => i.lifecycle !== "Closed");
  const latestOpen = openIncidents[0];
  const latestEvidence = latestOpen
    ? evidenceByAlias[latestOpen.alias_id ?? latestOpen.id]
    : null;

  const signalRows = mapLiveSignalsFromApi(signals);
  const ingestRows = (ingestLog?.items ?? []).filter((r) => r.system_id === systemId);

  const latencySeries = telemetry.filter((p) => p.latency_ms != null).slice(-20);
  const groundingSeries = telemetry.filter((p) => p.grounding_score != null).slice(-20);

  if (!detail) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600">
        Loading system from governance API…
      </div>
    );
  }

  const displayName = detail.system_name_alias ?? detail.system_name;

  return (
    <div className="space-y-5">
      <Card className="shadow-none">
        <div className="border-b border-slate-100 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {detail.display_system_id} · {detail.archetype}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{displayName}</h2>
          <p className="mt-1 text-[13px] text-slate-600">{detail.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
            <span>{detail.owner_team}</span>
            <span className="text-slate-300">·</span>
            <span>{detail.cloud_provider} / {detail.cloud_region}</span>
            <span className="text-slate-300">·</span>
            <span>{detail.open_incidents} open incidents</span>
            <span className="text-slate-300">·</span>
            <span>
              Last signal: {detail.last_signal_at ? new Date(detail.last_signal_at).toLocaleString() : "—"}
            </span>
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <MetricTile label="Latency (recent)" value={formatSeries(latencySeries.map((p) => p.latency_ms!))} />
          <MetricTile label="Grounding (recent)" value={formatSeries(groundingSeries.map((p) => p.grounding_score!))} />
          <MetricTile
            label="Unsupported claim rate"
            value={formatSeries(
              telemetry
                .filter((p) => p.unsupported_claim_rate != null)
                .slice(-10)
                .map((p) => p.unsupported_claim_rate!)
            )}
          />
        </div>
      </Card>

      {latestEvidence ? (
        <FleetracAnalysisPanel
          incidentId={latestOpen?.alias_id ?? latestOpen?.id}
          summary={latestEvidence.fleetrac_analysis.summary}
          confidence={
            latestEvidence.fleetrac_analysis.confidence >= 0.75
              ? "High"
              : latestEvidence.fleetrac_analysis.confidence >= 0.5
                ? "Medium"
                : "Low"
          }
          recommendedAction={latestEvidence.fleetrac_analysis.recommended_actions[0]}
        />
      ) : (
        <FleetracAnalysisPanel summary={undefined} />
      )}

      <DisclosureSection title="Open incidents" defaultOpen>
        {openIncidents.length === 0 ? (
          <p className="text-[13px] text-slate-600">
            No open incidents. Run a simulator pitch or scenario to generate governance events.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {openIncidents.map((inc) => (
              <li key={inc.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{inc.title}</p>
                  <p className="text-[11px] text-slate-600">
                    {inc.alias_id ?? inc.id} · {inc.lifecycle} · {inc.severity}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={routeToIncidentsOwnerQueue(detail.owner_team)}
                    className="rounded border border-slate-200 px-2 py-1 text-[11px] font-semibold"
                  >
                    Queue
                  </Link>
                  {inc.alias_id ? (
                    <Link
                      href={routeToEvidenceLibraryIncidentRecord(inc.alias_id, detail.owner_team)}
                      className="rounded border border-slate-200 px-2 py-1 text-[11px] font-semibold"
                    >
                      Evidence
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DisclosureSection>

      <DisclosureSection title="Recent normalized signals" defaultOpen>
        {signalRows.length === 0 ? (
          <p className="text-[13px] text-slate-600">No ingested signals for this system yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {signalRows.slice(0, 12).map((s) => (
              <li key={s.id} className="px-3 py-2 text-[12px] text-slate-700">
                <span className="font-medium">{s.severity}</span> · {s.summary}
                {s.traceId ? (
                  <span className="ml-2 font-mono text-[10px] text-slate-500">
                    trace {s.traceId.slice(0, 10)}…
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <Link href={routes.liveSignals()} className="mt-2 inline-block text-[11px] font-semibold text-slate-700">
          Open Live Signals →
        </Link>
      </DisclosureSection>

      <DisclosureSection title="Detection controls">
        {controls.length === 0 ? (
          <p className="text-[13px] text-slate-600">No detection rules configured for this system.</p>
        ) : (
          <ul className="space-y-2">
            {controls.map((c) => (
              <li key={c.rule_id} className="rounded border border-slate-200 px-3 py-2 text-[12px]">
                <span className="font-semibold">{c.rule_id}</span> · {c.signal_type} · threshold{" "}
                {c.threshold_field} {c.threshold_value}
                {c.open_incident_id ? (
                  <span className="ml-2 text-rose-700">open: {c.open_incident_id}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </DisclosureSection>

      <DisclosureSection title="Governed actions">
        {systemActions.length === 0 ? (
          <p className="text-[13px] text-slate-600">No governed actions for this system.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {systemActions.map((a) => (
              <li key={a.id} className="px-3 py-2 text-[12px]">
                <Link href={`/actions?tab=pending&action=${encodeURIComponent(a.id)}`} className="font-semibold">
                  {a.title}
                </Link>
                <span className="text-slate-500"> · {a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </DisclosureSection>

      <DisclosureSection title="Raw ingest log (simulator)">
        {ingestRows.length === 0 ? (
          <p className="text-[13px] text-slate-600">No raw envelopes ingested for this system.</p>
        ) : (
          <LiveSignalsRawLogPanel rows={ingestRows} />
        )}
        <button
          type="button"
          onClick={() => refresh(true)}
          className="mt-2 text-[11px] font-semibold text-slate-700"
        >
          Refresh telemetry
        </button>
      </DisclosureSection>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function formatSeries(values: number[]): string {
  if (!values.length) return "—";
  const last = values[values.length - 1]!;
  if (values.length === 1) return last.toFixed(3);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return `last ${last.toFixed(2)} · avg ${avg.toFixed(2)}`;
}
