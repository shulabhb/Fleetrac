"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Filter, Terminal } from "lucide-react";
import type {
  ExecutionConsoleEntry,
  ExecutionConsoleOutcome,
  ExecutionConsoleSeverity
} from "@/lib/operations-types";
import { formatShortDateTime } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  ExecutionOutcomeBadge,
  ExecutionSeverityDot
} from "./operations-badges";
import {
  routeToAction,
  routeToBobInvestigation,
  routeToIntegrationSettings,
  routeToSystem
} from "@/lib/routes";

const OUTCOMES: (ExecutionConsoleOutcome | "all")[] = [
  "all",
  "prepared",
  "staged",
  "executed",
  "handed_off",
  "blocked",
  "acknowledged"
];

const SEVERITIES: (ExecutionConsoleSeverity | "all")[] = [
  "all",
  "info",
  "notice",
  "warn",
  "error"
];

/**
 * Governed operational acts — enterprise execution / audit log, not a shell.
 * Filters help operators trace lineage across systems, integrations, and Bob.
 */
export function ExecutionConsole({
  entries,
  title = "Execution Console",
  caption = "Governed operational acts prepared, staged and executed by Bob. Every row links to the governing Action and target system where applicable.",
  initialIntegrationId
}: {
  entries: ExecutionConsoleEntry[];
  title?: string;
  caption?: string;
  /** When opened from Settings with ?integration=, pre-filter to that connector. */
  initialIntegrationId?: string | null;
}) {
  const [outcome, setOutcome] = useState<ExecutionConsoleOutcome | "all">("all");
  const [severity, setSeverity] = useState<ExecutionConsoleSeverity | "all">("all");
  const [integrationId, setIntegrationId] = useState<string>(
    initialIntegrationId ?? "all"
  );

  useEffect(() => {
    if (initialIntegrationId) {
      setIntegrationId(initialIntegrationId);
    }
  }, [initialIntegrationId]);

  const integrationOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of entries) {
      if (e.integration_id && e.integration_label) {
        m.set(e.integration_id, e.integration_label);
      }
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (outcome !== "all" && e.outcome !== outcome) return false;
      if (severity !== "all" && e.severity !== severity) return false;
      if (integrationId !== "all" && e.integration_id !== integrationId)
        return false;
      return true;
    });
  }, [entries, outcome, severity, integrationId]);

  return (
    <Card className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white">
            <Terminal className="h-3.5 w-3.5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">
              {title}
            </h3>
            <p className="text-xs text-slate-500">{caption}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          <Select
            value={outcome}
            onChange={(e) =>
              setOutcome(e.target.value as ExecutionConsoleOutcome | "all")
            }
            aria-label="Filter by outcome"
            className="h-7 min-w-[120px] text-[11px]"
          >
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {o === "all" ? "All outcomes" : humanOutcome(o)}
              </option>
            ))}
          </Select>
          <Select
            value={severity}
            onChange={(e) =>
              setSeverity(e.target.value as ExecutionConsoleSeverity | "all")
            }
            aria-label="Filter by severity"
            className="h-7 min-w-[110px] text-[11px]"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All severities" : s}
              </option>
            ))}
          </Select>
          <Select
            value={integrationId}
            onChange={(e) => setIntegrationId(e.target.value)}
            aria-label="Filter by integration"
            className="h-7 min-w-[140px] text-[11px]"
          >
            <option value="all">All integrations</option>
            {integrationOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-950/[0.015]">
        <div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-x-3 gap-y-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <span>Sev</span>
          <span>Time</span>
          <span>Action</span>
          <span>Outcome</span>
          <span>Links</span>
        </div>
        <div className="divide-y divide-slate-200/80">
          {filtered.length === 0 && (
            <div className="px-3 py-3 text-[12px] text-slate-500">
              No entries match the current filters.
            </div>
          )}
          {filtered.map((e) => (
            <ExecutionRow key={e.id} entry={e} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function humanOutcome(o: ExecutionConsoleOutcome): string {
  return o.replace(/_/g, " ");
}

function ExecutionRow({ entry }: { entry: ExecutionConsoleEntry }) {
  return (
    <div className="grid grid-cols-[auto_auto_1fr_auto_auto] items-start gap-x-3 gap-y-1 px-3 py-2.5 text-[12px]">
      <span className="mt-1.5">
        <ExecutionSeverityDot severity={entry.severity} />
      </span>
      <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-slate-500">
        {formatShortDateTime(entry.timestamp)}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-slate-500">
            {entry.action_code}
          </span>
          <span className="font-medium text-slate-900">{entry.action_label}</span>
          {entry.integration_label && (
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">
              via {entry.integration_label}
            </span>
          )}
          {entry.target_system_name && (
            <span className="text-[11px] text-slate-500">
              on {entry.target_system_name}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] text-slate-600">{entry.details}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{entry.actor}</p>
      </div>
      <span className="mt-1">
        <ExecutionOutcomeBadge outcome={entry.outcome} />
      </span>
      <div className="mt-1 flex flex-wrap gap-1">
        {entry.action_id && (
          <Link
            href={routeToAction(entry.action_id)}
            className="inline-flex items-center gap-0.5 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Action
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
        {entry.target_system_id && (
          <Link
            href={routeToSystem(entry.target_system_id)}
            className="inline-flex items-center gap-0.5 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
          >
            System
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
        {entry.investigation_id && (
          <Link
            href={routeToBobInvestigation(entry.investigation_id)}
            className="inline-flex items-center gap-0.5 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Bob
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
        {entry.integration_id && (
          <Link
            href={routeToIntegrationSettings(entry.integration_id)}
            className="inline-flex items-center gap-0.5 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Integration
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
