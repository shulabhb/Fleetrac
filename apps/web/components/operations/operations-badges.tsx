import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type {
  ChangeLifecycleState,
  ConnectorType,
  EnvironmentKind,
  ExecutionConsoleOutcome,
  ExecutionConsoleSeverity,
  IntegrationActionScope,
  IntegrationAuthStatus,
  IntegrationConnectionStatus,
  IntegrationSyncStatus,
  OperationsState,
  ReleaseChannel,
  ServiceHealth,
  TelemetryAvailability
} from "@/lib/operations-types";

type Tone = "neutral" | "high" | "medium" | "low" | "info" | "outline";

const opsStateMeta: Record<OperationsState, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "low" },
  paused: { label: "Paused", tone: "medium" },
  maintenance: { label: "Maintenance", tone: "info" },
  degraded: { label: "Degraded", tone: "medium" },
  rollback_ready: { label: "Rollback ready", tone: "high" },
  canary: { label: "Canary", tone: "info" },
  disabled: { label: "Disabled", tone: "neutral" },
  internal_testing: { label: "Internal testing", tone: "outline" }
};

export function OperationsStateBadge({ state }: { state: OperationsState }) {
  const meta = opsStateMeta[state];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

const channelLabel: Record<ReleaseChannel, string> = {
  production: "prod",
  staging: "staging",
  canary: "canary",
  fallback: "fallback",
  internal: "internal"
};

export function ReleaseChannelChip({ channel }: { channel: ReleaseChannel }) {
  return (
    <Badge tone="outline">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">
        {channelLabel[channel]}
      </span>
    </Badge>
  );
}

export function VersionChip({
  version,
  label,
  tone = "outline"
}: {
  version: string;
  label?: string;
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1",
        tone === "outline" && "bg-white text-slate-700 ring-slate-200",
        tone === "info" && "bg-sky-50 text-sky-700 ring-sky-200",
        tone === "low" && "bg-emerald-50 text-emerald-700 ring-emerald-200",
        tone === "medium" && "bg-amber-50 text-amber-800 ring-amber-200",
        tone === "high" && "bg-rose-50 text-rose-700 ring-rose-200",
        tone === "neutral" && "bg-slate-100 text-slate-700 ring-slate-200"
      )}
    >
      {label ? <span className="text-slate-400">{label}</span> : null}
      <span className="font-mono tracking-tight">{version}</span>
    </span>
  );
}

const connectionTone: Record<IntegrationConnectionStatus, Tone> = {
  connected: "low",
  degraded: "medium",
  disconnected: "high",
  needs_auth: "medium"
};

const connectionLabel: Record<IntegrationConnectionStatus, string> = {
  connected: "Connected",
  degraded: "Degraded",
  disconnected: "Disconnected",
  needs_auth: "Needs auth"
};

export function ConnectionStatusBadge({
  status
}: {
  status: IntegrationConnectionStatus;
}) {
  return (
    <Badge tone={connectionTone[status]} dot>
      {connectionLabel[status]}
    </Badge>
  );
}

const authTone: Record<IntegrationAuthStatus, Tone> = {
  ok: "low",
  token_expiring: "medium",
  expired: "high",
  unauthorized: "high",
  not_configured: "neutral"
};

const authLabel: Record<IntegrationAuthStatus, string> = {
  ok: "Auth ok",
  token_expiring: "Token expiring",
  expired: "Expired",
  unauthorized: "Unauthorized",
  not_configured: "Not configured"
};

export function AuthStatusBadge({ status }: { status: IntegrationAuthStatus }) {
  return <Badge tone={authTone[status]}>{authLabel[status]}</Badge>;
}

const syncTone: Record<IntegrationSyncStatus, Tone> = {
  healthy: "low",
  delayed: "medium",
  failing: "high",
  idle: "neutral",
  paused: "neutral"
};

export function SyncStatusBadge({ status }: { status: IntegrationSyncStatus }) {
  return <Badge tone={syncTone[status]}>Sync {status.replace("_", " ")}</Badge>;
}

const connectorTypeLabel: Record<ConnectorType, string> = {
  api: "API",
  sidecar: "Sidecar",
  log_stream: "Log stream",
  proxy: "Proxy",
  manual: "Manual"
};

export function ConnectorTypeChip({ type }: { type: ConnectorType }) {
  return <Badge tone="outline">{connectorTypeLabel[type]}</Badge>;
}

