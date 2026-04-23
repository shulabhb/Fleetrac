import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SystemOperations } from "@/lib/operations-types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OperationsSummaryStrip } from "@/components/operations/system-operations-panel";
import {
  connectionTone,
  humanizeLabel,
  postureTone,
  severityBadgeClasses
} from "@/lib/present";
import { formatInteger } from "@/lib/format";
import { routeToBobInvestigation } from "@/lib/routes";

type System = {
  id: string;
  use_case?: string | null;
  model?: string | null;
  name?: string | null;
  risk_posture: string;
  owner?: string | null;
  control_owner?: string | null;
  business_function?: string | null;
  regulatory_sensitivity?: string | null;
  deployment_scope?: string | null;
  environment?: string | null;
  model_type?: string | null;
  hosting_environment?: string | null;
  integration_mode?: string | null;
  telemetry_coverage?: number | null;
  connection_status?: string | null;
};

type SystemHeroProps = {
  system: System;
  ops: SystemOperations | null;
  openIncidentCount: number;
  highestOpenSeverity?: "high" | "medium" | "low";
  bobInvestigationId?: string | null;
};

/**
 * Condensed top-of-page summary for System Detail.
 *
 *   Line 1 · Name + id + posture pills
 *   Line 2 · Operations strip (state, version, channel, maintenance, rollback)
 *   Line 3 · Metadata grid (ownership, sensitivity, scope, …)
 *   Line 4 · Access / connection strip (hosting, integration, telemetry, link)
 *
 * Intentionally minimal — one card, one rhythm.
 */
export function SystemHero({
  system,
  ops,
  openIncidentCount,
  highestOpenSeverity,
  bobInvestigationId
}: SystemHeroProps) {
  const displayName = system.use_case
    ? `${system.use_case} (${system.model ?? "—"})`
    : (system.name ?? system.id);

  return (
    <Card className="overflow-hidden p-0">
      {/* Line 1 — identity + postures */}
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="label-eyebrow">System</p>
          <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-900">
            {displayName}
          </h2>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-slate-400">
            {system.id}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={postureTone(system.risk_posture)} dot size="sm">
            {humanizeLabel(system.risk_posture)}
          </Badge>
          {highestOpenSeverity ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${severityBadgeClasses(highestOpenSeverity)}`}
            >
              {humanizeLabel(highestOpenSeverity)} open
            </span>
          ) : (
            <Badge tone="low" size="sm">
              No open issues
            </Badge>
          )}
          {bobInvestigationId ? (
            <Link
              href={routeToBobInvestigation(bobInvestigationId)}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-100"
            >
              Bob review open
              <ArrowRight className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
      </div>

      {/* Line 2 — operations strip */}
      {ops ? (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-2.5">
          <OperationsSummaryStrip ops={ops} />
        </div>
      ) : null}

      {/* Line 3 — metadata grid */}
      <dl className="grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200 text-sm md:grid-cols-4">
        <MetaCell label="Owner team" value={system.owner} />
        <MetaCell label="Control owner" value={system.control_owner} />
        <MetaCell label="Business function" value={system.business_function} />
        <MetaCell
          label="Regulatory sensitivity"
          value={humanizeLabel(system.regulatory_sensitivity)}
        />
        <MetaCell
          label="Deployment scope"
          value={humanizeLabel(system.deployment_scope)}
        />
        <MetaCell label="Environment" value={humanizeLabel(system.environment)} />
        <MetaCell label="Model type" value={humanizeLabel(system.model_type)} />
        <MetaCell
          label="Open incidents"
          value={formatInteger(openIncidentCount)}
          emphasize={openIncidentCount > 0}
        />
      </dl>

      {/* Line 4 — access / connection strip */}
      {system.hosting_environment ||
      system.integration_mode ||
      system.telemetry_coverage != null ||
      system.connection_status ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 bg-slate-50/60 px-5 py-2.5 text-[11px] text-slate-500">
          {system.hosting_environment ? (
            <AccessSnippet label="Hosting" value={system.hosting_environment} />
          ) : null}
          {system.integration_mode ? (
            <AccessSnippet label="Integration" value={system.integration_mode} />
          ) : null}
          {system.telemetry_coverage != null ? (
            <AccessSnippet
              label="Telemetry coverage"
              value={`${Math.round(system.telemetry_coverage)}%`}
            />
          ) : null}
          {system.connection_status ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${connectionTone(system.connection_status)}`}
              />
              <span className="text-slate-400">Connection</span>{" "}
              <span className="font-medium text-slate-700">
                {humanizeLabel(system.connection_status)}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function MetaCell({
  label,
  value,
  emphasize
}: {
  label: string;
  value: string | number | null | undefined;
  emphasize?: boolean;
}) {
  return (
    <div className="bg-white px-5 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate text-sm ${
          emphasize ? "font-semibold text-slate-900" : "text-slate-800"
        }`}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

function AccessSnippet({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-slate-400">{label}</span>{" "}
      <span className="font-medium text-slate-700">{value}</span>
    </span>
  );
}
