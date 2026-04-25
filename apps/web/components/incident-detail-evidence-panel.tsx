"use client";

import { useMemo, useState } from "react";
import { GaugeCircle } from "lucide-react";
import { TrendChart } from "@/components/charts/trend-chart";
import { DisclosureSection } from "@/components/shared/disclosure-section";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatMetric, formatRelativeTime } from "@/lib/format";
import { metricLabel } from "@/lib/present";

type LogPlatformId = "fleet_obs" | "cloud" | "runtime" | "audit";

const LOG_PLATFORMS: { id: LogPlatformId; label: string }[] = [
  { id: "fleet_obs", label: "Fleet observability" },
  { id: "cloud", label: "Cloud provider" },
  { id: "runtime", label: "Application runtime" },
  { id: "audit", label: "Audit & access" }
];

type TopTab = "logs" | "evidence";

export type IncidentDetailEvidencePanelProps = {
  incidentId: string;
  incidentTitle: string;
  summary: string;
  systemName: string;
  triggerMetric: string;
  thresholdDisplay: string;
  observedNumber: number | null;
  thresholdNumber: number | null;
  expectedValue: number | null;
  metricField: string | null;
  series: { t: string; v: number | null }[];
  metricColor: string;
  yDigits: number;
  supportingMetrics: { key: string; label: string; value: number; unit?: string }[];
  telemetryTimestamp: string | null;
  evidenceCaption: string;
};

function demoLogLines(
  platform: LogPlatformId,
  incidentId: string,
  title: string,
  systemName: string
): string[] {
  const t = title.slice(0, 48);
  switch (platform) {
    case "fleet_obs":
      return [
        `[${new Date().toISOString().slice(11, 19)}] fleet.telemetry.ingest OK system=${systemName}`,
        `[${new Date().toISOString().slice(11, 19)}] governance.signal evaluator incident=${incidentId} state=breach`,
        `[${new Date().toISOString().slice(11, 19)}] policy.window p95 drift vs baseline — correlation with "${t}"`,
        `[${new Date().toISOString().slice(11, 19)}] trace.sample rate=0.12 root_span=governance_checkout`
      ];
    case "cloud":
      return [
        `cloudwatch /aws/lambda/prod-checkout-governance START RequestId: 8f2a… ResourcePath: /v1/evaluate`,
        `REPORT RequestId: 8f2a… Duration: 842.13 ms Billed Duration: 843 ms Memory Size: 1024 MB`,
        `[instance i-0abc7def] systemd: governance-sidecar.service — active (running)`,
        `vpc-flow ACCEPT tcp 10.12.0.44:443 -> 10.12.3.9:52411 len=52`
      ];
    case "runtime":
      return [
        `INFO  runtime.model_router version=2.14.0 incident_ref=${incidentId}`,
        `WARN  latency_guard threshold_exceeded route=checkout primary_model=m50-prod`,
        `DEBUG grounding_eval score_window=300s sample_id=…`,
        `ERROR (soft) retrieval_fallback_used shard=us-east-1a — "${t}"`
      ];
    case "audit":
      return [
        `audit.identity session=svc-governance-bot action=READ resource=telemetry:${systemName}`,
        `audit.policy decision=ALLOW reason=policy_bundle_v3 scope=production`,
        `audit.access actor=fleet-operator role=governor object=incident/${incidentId}`,
        `audit.export job=partial redaction=PII_FIELDS len=4096`
      ];
    default:
      return [];
  }
}

