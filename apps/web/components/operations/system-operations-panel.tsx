import { ArrowRight, Undo2, Wrench, AlertTriangle } from "lucide-react";
import type { SystemOperations } from "@/lib/operations-types";
import { formatRelativeTime, formatShortDateTime } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  OperationsStateBadge,
  VersionChip
} from "./operations-badges";

/**
 * Safe operational control surface for a system. Answers:
 *   What version is live?  What came before?  Is rollback recommended?
 *   Is maintenance active?  Is there a candidate version in canary?
 *   What was the last config change?
 */
export function SystemOperationsPanel({ ops }: { ops: SystemOperations }) {
  return (
    <Card className="space-y-4">
      <CardHeader
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>Operations state</span>
            <OperationsStateBadge state={ops.operations_state} />
          </div>
        }
        caption={
          ops.operations_state_reason ??
          "Deployed version, rollback options, maintenance window and last config change."
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <VersionBlock label="Current version" caption={`Deployed ${formatRelativeTime(ops.deployed_at)} by ${ops.last_changed_by}`}>
          <VersionChip version={ops.current_version} tone="info" />
        </VersionBlock>
        <VersionBlock
          label="Previous version"
          caption={ops.previous_version ? "Rollback target if needed" : "No prior version on record"}
        >
          {ops.previous_version ? (
            <VersionChip version={ops.previous_version} />
          ) : (
            <span className="text-[12px] text-slate-400">—</span>
          )}
        </VersionBlock>
        <VersionBlock
          label="Candidate version"
          caption={
            ops.canary_active && ops.canary_traffic_pct != null
              ? `Canary at ${ops.canary_traffic_pct.toFixed(0)}% traffic`
              : ops.candidate_version
                ? "Staged, no canary active"
                : "No candidate pending"
          }
        >
          {ops.candidate_version ? (
            <VersionChip version={ops.candidate_version} tone="outline" />
          ) : (
            <span className="text-[12px] text-slate-400">—</span>
          )}
        </VersionBlock>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card density="compact" surface="support">
          <div className="flex flex-wrap items-center gap-2">
            <Undo2 className="h-4 w-4 text-slate-500" />
            <span className="text-[12px] font-semibold text-slate-800">Rollback</span>
            {ops.rollback_recommended ? (
              <Badge tone="high">Recommended by Bob</Badge>
            ) : ops.rollback_available ? (
              <span className="text-[11px] font-medium text-slate-600">
                Available
              </span>
            ) : (
              <span className="text-[11px] font-medium text-slate-500">
                Not available
              </span>
            )}
          </div>
          <div className="mt-2 space-y-1 text-[12px] text-slate-700">
            <Row label="Target">{ops.rollback_target ?? "—"}</Row>
            <Row label="Requires approval">
              {ops.rollback_requires_approval ? "Yes" : "No"}
            </Row>
            {ops.rollback_blocked_reason ? (
              <p className="mt-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-700 ring-1 ring-rose-200">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                {ops.rollback_blocked_reason}
              </p>
            ) : null}
          </div>
        </Card>

        <Card density="compact" surface="support">
          <div className="flex flex-wrap items-center gap-2">
            <Wrench className="h-4 w-4 text-slate-500" />
            <span className="text-[12px] font-semibold text-slate-800">Maintenance</span>
            {ops.maintenance.active ? (
              <Badge tone="info" dot>Window active</Badge>
            ) : (
              <span className="text-[11px] font-medium text-slate-500">Off</span>
            )}
          </div>
          <div className="mt-2 space-y-1 text-[12px] text-slate-700">
            {ops.maintenance.active ? (
              <>
                <Row label="Reason">{ops.maintenance.reason ?? "—"}</Row>
                <Row label="Window">
                  {formatShortDateTime(ops.maintenance.started_at)}
                  <ArrowRight className="mx-1 inline h-3 w-3 text-slate-400" />
                  {formatShortDateTime(ops.maintenance.ends_at)}
                </Row>
                <Row label="Suppresses noise">
                  {ops.maintenance.suppress_incident_noise ? "Yes" : "No"}
                </Row>
                <Row label="Bob allowed in-window">
                  {ops.maintenance.bob_allowed_during_maintenance
                    ? "Yes — prepare + execute"
                    : "No — holds until window closes"}
                </Row>
              </>
            ) : (
              <p className="text-[11px] text-slate-500">
                No maintenance window active. Bob operates under the normal
                access & action policy.
              </p>
            )}
          </div>
        </Card>
      </div>

      {ops.last_config_change_summary ? (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Last config change
            </span>
            <span className="text-[11px] text-slate-500">
              {formatRelativeTime(ops.last_config_change_at)}
            </span>
          </div>
          <p className="mt-1 text-slate-700">{ops.last_config_change_summary}</p>
        </div>
      ) : null}
    </Card>
  );
}

function VersionBlock({
  label,
  caption,
  children
}: {
  label: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
      <p className="mt-1.5 text-[11px] text-slate-500">{caption}</p>
    </div>
  );
}

function Row({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-right text-[12px] text-slate-800">{children}</span>
    </div>
  );
}

/**
 * Compact operations chip-row used in the hero strip and on cards.
 */
export function OperationsSummaryStrip({ ops }: { ops: SystemOperations }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-600">
      <OperationsStateBadge state={ops.operations_state} />
      <span>
        <span className="text-slate-400">Live</span>{" "}
        <span className="font-mono font-medium text-slate-800">
          {ops.current_version}
        </span>
      </span>
      <span>
        <span className="text-slate-400">Channel</span>{" "}
        <span className="font-medium text-slate-700">
          {ops.release_channel}
        </span>
      </span>
      {ops.maintenance.active ? (
        <Badge tone="info" dot>Maintenance window</Badge>
      ) : null}
      {ops.rollback_recommended ? (
        <Badge tone="high">Rollback recommended</Badge>
      ) : null}
      {ops.canary_active ? (
        <Badge tone="info">Canary {ops.canary_traffic_pct?.toFixed(0) ?? 10}%</Badge>
      ) : null}
    </div>
  );
}
