"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { IngestLogRowDTO } from "@/lib/governance-api";
import { cn } from "@/lib/cn";

type Props = {
  rows: IngestLogRowDTO[];
};

function formatTimestamp(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function LiveSignalsRawLogPanel({ rows }: Props) {
  const [sourceType, setSourceType] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const sourceTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.source_type))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    if (sourceType === "all") return rows;
    return rows.filter((r) => r.source_type === sourceType);
  }, [rows, sourceType]);

  return (
    <Card className="overflow-hidden shadow-none">
      <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Raw ingest log
        </p>
        <p className="mt-0.5 text-[12px] text-slate-600">
          Payloads as received by Fleetrac before governed signal surfacing — use to validate the
          simulator pipeline.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5">
        <Select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
          <option value="all">Any source type</option>
          {sourceTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <p className="ml-auto text-[11px] tabular-nums text-slate-500">
          {filtered.length} raw events
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-10 text-center text-[13px] text-slate-600">
          No raw ingest events yet. Run a pitch or start continuous simulation to populate the log.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((row) => (
            <RawLogRow
              key={row.raw_event_id}
              row={row}
              expanded={expanded === row.raw_event_id}
              onToggle={() =>
                setExpanded((prev) => (prev === row.raw_event_id ? null : row.raw_event_id))
              }
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function RawLogRow({
  row,
  expanded,
  onToggle
}: {
  row: IngestLogRowDTO;
  expanded: boolean;
  onToggle: () => void;
}) {
  const norm = row.normalized;

  return (
    <li className="px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="outline" size="xs">
              {row.source_type}
            </Badge>
            {norm ? (
              <>
                <Badge tone="info" size="xs">
                  Normalized
                </Badge>
                <Badge tone={severityTone(norm.severity)} size="xs">
                  {norm.severity}
                </Badge>
              </>
            ) : (
              <Badge tone="neutral" size="xs">
                Pending normalization
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-sm font-semibold text-slate-900">
            {row.system_name}{" "}
            <span className="font-normal text-slate-500">({row.display_system_id})</span>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600">
            Ingested {formatTimestamp(row.ingested_at)}
            <span className="text-slate-300"> · </span>
            <span className="font-mono text-[10px] text-slate-500">{row.idempotency_key}</span>
          </p>
          {norm ? (
            <p className="mt-1 text-[11px] text-slate-600">
              {norm.model ? (
                <>
                  <span className="font-medium text-slate-700">{norm.model}</span>
                  <span className="text-slate-300"> · </span>
                </>
              ) : null}
              {norm.operation_type}
              {norm.normalized_signal_type ? (
                <>
                  <span className="text-slate-300"> · </span>
                  {norm.normalized_signal_type}
                </>
              ) : null}
              {norm.incident_id ? (
                <>
                  <span className="text-slate-300"> · </span>
                  incident {norm.incident_id}
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "shrink-0 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm",
            expanded
              ? "border-slate-300 bg-slate-100 text-slate-900"
              : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
          )}
        >
          {expanded ? "Hide payload" : "View payload"}
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-2">
          <div className="rounded-md border border-slate-200 bg-slate-950 p-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Raw payload
            </p>
            <pre className="max-h-72 overflow-auto text-[11px] leading-relaxed text-emerald-100">
              {JSON.stringify(row.raw_payload, null, 2)}
            </pre>
          </div>
          {norm ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Normalized fields
              </p>
              <pre className="max-h-48 overflow-auto text-[11px] leading-relaxed text-slate-800">
                {JSON.stringify(norm, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function severityTone(sev: string): "high" | "medium" | "low" {
  const s = sev.toLowerCase();
  if (s === "critical" || s === "high") return "high";
  if (s === "medium") return "medium";
  return "low";
}