export function IncidentDetailEvidencePanel(props: IncidentDetailEvidencePanelProps) {
  const [topTab, setTopTab] = useState<TopTab>("logs");
  const [logPlatform, setLogPlatform] = useState<LogPlatformId>("fleet_obs");

  const lines = useMemo(
    () =>
      demoLogLines(logPlatform, props.incidentId, props.incidentTitle, props.systemName),
    [logPlatform, props.incidentId, props.incidentTitle, props.systemName]
  );

  const metricTitle = props.metricField ? metricLabel(props.metricField) : metricLabel(props.triggerMetric);

  return (
    <Card surface="evidence" className="border-slate-200">
      <CardHeader
        title="Evidence"
        caption={props.evidenceCaption}
        action={<GaugeCircle className="h-4 w-4 text-slate-400" />}
      />

      <div className="mt-3 border-b border-slate-200">
        <div className="flex gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={topTab === "logs"}
            onClick={() => setTopTab("logs")}
            className={cn(
              "rounded-t-md border border-b-0 px-3 py-2 text-[11px] font-semibold transition",
              topTab === "logs"
                ? "border-slate-200 bg-white text-slate-900"
                : "border-transparent bg-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            Captured logs
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={topTab === "evidence"}
            onClick={() => setTopTab("evidence")}
            className={cn(
              "rounded-t-md border border-b-0 px-3 py-2 text-[11px] font-semibold transition",
              topTab === "evidence"
                ? "border-slate-200 bg-white text-slate-900"
                : "border-transparent bg-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            Current evidence
          </button>
        </div>
      </div>

      <div className="rounded-b-lg border border-t-0 border-slate-200 bg-white p-3">
        {topTab === "logs" ? (
          <div className="space-y-3">
            <p className="text-[11px] leading-relaxed text-slate-600">
              Read-only samples aligned to this incident and system — stitched for triage; source
              systems may retain authoritative retention.
            </p>
            <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-2">
              {LOG_PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={logPlatform === p.id}
                  onClick={() => setLogPlatform(p.id)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px] font-semibold transition",
                    logPlatform === p.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div
              className="max-h-[min(52vh,22rem)] overflow-auto rounded-md border border-slate-200 bg-slate-950 px-3 py-2 font-mono text-[10px] leading-relaxed text-slate-200"
              role="log"
            >
              {lines.map((line, i) => (
                <p key={i} className="whitespace-pre-wrap break-all border-b border-white/[0.06] py-1 last:border-0">
                  {line}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="label-eyebrow">Triggered metric</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{metricTitle}</p>
                </div>
                <div className="flex items-center gap-3 text-right text-xs">
                  <div>
                    <p className="label-eyebrow">Observed</p>
                    <p className="tabular-nums text-base font-semibold text-rose-700">
                      {props.observedNumber != null
                        ? formatMetric(props.observedNumber, { digits: 3 })
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="label-eyebrow">Threshold</p>
                    <p className="tabular-nums text-base font-semibold text-slate-700">
                      {props.thresholdNumber != null
                        ? formatMetric(props.thresholdNumber, { digits: 3 })
                        : props.thresholdDisplay ?? "—"}
                    </p>
                  </div>
                  {props.expectedValue != null ? (
                    <div>
                      <p className="label-eyebrow">Expected</p>
                      <p className="tabular-nums text-base font-semibold text-slate-700">
                        {formatMetric(props.expectedValue, { digits: 3 })}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-3">
                <TrendChart
                  data={props.series}
                  threshold={props.thresholdNumber ?? undefined}
                  thresholdLabel={
                    props.thresholdNumber != null
                      ? `Threshold ${formatMetric(props.thresholdNumber, { digits: 3 })}`
                      : undefined
                  }
                  color={props.metricColor}
                  height={200}
                  yDigits={props.yDigits}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Dashed line is the governance threshold. The latest value triggered this incident.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <p className="label-eyebrow">Breach context</p>
                <p className="mt-2 text-sm text-slate-700">{props.summary}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  Event timestamp:{" "}
                  {props.telemetryTimestamp
                    ? formatRelativeTime(props.telemetryTimestamp)
                    : "—"}
                </p>
              </div>
              <DisclosureSection
                title="Supporting metrics"
                summary={
                  props.supportingMetrics.length > 0
                    ? `${props.supportingMetrics.length} additional telemetry signals`
                    : "No additional telemetry captured in this window."
                }
                className="border-slate-200 bg-white"
                bodyClassName="p-3"
              >
                {props.supportingMetrics.length > 0 ? (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {props.supportingMetrics.map((metric) => (
                      <div key={metric.key} className="min-w-0">
                        <dt className="truncate text-[11px] text-slate-500">{metric.label}</dt>
                        <dd className="tabular-nums text-sm font-semibold text-slate-900">
                          {formatMetric(metric.value, {
                            digits: 2,
                            unit: metric.unit ? ` ${metric.unit}` : ""
                          })}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-xs text-slate-500">
                    No additional telemetry captured in this window.
                  </p>
                )}
              </DisclosureSection>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
