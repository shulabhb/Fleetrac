"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Cable,
  GitBranch,
  Globe,
  HardDrive,
  ShieldCheck,
  Terminal,
  Workflow
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  ConnectorStatus,
  EnvironmentConfig,
  ExecutionConsoleEntry,
  Integration,
  OperationsPolicy
} from "@/lib/operations-types";
import { formatRelativeTime } from "@/lib/format";
import {
  ActionScopeBadge,
  AuthStatusBadge,
  ConnectionStatusBadge,
  ConnectorTypeChip,
  EnvironmentChip,
  ServiceHealthBadge,
  SyncStatusBadge,
  TelemetryAvailabilityBadge
} from "./operations-badges";
import { ExecutionConsole } from "./execution-console";

type Tab =
  | "integrations"
  | "policies"
  | "environments"
  | "status"
  | "console";

const TABS: { id: Tab; label: string; caption: string; icon: any }[] = [
  {
    id: "integrations",
    label: "Integrations",
    caption: "External systems Fleetrac is connected to.",
    icon: Cable
  },
  {
    id: "policies",
    label: "Operations Policies",
    caption: "Fleet-wide governance defaults for Bob and actions.",
    icon: ShieldCheck
  },
  {
    id: "environments",
    label: "Environments",
    caption: "Per-environment policy differences.",
    icon: Globe
  },
  {
    id: "status",
    label: "Platform Status",
    caption: "Connector + service readiness.",
    icon: HardDrive
  },
  {
    id: "console",
    label: "Execution Console",
    caption: "Governed operational acts Bob has prepared or executed.",
    icon: Terminal
  }
];

type Props = {
  integrations: Integration[];
  policies: OperationsPolicy[];
  environments: EnvironmentConfig[];
  connectors: ConnectorStatus[];
  executionConsole: ExecutionConsoleEntry[];
};

