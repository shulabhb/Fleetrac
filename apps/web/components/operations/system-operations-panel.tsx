import { ArrowRight, Undo2, Wrench, AlertTriangle } from "lucide-react";
import type { SystemOperations } from "@/lib/operations-types";
import { formatRelativeTime, formatShortDateTime } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  OperationsStateBadge,
  ReleaseChannelChip,
  VersionChip
} from "./operations-badges";

/**
 * Panel that renders the full operational picture for a system: what version
 * is live, what rollback options exist, whether maintenance is active, and
 * what last changed. Designed to read like a governed production-asset page.
 */
export function SystemOperationsPanel({ ops }: { ops: SystemOperations }) {
  return (
    <Card className="space-y-4">
      <CardHeader
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>Operations state</span>
            <OperationsStateBadge state={ops.operations_state} />
            <ReleaseChannelChip channel={ops.release_channel} />
          </div>
        }
        caption={
          ops.operations_state_reason ??
          "Current operational posture, deployed version and rollback options."
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Block label="Current version">
          <VersionChip version={ops.current_version} tone="info" />
          <p className="mt-1 text-[11px] text-slate-500">
            Deployed {formatRelativeTime(ops.deployed_at)} by {ops.last_changed_by}
          </p>
        </Block>
        <Block label="Previous version">
          {ops.previous_version ? (
            <VersionChip version={ops.previous_version} />
          ) : (
            <span className="text-[12px] text-slate-500">—</span>
          )}
          <p className="mt-1 text-[11px] text-slate-500">
            Rollback target if needed
          </p>
        </Block>
        <Block label="Candidate version">
          {ops.candidate_version ? (
            <VersionChip version={ops.candidate_version} tone="outline" />
          ) : (
            <span className="text-[12px] text-slate-500">None pending</span>
          )}
          <p className="mt-1 text-[11px] text-slate-500">
            {ops.canary_active && ops.canary_traffic_pct != null
              ? `Canary at ${ops.canary_traffic_pct.toFixed(0)}% traffic`
              : "No canary in progress"}
          </p>
        </Block>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card density="compact" className="bg-slate-50">
          <div className="flex items-center gap-2">
            <Undo2 className="h-4 w-4 text-slate-500" />
            <span className="text-[12px] font-semibold text-slate-800">
              Rollback
            </span>
            {ops.rollback_recommended ? (
              <Badge tone="high">Recommended by Bob</Badge>
            ) : ops.rollback_available ? (
              <Badge tone="low">Available</Badge>
            ) : (
              <Badge tone="neutral">Not available</Badge>
            )}
          </div>
          <div className="mt-2 space-y-1 text-[12px] text-slate-700">
            <Row label="Target">
              {ops.rollback_target ?? "—"}
            </Row>
            <Row label="Requires approval">
              {ops.rollback_requires_approval ? "Yes" : "No"}
            </Row>
            {ops.rollback_blocked_reason && (
              <p className="mt-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-700 ring-1 ring-rose-200">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                {ops.rollback_blocked_reason}
              </p>
            )}
          </div>
        </Card>

        <Card density="compact" className="bg-slate-50">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-slate-500" />
            <span className="text-[12px] font-semibold text-slate-800">
              Maintenance
            </span>
            {ops.maintenance.active ? (
              <Badge tone="info" dot>
                Window active
              </Badge>
            ) : (
              <Badge tone="outline">Off</Badge>
            )}
          </div>
          <div className="mt-2 space-y-1 text-[12px] text-slate-700">
            {ops.maintenance.active ? (
              <>
                <Row label="Reason">{ops.maintenance.reason ?? "—"}</Row>
                <Row label="Window">
                  {formatShortDateTime(ops.maintenance.started_at)} →{" "}
                  {formatShortDateTime(ops.maintenance.ends_at)}
                </Row>
                <Row label="Suppresses noise">
                  {ops.maintenance.suppress_incident_noise ? "Yes" : "No"}
                </Row>
                <Row label="Bob allowed in-window">
                  {ops.maintenance.bob_allowed_during_maintenance
                    ? "Yes (prepare + execute)"
                    : "No (Bob holds until window closes)"}
                </Row>
              </>
            ) : (
              <p className="text-slate-600">
                No maintenance window active. Bob operates under normal policy.
              </p>
            )}
          </div>
        </Card>
      </div>

      {ops.last_config_change_summary && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Last config change
            </span>
            <span className="text-[11px] text-slate-500">
              {formatRelativeTime(ops.last_config_change_at)}
            </span>
          </div>
          <p className="mt-1 text-slate-700">{ops.last_config_change_summary}</p>
        </div>
      )}
    </Card>
  );
}

function Block({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
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
 * Compact operations chip-row used in places like system cards or the top of
 * system detail hero.
 */
export function OperationsSummaryStrip({ ops }: { ops: SystemOperations }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px]">
      <OperationsStateBadge state={ops.operations_state} />
      <VersionChip version={ops.current_version} label="live" tone="info" />
      <ReleaseChannelChip channel={ops.release_channel} />
      {ops.maintenance.active && (
        <Badge tone="info" dot>
          Maintenance window
        </Badge>
      )}
      {ops.rollback_recommended && <Badge tone="high">Rollback recommended</Badge>}
      {ops.canary_active && (
        <Badge tone="info">Canary {ops.canary_traffic_pct?.toFixed(0) ?? 10}%</Badge>
      )}
    </div>
  );
}
