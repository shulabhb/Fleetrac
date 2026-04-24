"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Cable, Globe, HardDrive, ShieldCheck, Terminal } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  ConnectorStatus,
  EnvironmentConfig,
  ExecutionConsoleEntry,
  Integration,
  OperationsPolicy,
  OperationsPolicyCategory
} from "@/lib/operations-types";
import { formatRelativeTime } from "@/lib/format";
import { EnvironmentChip, ServiceHealthBadge } from "./operations-badges";
import { ExecutionConsole } from "./execution-console";
import { SettingsIntegrationsTab } from "./settings-integrations-tab";
import { routeToIntegrationSettings } from "@/lib/routes";

type Tab =
  | "integrations"
  | "policies"
  | "environments"
  | "status"
  | "console";

const VALID_TABS: Tab[] = [
  "integrations",
  "policies",
  "environments",
  "status",
  "console"
];

function normalizeTab(raw: string | null | undefined): Tab {
  if (raw && (VALID_TABS as string[]).includes(raw)) return raw as Tab;
  return "integrations";
}

const TABS: { id: Tab; label: string; caption: string; icon: any }[] = [
  {
    id: "integrations",
    label: "Integrations",
    caption: "Observe, config-read, and governed action capability by connector.",
    icon: Cable
  },
  {
    id: "policies",
    label: "Operations policies",
    caption: "Fleet-wide boundaries for Bob, approvals, execution, rollback, and audit.",
    icon: ShieldCheck
  },
  {
    id: "environments",
    label: "Environments",
    caption: "Production, staging, sandbox, and internal-only operating posture.",
    icon: Globe
  },
  {
    id: "status",
    label: "Platform status",
    caption: "Connector and service readiness for the control plane.",
    icon: HardDrive
  },
  {
    id: "console",
    label: "Execution console",
    caption: "Audit-linked record of governed operational acts prepared or executed.",
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = normalizeTab(searchParams?.get("tab"));
  const integrationInUrl = Boolean(searchParams?.get("integration"));
  const effectiveTab: Tab = integrationInUrl ? "integrations" : urlTab;
  const [tab, setTab] = useState<Tab>(effectiveTab);

  // Keep internal state in sync with external URL changes (e.g. user navigates
  // via a deep link like `/settings?tab=policies` or uses browser back/forward).
  useEffect(() => {
    setTab(effectiveTab);
  }, [effectiveTab]);

  const handleTabChange = (next: Tab) => {
    if (next === tab) return;
    setTab(next);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next !== "integrations" && next !== "console") {
      params.delete("integration");
    }
    if (next === "integrations") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const query = params.toString();
    const nextUrl = query ? `/settings?${query}` : "/settings";
    const currentUrl = searchParams?.toString()
      ? `/settings?${searchParams.toString()}`
      : "/settings";
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  };

  const integrationFilterId = searchParams?.get("integration");

  return (
    <div className="space-y-5">
      <TabBar tab={tab} onChange={handleTabChange} />
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-[12px] text-slate-600">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-slate-900">
            Operational job: set the boundaries and integration capability that
            govern the rest of the loop.
          </p>
          <p className="text-[11px] text-slate-500">
            {TABS.find((t) => t.id === tab)?.caption}
          </p>
        </div>
      </div>

      {tab === "integrations" && (
        <SettingsIntegrationsTab integrations={props.integrations} />
      )}
      {tab === "policies" && <PoliciesTab policies={props.policies} />}
      {tab === "environments" && (
        <EnvironmentsTab environments={props.environments} />
      )}
      {tab === "status" && <StatusTab connectors={props.connectors} />}
      {tab === "console" && (
        <ExecutionConsole
          entries={props.executionConsole}
          initialIntegrationId={integrationFilterId}
        />
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

// ---------- Shared helpers ----------

function groupBy<T, K extends string>(items: T[], key: (t: T) => K) {
  return items.reduce<Record<K, T[]>>((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<K, T[]>);
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
  const grouped = useMemo(() => {
    const g = groupBy(policies, (p) => p.category);
    return g as Record<OperationsPolicyCategory, OperationsPolicy[]>;
  }, [policies]);
  const order: OperationsPolicyCategory[] = [
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-500" />
            <span className="font-medium text-slate-800">
              Fleet-wide governance defaults
            </span>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
            Change requires approval
          </span>
        </div>
        <p className="mt-1">
          Applied unless overridden by an environment or system policy. Edits
          here open a governed change request — nothing applies until the
          Governance Office approves and audit records the decision.
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
  const [open, setOpen] = useState(false);
  const [proposal, setProposal] = useState(policy.current_value);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <Card density="compact">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900">
            {policy.label}
          </p>
          <p className="text-[12px] text-slate-500">{policy.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right">
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-800">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            {policy.current_value.replace(/_/g, " ")}
          </span>
          <span className="text-[11px] text-slate-500">
            Scope · {policy.scope.replace("_", " ")}
          </span>
          <button
            type="button"
            onClick={() => {
              setProposal(policy.current_value);
              setOpen(true);
            }}
            className="text-[11px] font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            Propose change
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span className="text-slate-500">Allowed values:</span>
        {policy.allowed_values.map((v) => (
          <span
            key={v}
            className={cn(
              "rounded-md px-1.5 py-0.5 ring-1 ring-slate-200",
              v === policy.current_value
                ? "bg-slate-800 text-white ring-slate-800"
                : "bg-white text-slate-600"
            )}
          >
            {v.replace(/_/g, " ")}
          </span>
        ))}
        <span className="ml-auto">
          Owner on record · {policy.last_changed_by} ·{" "}
          {formatRelativeTime(policy.last_changed_at)}
        </span>
      </div>
      {notice ? (
        <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700">
          {notice}
        </p>
      ) : null}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setOpen(false)}
        >
          <Card
            className="max-w-md p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-slate-900">
              Propose change · {policy.label}
            </p>
            <p className="mt-1 text-[12px] text-slate-500">
              Select a target value. This records a change request for the
              Governance Office — it does not apply immediately.
            </p>
            <label className="mt-3 block text-[11px] font-medium text-slate-600">
              Target value
            </label>
            <select
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
              value={proposal}
              onChange={(e) => setProposal(e.target.value)}
            >
              {policy.allowed_values.map((v) => (
                <option key={v} value={v}>
                  {v.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setNotice(
                    `Change request logged (demo): ${policy.label} → ${proposal.replace(/_/g, " ")}. Pending Governance Office approval.`
                  );
                }}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800"
              >
                Submit request
              </button>
            </div>
          </Card>
        </div>
      ) : null}
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
  const prod = env.kind === "production";
  return (
    <Card
      className={cn(
        "space-y-3",
        prod && "ring-1 ring-slate-300/80"
      )}
    >
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
      <div className="rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-700">
        <p className="font-medium text-slate-800">Operational posture</p>
        <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
          <li>
            <span className="text-slate-500">Bob mode:</span>{" "}
            <span className="font-medium text-slate-900">
              {env.default_bob_mode.replace(/_/g, " ")}
            </span>
          </li>
          <li>
            <span className="text-slate-500">Auto-exec low-risk:</span>{" "}
            <span className="font-medium text-slate-900">
              {env.auto_execute_low_risk ? "Allowed" : "Blocked"}
            </span>
          </li>
          <li>
            <span className="text-slate-500">Maintenance silences alerts:</span>{" "}
            <span className="font-medium text-slate-900">
              {env.maintenance_suppresses_alerts ? "Yes" : "No"}
            </span>
          </li>
          <li>
            <span className="text-slate-500">Rollback dual approval:</span>{" "}
            <span className="font-medium text-slate-900">
              {env.rollback_requires_dual_approval ? "Required" : "Not required"}
            </span>
          </li>
          <li>
            <span className="text-slate-500">Threshold tuning:</span>{" "}
            <span className="font-medium text-slate-900">
              {env.threshold_tuning_pre_approved ? "Pre-approved" : "Review each"}
            </span>
          </li>
          <li>
            <span className="text-slate-500">Tickets:</span>{" "}
            <span className="font-medium text-slate-900">
              {env.ticket_creation_always_allowed ? "Always on" : "Policy-gated"}
            </span>
          </li>
        </ul>
      </div>
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
      <span
        className={cn(
          "font-medium tabular-nums",
          on ? "text-slate-900" : "text-slate-400"
        )}
      >
        {on ? "On" : "Off"}
      </span>
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
  collaboration: "Collaboration",
  alerting: "Alerting & on-call",
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
          Connector and service readiness.
        </span>
      </div>

      <div className="grid gap-2">
        {Object.entries(grouped)
          .sort(([a], [b]) =>
            (CONNECTOR_AREA_LABELS[a] ?? a).localeCompare(
              CONNECTOR_AREA_LABELS[b] ?? b
            )
          )
          .map(([area, items]) => (
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
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <ServiceHealthBadge health={c.health} />
                    {c.latency_ms != null && (
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {c.latency_ms}ms
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">
                      {formatRelativeTime(c.last_check_at)}
                    </span>
                    {c.integration_id ? (
                      <Link
                        href={routeToIntegrationSettings(c.integration_id)}
                        className="text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:underline"
                      >
                        Integration →
                      </Link>
                    ) : null}
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