export function SettingsView(props: Props) {
  const [tab, setTab] = useState<Tab>("integrations");

  return (
    <div className="space-y-5">
      <TabBar tab={tab} onChange={setTab} />

      {tab === "integrations" && (
        <IntegrationsTab integrations={props.integrations} />
      )}
      {tab === "policies" && <PoliciesTab policies={props.policies} />}
      {tab === "environments" && (
        <EnvironmentsTab environments={props.environments} />
      )}
      {tab === "status" && <StatusTab connectors={props.connectors} />}
      {tab === "console" && (
        <ExecutionConsole entries={props.executionConsole} />
      )}
    </div>
  );
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition",
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Integrations ----------

function groupBy<T, K extends string>(items: T[], key: (t: T) => K) {
  return items.reduce<Record<K, T[]>>((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

const INTEGRATION_GROUP_ORDER = [
  "cloud",
  "data_platform",
  "model_provider",
  "internal_model_api",
  "observability",
  "ticketing",
  "workflow",
  "model_registry"
] as const;

const INTEGRATION_GROUP_LABELS: Record<string, string> = {
  cloud: "Cloud",
  data_platform: "Data platforms",
  model_provider: "Model providers",
  internal_model_api: "Internal model APIs",
  observability: "Observability",
  ticketing: "Ticketing",
  workflow: "Workflow runners",
  model_registry: "Model registries"
};

function IntegrationsTab({ integrations }: { integrations: Integration[] }) {
  const grouped = useMemo(
    () => groupBy(integrations, (i) => i.kind),
    [integrations]
  );

  const totals = useMemo(() => {
    const connected = integrations.filter(
      (i) => i.connection_status === "connected"
    ).length;
    const issues = integrations.length - connected;
    return { connected, issues };
  }, [integrations]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-[12px]">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-900 text-white">
          <Cable className="h-3 w-3" />
        </span>
        <span className="font-medium text-slate-800">
          {integrations.length} integrations configured
        </span>
        <Badge tone="low">{totals.connected} connected</Badge>
        {totals.issues > 0 && (
          <Badge tone="medium">{totals.issues} need attention</Badge>
        )}
        <span className="ml-auto text-[11px] text-slate-500">
          Read-only configuration view. Changes route through Platform
          Engineering.
        </span>
      </div>

      {INTEGRATION_GROUP_ORDER.map((kind) => {
        const items = grouped[kind];
        if (!items?.length) return null;
        return (
          <section key={kind} className="space-y-2">
            <h3 className="label-eyebrow">{INTEGRATION_GROUP_LABELS[kind]}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((i) => (
                <IntegrationCard key={i.id} integration={i} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function IntegrationCard({ integration }: { integration: Integration }) {
  return (
    <Card density="compact" className="space-y-3">
      <CardHeader
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>{integration.provider}</span>
            <ConnectionStatusBadge status={integration.connection_status} />
          </div>
        }
        caption={integration.note ?? undefined}
        action={<ConnectorTypeChip type={integration.connector_type} />}
      />
      <div className="flex flex-wrap gap-1.5">
        <AuthStatusBadge status={integration.auth_status} />
        <SyncStatusBadge status={integration.sync_status} />
        <TelemetryAvailabilityBadge level={integration.telemetry_availability} />
        <ActionScopeBadge scope={integration.action_scope} />
        <Badge tone="outline">
          Config · {integration.config_access.replace("_", " ")}
        </Badge>
      </div>
      <div className="grid gap-1.5 text-[12px] text-slate-700">
        <InfoRow label="Environments">
          <div className="flex flex-wrap justify-end gap-1">
            {integration.environments.map((e) => (
              <Badge key={e} tone="outline">
                {e}
              </Badge>
            ))}
          </div>
        </InfoRow>
        <InfoRow label="Last sync">
          {formatRelativeTime(integration.last_sync)}
        </InfoRow>
        {integration.capabilities.length > 0 && (
          <InfoRow label="Capabilities">
            <span className="text-right text-[11px] text-slate-600">
              {integration.capabilities.join(" · ")}
            </span>
          </InfoRow>
        )}
      </div>
    </Card>
  );
}

function InfoRow({
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

// ---------- Policies ----------

const POLICY_CATEGORY_LABELS: Record<string, string> = {
  bob_defaults: "Bob defaults",
  approvals: "Approvals",
  execution: "Execution",
  maintenance: "Maintenance",
  rollback: "Rollback",
  audit: "Audit"
};

function PoliciesTab({ policies }: { policies: OperationsPolicy[] }) {
  const grouped = useMemo(
    () => groupBy(policies, (p) => p.category),
    [policies]
  );
  const order = [
    "bob_defaults",
    "approvals",
    "execution",
    "rollback",
    "maintenance",
    "audit"
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-[12px] text-slate-600">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-slate-500" />
          <span className="font-medium text-slate-800">
            Fleet-wide governance defaults
          </span>
        </div>
        <p className="mt-1">
          These values are applied unless overridden by an environment- or
          system-specific policy. Changes require Governance Office approval
          and are logged to the audit stream.
        </p>
      </div>

      {order.map((cat) => {
        const items = grouped[cat];
        if (!items?.length) return null;
        return (
          <section key={cat} className="space-y-2">
            <h3 className="label-eyebrow">{POLICY_CATEGORY_LABELS[cat]}</h3>
            <div className="grid gap-2">
              {items.map((p) => (
                <PolicyRow key={p.id} policy={p} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PolicyRow({ policy }: { policy: OperationsPolicy }) {
  return (
    <Card density="compact">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900">
            {policy.label}
          </p>
          <p className="text-[12px] text-slate-500">{policy.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white">
            <CheckCircle2 className="h-3 w-3" />
            {policy.current_value.replace(/_/g, " ")}
          </span>
          <span className="text-[11px] text-slate-500">
            Scope · {policy.scope.replace("_", " ")}
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span className="text-slate-500">Allowed:</span>
        {policy.allowed_values.map((v) => (
          <span
            key={v}
            className={cn(
              "rounded-md px-1.5 py-0.5 ring-1 ring-slate-200",
              v === policy.current_value
                ? "bg-slate-900 text-white ring-slate-900"
                : "bg-white text-slate-600"
            )}
          >
            {v.replace(/_/g, " ")}
          </span>
        ))}
        <span className="ml-auto">
          Last changed by {policy.last_changed_by} ·{" "}
          {formatRelativeTime(policy.last_changed_at)}
        </span>
      </div>
    </Card>
  );
}

// ---------- Environments ----------

function EnvironmentsTab({
  environments
}: {
  environments: EnvironmentConfig[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {environments.map((env) => (
        <EnvironmentCard key={env.id} env={env} />
      ))}
    </div>
  );
}

function EnvironmentCard({ env }: { env: EnvironmentConfig }) {
  return (
    <Card className="space-y-3">
      <CardHeader
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>{env.label}</span>
            <EnvironmentChip env={env.kind} />
            <Badge tone="outline">{env.system_count} systems</Badge>
          </div>
        }
        caption={env.description}
      />
      <div className="grid gap-1.5 text-[12px] text-slate-700">
        <InfoRow label="Default Bob mode">
          <span className="font-mono text-[11px] text-slate-600">
            {env.default_bob_mode.replace(/_/g, " ")}
          </span>
        </InfoRow>
        <InfoRow label="Approval policy">
          <span className="text-[12px] text-slate-800">
            {env.approval_policy_label}
          </span>
        </InfoRow>
        <ToggleRow
          label="Auto-execute low-risk reversible"
          on={env.auto_execute_low_risk}
        />
        <ToggleRow
          label="Maintenance suppresses alerts"
          on={env.maintenance_suppresses_alerts}
        />
        <ToggleRow
          label="Bob allowed during maintenance"
          on={env.bob_allowed_during_maintenance}
        />
        <ToggleRow
          label="Rollback requires dual approval"
          on={env.rollback_requires_dual_approval}
        />
        <ToggleRow
          label="Threshold tuning pre-approved"
          on={env.threshold_tuning_pre_approved}
        />
        <ToggleRow
          label="Ticket creation always allowed"
          on={env.ticket_creation_always_allowed}
        />
      </div>
    </Card>
  );
}

function ToggleRow({ label, on }: { label: string; on: boolean }) {
  return (
    <InfoRow label={label}>
      {on ? (
        <Badge tone="low">Enabled</Badge>
      ) : (
        <Badge tone="outline">Disabled</Badge>
      )}
    </InfoRow>
  );
}

// ---------- Status ----------

const CONNECTOR_AREA_LABELS: Record<string, string> = {
  telemetry_ingest: "Telemetry ingestion",
  cloud_logs: "Cloud logs",
  config_metadata: "Config metadata",
  action_runner: "Action runner",
  ticketing: "Ticketing",
  workflow_runner: "Workflow runner",
  bob_investigation: "Bob investigation service",
  version_sync: "Version sync",
  model_registry: "Model registry"
};

function StatusTab({ connectors }: { connectors: ConnectorStatus[] }) {
  const grouped = useMemo(
    () => groupBy(connectors, (c) => c.area),
    [connectors]
  );

  const healthy = connectors.filter((c) => c.health === "healthy").length;
  const total = connectors.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-[12px]">
        <HardDrive className="h-4 w-4 text-slate-500" />
        <span className="font-medium text-slate-800">Platform readiness</span>
        <Badge tone={healthy === total ? "low" : "medium"}>
          {healthy} / {total} healthy
        </Badge>
        <span className="ml-auto text-[11px] text-slate-500">
          Connector + service status powering the governance operations plane.
        </span>
      </div>

      <div className="grid gap-2">
        {Object.entries(grouped).map(([area, items]) => (
          <Card key={area} density="compact" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[12px] font-semibold text-slate-900">
                {CONNECTOR_AREA_LABELS[area] ?? area}
              </h4>
              <Badge tone="outline">{items.length} endpoint{items.length === 1 ? "" : "s"}</Badge>
            </div>
            <div className="divide-y divide-slate-100">
              {items.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-1.5 text-[12px]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{c.name}</p>
                    {c.note && (
                      <p className="text-[11px] text-slate-500">{c.note}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <ServiceHealthBadge health={c.health} />
                    {c.latency_ms != null && (
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {c.latency_ms}ms
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">
                      {formatRelativeTime(c.last_check_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
