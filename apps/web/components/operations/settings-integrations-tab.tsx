"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Cable,
  ChevronRight,
  MoreHorizontal,
  Plug,
  RefreshCw,
  Shield,
  Unplug,
  Wrench
} from "lucide-react";
import type { Integration } from "@/lib/operations-types";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import { routeToIntegrationSettings, routeToSettings } from "@/lib/routes";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConnectionStatusBadge } from "./operations-badges";
import { IntegrationProviderMark } from "./integration-provider-mark";
import { IntegrationAccessStrip } from "./integration-access-strip";
import { environmentScopeLabel } from "@/lib/integration-access-vocabulary";

const GROUP_ORDER = [
  "cloud",
  "data_platform",
  "model_provider",
  "internal_model_api",
  "observability",
  "ticketing",
  "collaboration",
  "workflow",
  "model_registry"
] as const;

const GROUP_LABELS: Record<string, string> = {
  cloud: "Cloud",
  data_platform: "Data platforms",
  model_provider: "Model providers",
  internal_model_api: "Internal model APIs",
  observability: "Observability",
  ticketing: "Ticketing",
  collaboration: "Collaboration",
  workflow: "Workflow runners",
  model_registry: "Model registries"
};

function groupBy<T, K extends string>(items: T[], key: (t: T) => K) {
  return items.reduce<Record<K, T[]>>((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

export function SettingsIntegrationsTab({
  integrations
}: {
  integrations: Integration[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailId = searchParams?.get("integration");

  const [flash, setFlash] = useState<string | null>(null);
  const [localAdded, setLocalAdded] = useState<Integration[]>([]);
  const [category, setCategory] = useState<(typeof GROUP_ORDER)[number] | "all">(
    "all"
  );
  const [addOpen, setAddOpen] = useState(false);

  const allIntegrations = useMemo(
    () => [...integrations, ...localAdded],
    [integrations, localAdded]
  );

  const grouped = useMemo(
    () => groupBy(allIntegrations, (i) => i.kind as (typeof GROUP_ORDER)[number]),
    [allIntegrations]
  );

  const filtered = useMemo(() => {
    if (category === "all") return allIntegrations;
    return allIntegrations.filter((i) => i.kind === category);
  }, [allIntegrations, category]);

  const sorted = useMemo(() => {
    const rank = (i: Integration) => {
      if (i.connection_status === "needs_auth" || i.connection_status === "disconnected")
        return 0;
      if (i.connection_status === "degraded") return 1;
      return 2;
    };
    return [...filtered].sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      return a.provider.localeCompare(b.provider);
    });
  }, [filtered]);

  const totals = useMemo(() => {
    const connected = allIntegrations.filter(
      (i) => i.connection_status === "connected"
    ).length;
    return { connected, total: allIntegrations.length };
  }, [allIntegrations]);

  const openDetail = useCallback(
    (id: string) => {
      const next = routeToIntegrationSettings(id);
      const current = searchParams?.toString()
        ? `/settings?${searchParams.toString()}`
        : "/settings";
      if (current !== next) {
        router.replace(next, { scroll: false });
      }
    },
    [router, searchParams]
  );

  const closeDetail = useCallback(() => {
    const p = new URLSearchParams(searchParams?.toString() ?? "");
    p.delete("integration");
    const s = p.toString();
    const next = s ? `/settings?${s}` : "/settings";
    const current = searchParams?.toString()
      ? `/settings?${searchParams.toString()}`
      : "/settings";
    if (next !== current) {
      router.replace(next, { scroll: false });
    }
  }, [router, searchParams]);

  const runDemoAction = useCallback((label: string) => {
    setFlash(`${label} (demo — no backend call)`);
    window.setTimeout(() => setFlash(null), 4200);
  }, []);

  const detailIntegration = detailId
    ? allIntegrations.find((i) => i.id === detailId)
    : undefined;

  return (
    <div className="space-y-3">
      {flash ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
          {flash}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[12px] shadow-card">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-white">
          <Cable className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">Integration fleet</p>
          <p className="text-[11px] text-slate-500">
            {totals.connected}/{totals.total} connected · manage auth, sync, and
            scopes per connector
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <Plug className="h-3.5 w-3.5" />
          Add integration
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <CategoryChip
          active={category === "all"}
          onClick={() => setCategory("all")}
          label="All"
          count={allIntegrations.length}
        />
        {GROUP_ORDER.map((k) => {
          const n = grouped[k]?.length ?? 0;
          if (!n) return null;
          return (
            <CategoryChip
              key={k}
              active={category === k}
              onClick={() => setCategory(k)}
              label={GROUP_LABELS[k]}
              count={n}
            />
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        <div className="hidden border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[40px_minmax(0,1.2fr)_minmax(0,1.4fr)_120px_auto] md:gap-3">
          <span />
          <span>Provider</span>
          <span>Access</span>
          <span>Status</span>
          <span className="text-right">Manage</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {sorted.map((i) => (
            <li key={i.id}>
              <IntegrationOperatorRow
                integration={i}
                onOpenDetail={() => openDetail(i.id)}
                onDemoAction={runDemoAction}
              />
            </li>
          ))}
        </ul>
      </div>

      {addOpen ? (
        <AddIntegrationDialog
          onClose={() => setAddOpen(false)}
          existingIds={new Set(allIntegrations.map((x) => x.id))}
          onConnect={(template) => {
            setLocalAdded((prev) => [...prev, template]);
            setAddOpen(false);
            runDemoAction(`Registered ${template.provider}`);
            openDetail(template.id);
          }}
        />
      ) : null}

      {detailIntegration ? (
        <IntegrationDetailDialog
          integration={detailIntegration}
          onClose={closeDetail}
          onDemoAction={runDemoAction}
        />
      ) : null}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
  count
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      )}
    >
      {label}
      <span className="tabular-nums opacity-80">{count}</span>
    </button>
  );
}

function IntegrationOperatorRow({
  integration: i,
  onOpenDetail,
  onDemoAction
}: {
  integration: Integration;
  onOpenDetail: () => void;
  onDemoAction: (s: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-2 px-3 py-2.5 md:grid-cols-[40px_minmax(0,1.2fr)_minmax(0,1.4fr)_120px_auto] md:items-center md:gap-3">
      <IntegrationProviderMark integrationId={i.id} providerKey={i.provider_key} />
      <div className="min-w-0">
        <button
          type="button"
          onClick={onOpenDetail}
          className="text-left text-[13px] font-semibold text-slate-900 hover:underline"
        >
          {i.provider}
        </button>
        <p className="truncate text-[11px] text-slate-500">
          {GROUP_LABELS[i.kind] ?? i.kind}
          {i.note ? ` · ${i.note}` : ""}
        </p>
      </div>
      <div className="min-w-0 md:border-l md:border-slate-100 md:pl-3">
        <IntegrationAccessStrip
          telemetry={i.telemetry_availability}
          config={i.config_access}
          action={i.action_scope}
          dense
          className="border-0 pt-0"
        />
      </div>
      <div>
        <ConnectionStatusBadge status={i.connection_status} />
        <p className="mt-0.5 text-[11px] text-slate-500">
          Sync · {formatRelativeTime(i.last_sync)}
        </p>
      </div>
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onOpenDetail}
          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
        >
          Details
        </button>
        <div className="relative">
          <button
            type="button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
            aria-label="Integration actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-slate-200 bg-white py-1 text-[11px] shadow-lg">
              <MenuAction
                icon={<RefreshCw className="h-3.5 w-3.5" />}
                label="Sync now"
                onClick={() => {
                  setMenuOpen(false);
                  onDemoAction(`Sync queued · ${i.provider}`);
                }}
              />
              <MenuAction
                icon={<Shield className="h-3.5 w-3.5" />}
                label="Test connection"
                onClick={() => {
                  setMenuOpen(false);
                  onDemoAction(`Connection test · ${i.provider}`);
                }}
              />
              <MenuAction
                icon={<Wrench className="h-3.5 w-3.5" />}
                label="Re-authenticate"
                onClick={() => {
                  setMenuOpen(false);
                  onDemoAction(`Re-auth wizard · ${i.provider}`);
                }}
              />
              <MenuAction
                icon={<Unplug className="h-3.5 w-3.5" />}
                label="Disconnect"
                danger
                onClick={() => {
                  setMenuOpen(false);
                  onDemoAction(`Disconnect scheduled · ${i.provider}`);
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MenuAction({
  icon,
  label,
  onClick,
  danger
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50",
        danger ? "text-rose-700" : "text-slate-700"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function IntegrationDetailDialog({
  integration: i,
  onClose,
  onDemoAction
}: {
  integration: Integration;
  onClose: () => void;
  onDemoAction: (s: string) => void;
}) {
  const scopes = i.granted_scopes ?? [];
  const activity = i.activity_log ?? [];
  const failures = i.failure_notes ?? [];
  const audit = i.audit_log ?? [];
  const endpoints = i.downstream_endpoints ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 transition-opacity duration-150 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`int-title-${i.id}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,880px)] w-full max-w-lg translate-y-0 flex-col rounded-t-lg border border-slate-200 bg-white shadow-xl transition-transform duration-150 sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
          <IntegrationProviderMark integrationId={i.id} providerKey={i.provider_key} />
          <div className="min-w-0 flex-1">
            <h2
              id={`int-title-${i.id}`}
              className="text-base font-semibold text-slate-900"
            >
              {i.provider}
            </h2>
            <p className="text-[11px] text-slate-500">
              <span className="font-mono">{i.id}</span> · {GROUP_LABELS[i.kind] ?? i.kind}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[12px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 text-[12px]">
          <div className="flex flex-wrap items-center gap-2">
            <ConnectionStatusBadge status={i.connection_status} />
            <span className="text-slate-600">
              Last sync {formatRelativeTime(i.last_sync)}
            </span>
          </div>

          {i.note ? (
            <p className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2 text-slate-700">
              {i.note}
            </p>
          ) : null}

          <IntegrationAccessStrip
            telemetry={i.telemetry_availability}
            config={i.config_access}
            action={i.action_scope}
          />

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Environments enabled
            </h3>
            <div className="mt-1 flex flex-wrap gap-1">
              {i.environments.map((e) => (
                <span
                  key={e}
                  className="rounded-md bg-white px-2 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200"
                >
                  {environmentScopeLabel(e)}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Bob & execution
            </h3>
            <p className="mt-1 text-slate-700">
              Bob may{" "}
              <span className="font-medium">
                {i.bob_prepare_actions !== false ? "prepare" : "not prepare"}
              </span>{" "}
              governed actions using this integration
              {i.bob_execute_after_approval
                ? "; execution may run here after explicit approval."
                : "; execution does not run here without a separate approval-gated runner."}
            </p>
          </div>

          {scopes.length > 0 ? (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Granted scopes
              </h3>
              <ul className="mt-1 space-y-1 font-mono text-[11px] text-slate-700">
                {scopes.map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {endpoints.length > 0 ? (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Downstream endpoints
              </h3>
              <ul className="mt-1 space-y-0.5 text-[11px] text-slate-700">
                {endpoints.map((e) => (
                  <li key={e}>· {e}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {i.capabilities.length > 0 ? (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Capabilities
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                {i.capabilities.join(" · ")}
              </p>
            </div>
          ) : null}

          {failures.length > 0 ? (
            <div className="rounded-md border border-rose-100 bg-rose-50/60 px-3 py-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-rose-800">
                Failures / warnings
              </h3>
              <ul className="mt-1 list-disc pl-4 text-[11px] text-rose-900">
                {failures.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {activity.length > 0 ? (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Recent activity
              </h3>
              <ul className="mt-1 space-y-1.5 border-l border-slate-200 pl-3">
                {activity.map((a, idx) => (
                  <li key={idx} className="text-[11px] text-slate-700">
                    <span className="font-mono text-slate-400">
                      {formatRelativeTime(a.at)}
                    </span>{" "}
                    <span
                      className={
                        a.level === "error"
                          ? "text-rose-800"
                          : a.level === "warn"
                            ? "text-amber-800"
                            : ""
                      }
                    >
                      {a.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {audit.length > 0 ? (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Audit trail
              </h3>
              <ul className="mt-1 space-y-1.5 text-[11px] text-slate-700">
                {audit.map((a, idx) => (
                  <li key={idx}>
                    <span className="font-mono text-slate-400">
                      {formatRelativeTime(a.at)}
                    </span>{" "}
                    <span className="font-medium">{a.actor}</span> — {a.summary}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <ActionButton
              onClick={() => onDemoAction(`Sync now · ${i.provider}`)}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              label="Sync now"
            />
            <ActionButton
              onClick={() => onDemoAction(`Test connection · ${i.provider}`)}
              icon={<Shield className="h-3.5 w-3.5" />}
              label="Test connection"
            />
            <ActionButton
              onClick={() => onDemoAction(`Re-authenticate · ${i.provider}`)}
              icon={<Wrench className="h-3.5 w-3.5" />}
              label="Re-authenticate"
            />
            <Link
              href={routeToSettings("console", { integration: i.id })}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              Execution log
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  icon
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-800 hover:border-slate-300 hover:bg-slate-50"
    >
      {icon}
      {label}
    </button>
  );
}

const CATALOG_TEMPLATES: Integration[] = [
  {
    id: "int_grafana_cloud",
    provider: "Grafana Cloud",
    kind: "observability",
    connection_status: "disconnected",
    auth_status: "not_configured",
    sync_status: "idle",
    connector_type: "api",
    environments: ["staging", "sandbox"],
    telemetry_availability: "partial",
    config_access: "read_only",
    action_scope: "none",
    last_sync: null,
    note: "Not yet connected. Metrics and dashboards for model latency SLOs.",
    capabilities: ["metrics_query", "dashboards_read"],
    provider_key: "generic",
    granted_scopes: ["metrics:read"],
    bob_prepare_actions: true,
    bob_execute_after_approval: false
  }
];

function AddIntegrationDialog({
  onClose,
  existingIds,
  onConnect
}: {
  onClose: () => void;
  existingIds: Set<string>;
  onConnect: (i: Integration) => void;
}) {
  const available = CATALOG_TEMPLATES.filter((t) => !existingIds.has(t.id));
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <Card
        className="max-h-[80vh] w-full max-w-md overflow-y-auto p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Add integration</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[12px] text-slate-500 hover:text-slate-800"
          >
            Close
          </button>
        </div>
        <p className="mt-1 text-[12px] text-slate-500">
          Select a connector to register. In production this opens an OAuth or API
          key flow scoped by the Governance Office.
        </p>
        <ul className="mt-3 space-y-2">
          {available.length === 0 ? (
            <li className="text-[12px] text-slate-500">All catalog entries are already registered.</li>
          ) : (
            available.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-md border border-slate-100 px-3 py-2"
              >
                <div>
                  <p className="text-[13px] font-medium text-slate-900">{t.provider}</p>
                  <p className="text-[11px] text-slate-500">{t.note}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onConnect(t)}
                  className="shrink-0 rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800"
                >
                  Connect
                </button>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
