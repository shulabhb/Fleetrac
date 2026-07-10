"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import type { IngestLogRowDTO, SimulatorStatusDTO } from "@/lib/governance-api";
import { cn } from "@/lib/cn";

type Props = {
  rows: IngestLogRowDTO[];
  simulatorStatus?: SimulatorStatusDTO | null;
};

type ConsoleLine = {
  key: string;
  level: "dim" | "sim" | "ingest" | "span" | "log" | "metric" | "norm" | "warn" | "ok";
  text: string;
  json?: string;
};

const LEVEL_CLASS: Record<ConsoleLine["level"], string> = {
  dim: "text-slate-500",
  sim: "text-violet-400",
  ingest: "text-cyan-400",
  span: "text-sky-300",
  log: "text-amber-200",
  metric: "text-teal-300",
  norm: "text-emerald-400",
  warn: "text-rose-400",
  ok: "text-green-400"
};

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

function shortId(value: string | undefined | null, keep = 8): string {
  if (!value) return "—";
  return value.length <= keep ? value : `${value.slice(0, keep)}…`;
}

function evalSummary(evaluation: Record<string, unknown> | undefined): string {
  if (!evaluation || !Object.keys(evaluation).length) return "";
  const parts = Object.entries(evaluation)
    .slice(0, 4)
    .map(([k, v]) => `${k}=${v}`);
  return parts.length ? parts.join(" ") : "";
}

function spanRelevantAttrs(span: Record<string, unknown>): string {
  const evaluation = span.evaluation as Record<string, unknown> | undefined;
  const attrs = span.attributes as Record<string, unknown> | undefined;
  const lines: string[] = [];
  if (evaluation && Object.keys(evaluation).length) {
    lines.push(evalSummary(evaluation));
  }
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith("fleetrac.business_outcome.")) {
        lines.push(`${key.replace("fleetrac.business_outcome.", "")}=${value}`);
      } else if (key === "fleetrac.citation.verified") {
        lines.push(`citation_verified=${value}`);
      } else if (key === "fleetrac.tool.approved") {
        lines.push(`tool_approved=${value}`);
      } else if (key.startsWith("gen_ai.tool.name")) {
        lines.push(`tool=${value}`);
      }
    }
  }
  return lines.filter(Boolean).join(" ");
}