const telemetryLabel: Record<TelemetryAvailability, string> = {
  full: "Full telemetry",
  partial: "Partial telemetry",
  metadata_only: "Metadata only",
  none: "No telemetry"
};

const telemetryTone: Record<TelemetryAvailability, Tone> = {
  full: "low",
  partial: "medium",
  metadata_only: "neutral",
  none: "neutral"
};

export function TelemetryAvailabilityBadge({
  level
}: {
  level: TelemetryAvailability;
}) {
  return <Badge tone={telemetryTone[level]}>{telemetryLabel[level]}</Badge>;
}

const actionScopeLabel: Record<IntegrationActionScope, string> = {
  none: "No actions",
  read_only: "Read only",
  prepare_only: "Prepare only",
  approval_gated: "Approval-gated",
  limited_execution: "Limited execution"
};

const actionScopeTone: Record<IntegrationActionScope, Tone> = {
  none: "neutral",
  read_only: "neutral",
  prepare_only: "info",
  approval_gated: "info",
  limited_execution: "medium"
};

export function ActionScopeBadge({ scope }: { scope: IntegrationActionScope }) {
  return <Badge tone={actionScopeTone[scope]}>{actionScopeLabel[scope]}</Badge>;
}

const serviceHealthTone: Record<ServiceHealth, Tone> = {
  healthy: "low",
  degraded: "medium",
  down: "high",
  unknown: "neutral"
};

export function ServiceHealthBadge({ health }: { health: ServiceHealth }) {
  return (
    <Badge tone={serviceHealthTone[health]} dot>
      {health.charAt(0).toUpperCase() + health.slice(1)}
    </Badge>
  );
}

const envLabel: Record<EnvironmentKind, string> = {
  production: "Production",
  staging: "Staging",
  sandbox: "Sandbox",
  internal_only: "Internal only"
};

const envTone: Record<EnvironmentKind, Tone> = {
  production: "info",
  staging: "outline",
  sandbox: "outline",
  internal_only: "outline"
};

export function EnvironmentChip({ env }: { env: EnvironmentKind }) {
  return <Badge tone={envTone[env]}>{envLabel[env]}</Badge>;
}

const changeStateTone: Record<ChangeLifecycleState, Tone> = {
  proposed: "neutral",
  approved: "info",
  executed: "info",
  monitoring: "info",
  improvement_observed: "low",
  no_material_change: "neutral",
  regression_detected: "high",
  rollback_candidate: "high",
  follow_up_required: "medium",
  closed: "low"
};

const changeStateLabel: Record<ChangeLifecycleState, string> = {
  proposed: "Proposed",
  approved: "Approved",
  executed: "Executed",
  monitoring: "Monitoring",
  improvement_observed: "Improvement observed",
  no_material_change: "No material change",
  regression_detected: "Regression detected",
  rollback_candidate: "Rollback candidate",
  follow_up_required: "Follow-up required",
  closed: "Closed"
};

export function ChangeStateBadge({ state }: { state: ChangeLifecycleState }) {
  return (
    <Badge tone={changeStateTone[state]} dot>
      {changeStateLabel[state]}
    </Badge>
  );
}

const consoleOutcomeTone: Record<ExecutionConsoleOutcome, Tone> = {
  prepared: "info",
  staged: "info",
  executed: "low",
  handed_off: "outline",
  blocked: "high",
  acknowledged: "neutral"
};

export function ExecutionOutcomeBadge({
  outcome
}: {
  outcome: ExecutionConsoleOutcome;
}) {
  return (
    <Badge tone={consoleOutcomeTone[outcome]}>
      {outcome.replace("_", " ")}
    </Badge>
  );
}

const consoleSeverityTone: Record<ExecutionConsoleSeverity, Tone> = {
  info: "info",
  notice: "outline",
  warn: "medium",
  error: "high"
};

export function ExecutionSeverityDot({
  severity
}: {
  severity: ExecutionConsoleSeverity;
}) {
  const tone = consoleSeverityTone[severity];
  const color =
    tone === "low"
      ? "bg-emerald-500"
      : tone === "medium"
        ? "bg-amber-500"
        : tone === "high"
          ? "bg-rose-500"
          : tone === "info"
            ? "bg-sky-500"
            : "bg-slate-400";
  return <span className={cn("inline-block h-2 w-2 rounded-full", color)} />;
}

export function KeyValueRow({
  label,
  value
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-right text-[12px] text-slate-800">{value}</span>
    </div>
  );
}
