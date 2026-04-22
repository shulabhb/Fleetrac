import Link from "next/link";
import { ArrowRight, Terminal } from "lucide-react";
import type { ExecutionConsoleEntry } from "@/lib/operations-types";
import { formatShortDateTime } from "@/lib/format";
import { Card } from "@/components/ui/card";
import {
  ExecutionOutcomeBadge,
  ExecutionSeverityDot
} from "./operations-badges";

/**
 * Renders a console-like view of governed operational acts prepared or
 * executed by Bob / Fleetrac. Not a shell log — these are signed, auditable
 * operations (ticket opens, threshold stages, rollbacks, handoffs).
 */
export function ExecutionConsole({
  entries,
  title = "Execution Console",
  caption = "Governed operational acts prepared, staged and executed by Bob. Every row links to the governing Action and target system."
}: {
  entries: ExecutionConsoleEntry[];
  title?: string;
  caption?: string;
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
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
          {entries.length === 0 && (
            <div className="px-3 py-3 text-[12px] text-slate-500">
              No operational acts recorded in this window.
            </div>
          )}
          {entries.map((e) => (
            <ExecutionRow key={e.id} entry={e} />
          ))}
        </div>
      </div>
    </Card>
  );
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
            href={`/actions/${entry.action_id}`}
            className="inline-flex items-center gap-0.5 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Action
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
        {entry.target_system_id && (
          <Link
            href={`/systems/${entry.target_system_id}`}
            className="inline-flex items-center gap-0.5 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
          >
            System
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
        {entry.investigation_id && (
          <Link
            href={`/bob/${entry.investigation_id}`}
            className="inline-flex items-center gap-0.5 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Bob
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