function bundleToLines(row: IngestLogRowDTO): ConsoleLine[] {
  const payload = row.raw_payload ?? {};
  const ts = formatClock(row.ingested_at);
  const lines: ConsoleLine[] = [];

  const schema = String(payload.schema_version ?? "1.0");
  const traceId = String(payload.trace_id ?? payload.invocation_id ?? "—");
  const spans = Array.isArray(payload.spans) ? payload.spans : [];
  const logs = Array.isArray(payload.logs) ? payload.logs : [];
  const metrics = Array.isArray(payload.metrics) ? payload.metrics : [];
  const eventCount = spans.reduce((n, sp) => {
    const events = (sp as Record<string, unknown>).events;
    return n + (Array.isArray(events) ? events.length : 0);
  }, 0);

  const rootSpan = spans[0] as Record<string, unknown> | undefined;
  const baseNs = rootSpan ? Number(rootSpan.start_time_unix_nano ?? 0) : 0;
  const totalMs =
    rootSpan && rootSpan.end_time_unix_nano != null && baseNs
      ? Math.round((Number(rootSpan.end_time_unix_nano) - baseNs) / 1_000_000)
      : null;

  const spanById = new Map<string, Record<string, unknown>>();
  for (const span of spans) {
    const s = span as Record<string, unknown>;
    if (s.span_id) spanById.set(String(s.span_id), s);
  }

  lines.push({
    key: `${row.raw_event_id}-gen`,
    level: "sim",
    text: `[${ts}] SIM generate  system=${row.display_system_id} schema=${schema} trace=${shortId(traceId)} spans=${spans.length} events=${eventCount} logs=${logs.length}${totalMs != null ? ` total=${totalMs}ms` : ""}`
  });

  if (payload.scenario && typeof payload.scenario === "object") {
    const sc = payload.scenario as Record<string, unknown>;
    lines.push({
      key: `${row.raw_event_id}-scenario`,
      level: "dim",
      text: `           scenario=${sc.id ?? "—"} run=${shortId(String(sc.run_id ?? ""), 12)}`
    });
  }
  if (payload.simulator_run_id) {
    lines.push({
      key: `${row.raw_event_id}-run`,
      level: "dim",
      text: `           simulator_run_id=${payload.simulator_run_id}`
    });
  }

  lines.push({
    key: `${row.raw_event_id}-post`,
    level: "ingest",
    text: `[${ts}] POST /api/v1/ingest/events  source=${row.source_type} idempotency=${row.idempotency_key}`
  });

  if (schema.startsWith("2") && spans.length > 0) {
    for (let i = 0; i < spans.length; i++) {
      const s = spans[i] as Record<string, unknown>;
      const name = String(s.name ?? "span");
      const op = String(s.operation ?? "—");
      const parentId = s.parent_span_id ? String(s.parent_span_id) : null;
      const parent = parentId ? spanById.get(parentId) : undefined;
      const parentName = parent ? String(parent.name ?? "—") : "—";
      const startNs = Number(s.start_time_unix_nano ?? baseNs);
      const endNs = Number(s.end_time_unix_nano ?? startNs);
      const startMs = baseNs ? Math.round((startNs - baseNs) / 1_000_000) : 0;
      const endMs = baseNs ? Math.round((endNs - baseNs) / 1_000_000) : 0;
      const durationMs = Math.max(0, endMs - startMs);
      const prefix = i === spans.length - 1 ? "└─" : "├─";
      const relevant = spanRelevantAttrs(s);

      lines.push({
        key: `${row.raw_event_id}-span-${String(s.span_id ?? name)}`,
        level: "span",
        text: `           ${prefix} ${name}`
      });
      lines.push({
        key: `${row.raw_event_id}-span-meta-${String(s.span_id ?? name)}`,
        level: "dim",
        text: `           │  parent=${parentName}  start=${startMs}ms end=${endMs}ms duration=${durationMs}ms status=OK op=${op}`
      });
      if (relevant) {
        lines.push({
          key: `${row.raw_event_id}-span-attr-${String(s.span_id ?? name)}`,
          level: "metric",
          text: `           │  ${relevant}`
        });
      }
      if (Array.isArray(s.events) && s.events.length > 0) {
        for (const ev of s.events as Record<string, unknown>[]) {
          lines.push({
            key: `${row.raw_event_id}-ev-${String(ev.name ?? "event")}-${String(s.span_id ?? name)}`,
            level: "log",
            text: `           │  event ${String(ev.name ?? "log")}`
          });
        }
      }
    }
  } else {
    const evaluation = payload.evaluation as Record<string, unknown> | undefined;
    const model =
      payload.registry_model_code ??
      (payload.model as Record<string, unknown> | undefined)?.registry_code ??
      payload.model_version ??
      payload.deployment_name ??
      "";
    lines.push({
      key: `${row.raw_event_id}-payload`,
      level: "span",
      text: `           payload  model=${model} trace=${shortId(traceId)}${evalSummary(evaluation)}`
    });
  }

  for (const log of logs.slice(0, 3)) {
    const l = log as Record<string, unknown>;
    lines.push({
      key: `${row.raw_event_id}-log-${String(l.body ?? lines.length)}`,
      level: "log",
      text: `           log  ${String(l.severity_text ?? "INFO")}  ${String(l.body ?? l.message ?? "").slice(0, 96)}`
    });
  }

  for (const metric of metrics.slice(0, 2)) {
    const m = metric as Record<string, unknown>;
    lines.push({
      key: `${row.raw_event_id}-metric-${String(m.name ?? "m")}`,
      level: "metric",
      text: `           metric  ${String(m.name ?? "—")}=${String(m.value ?? m.sum ?? "—")}`
    });
  }

  const norm = row.normalized;
  const normalizedSpans =
    row.normalized_spans && row.normalized_spans.length > 0
      ? row.normalized_spans
      : norm
        ? [norm]
        : [];
  if (normalizedSpans.length > 0) {
    for (const spanNorm of normalizedSpans) {
      const signal = spanNorm.normalized_signal_type
        ? ` signal=${spanNorm.normalized_signal_type}`
        : " signal=neutral";
      const inc = spanNorm.incident_id ? ` incident=${shortId(spanNorm.incident_id, 16)}` : "";
      const sev = spanNorm.severity ?? (spanNorm.normalized_signal_type ? "unknown" : "—");
      lines.push({
        key: `${row.raw_event_id}-norm-${spanNorm.event_id}`,
        level: sev === "critical" || sev === "high" ? "warn" : "norm",
        text: `[${ts}] FLEETRAC normalize  span=${shortId(spanNorm.span_id ?? spanNorm.event_id, 8)} severity=${sev} op=${spanNorm.operation_type}${signal}${inc}`
      });
    }
  } else {
    lines.push({
      key: `${row.raw_event_id}-norm-pending`,
      level: "dim",
      text: `[${ts}] FLEETRAC normalize  pending…`
    });
  }

  lines.push({
    key: `${row.raw_event_id}-ok`,
    level: "ok",
    text: `[${ts}] ✓ ingested raw_event_id=${shortId(row.raw_event_id, 12)} hash=${shortId(row.payload_hash, 16)}`
  });

  return lines;
}

export function LiveSignalsRawLogPanel({ rows, simulatorStatus }: Props) {
  const [sourceType, setSourceType] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedJson, setExpandedJson] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sourceTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.source_type))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const list = sourceType === "all" ? rows : rows.filter((r) => r.source_type === sourceType);
    return [...list].reverse();
  }, [rows, sourceType]);

  const entries = useMemo(
    () =>
      filtered.map((row) => ({
        row,
        lines: bundleToLines(row)
      })),
    [filtered]
  );

  const lineCount = useMemo(
    () => entries.reduce((n, e) => n + e.lines.length, 0),
    [entries]
  );

  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lineCount, autoScroll]);

  const statusLine = simulatorStatus?.running
    ? `running · ${simulatorStatus.mode} · ${simulatorStatus.rate_eps ?? "—"}/s · ${simulatorStatus.event_count} events generated`
    : simulatorStatus
      ? `idle · ${simulatorStatus.event_count} events in session`
      : "disconnected";

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-[#0d1117] font-mono text-[11px] leading-relaxed shadow-lg">
      <div className="flex items-center gap-2 border-b border-slate-700 bg-[#161b22] px-3 py-2">
        <span className="inline-flex gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        </span>
        <span className="text-slate-400">simulator</span>
        <span className="text-slate-600">→</span>
        <span className="text-cyan-400">ingest pipeline</span>
        <span className="ml-auto text-[10px] text-slate-500">{statusLine}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-[#0d1117] px-3 py-2">
        <Select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
          className="border-slate-700 bg-[#161b22] text-slate-200"
        >
          <option value="all">all source types</option>
          {sourceTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <button
          type="button"
          onClick={() => setAutoScroll((v) => !v)}
          className={cn(
            "rounded border px-2 py-1 text-[10px] font-semibold",
            autoScroll
              ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-400"
              : "border-slate-700 text-slate-500"
          )}
        >
          {autoScroll ? "auto-scroll on" : "auto-scroll off"}
        </button>
        <span className="ml-auto text-[10px] text-slate-500">
          {filtered.length} bundles · {lineCount} lines
        </span>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[min(560px,62vh)] min-h-[280px] overflow-y-auto px-3 py-3"
      >
        {filtered.length === 0 ? (
          <div className="space-y-1 text-slate-500">
            <p className="text-violet-400">$ fleetrac-simulator --watch ingest</p>
            <p>Waiting for ingest payloads…</p>
            <p className="text-slate-600">
              Each OTEL bundle POSTed to /api/v1/ingest/events appears here after persistence.
              Switch back to governed signals for normalized governance view.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {entries.map(({ row, lines }) => (
              <div key={row.raw_event_id} className="group">
                {lines.map((line) => (
                  <div key={line.key} className="flex gap-2">
                    <span className={cn("whitespace-pre-wrap break-all", LEVEL_CLASS[line.level])}>
                      {line.text}
                    </span>
                    {line.key.endsWith("-post") ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedJson((id) =>
                            id === row.raw_event_id ? null : row.raw_event_id
                          )
                        }
                        className="shrink-0 text-[10px] text-slate-600 opacity-0 transition group-hover:opacity-100 hover:text-slate-400"
                      >
                        {expandedJson === row.raw_event_id ? "[hide json]" : "[json]"}
                      </button>
                    ) : null}
                  </div>
                ))}
                {expandedJson === row.raw_event_id ? (
                  <pre className="mb-3 mt-1 overflow-x-auto rounded border border-slate-800 bg-black/40 p-2 text-[10px] text-emerald-100/90">
                    {JSON.stringify(row.raw_payload, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
