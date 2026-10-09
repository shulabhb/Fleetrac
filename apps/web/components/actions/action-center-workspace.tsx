"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { GovernancePageShell } from "@/components/layout/governance-page-shell";
import { Select } from "@/components/ui/select";
import { SummaryMini } from "@/components/ui/summary-mini";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import { isDemoHighRisk } from "@/lib/governed-actions-types";
import { mapApiActionsToGovernedList } from "@/lib/governance-actions-merge";
import { useGovernanceData } from "@/hooks/use-governance-data";
import {
  governedInTab,
  governedSelectionId,
  parseGovernedSelectionId,
  type GovernedAction
} from "@/lib/governed-actions-types";
import {
  resolveActionVerificationUx,
  verificationToneClass
} from "@/lib/action-verification-ux";
import { isDemoAgent } from "@/lib/governed-fleet-registry";
import {
  routeToEvidenceLibraryTeam,
  routeToIncidentsOwnerQueue,
  routeToIncident,
  routes
} from "@/lib/routes";
import {
  highestRiskOwnerTeamFromInsights,
  buildOwnerInsightsFromApi
} from "@/lib/dashboard-merge";
import { RiskBadge } from "./index";
import { ActionCenterDetailPanel } from "./action-center-detail-panel";
import { ExecutionModeChip } from "@/components/fleetrac/execution-mode-chip";

export type ActionTab = "pending" | "ready" | "closed";

type LegacyTab =
  | "blocked"
  | "executed"
  | "rollback"
  | "closed_rejected";

type Props = {
  defaultTab?: ActionTab | LegacyTab;
  scopeLabel?: string;
};

const TABS: { id: ActionTab; label: string; caption: string }[] = [
  {
    id: "pending",
    label: "Awaiting decision",
    caption: "Approval is still open. Review the bounded recommendation, then approve or reject."
  },
  {
    id: "ready",
    label: "Ready to verify",
    caption: "Approved. Verification is pending until you record the post-approval result."
  },
  {
    id: "closed",
    label: "Verification results",
    caption: "Improvement observed, follow-up required, no material change, or rollback candidate."
  }
];

function normalizeTab(raw?: string): ActionTab {
  if (raw === "ready" || raw === "executed") return "ready";
  if (
    raw === "closed" ||
    raw === "blocked" ||
    raw === "rollback" ||
    raw === "closed_rejected"
  )
    return "closed";
  return "pending";
}

function severityToRisk(severity: string): "low" | "medium" | "high" {
  const s = severity.toLowerCase();
  if (s.includes("critical") || s.includes("high")) return "high";
  if (s.includes("medium")) return "medium";
  return "low";
}

function prioritizeDemoActions(items: GovernedAction[]): GovernedAction[] {
  return [...items].sort((a, b) => {
    const aDemo = isDemoAgent(a.systemId) ? 0 : 1;
    const bDemo = isDemoAgent(b.systemId) ? 0 : 1;
    if (aDemo !== bDemo) return aDemo - bDemo;
    return b.createdAtMs - a.createdAtMs;
  });
}

export function ActionCenterWorkspace({
  defaultTab,
  scopeLabel = "All"
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ActionTab>(normalizeTab(defaultTab));
  const [query, setQuery] = useState(searchParams?.get("q") ?? "");
  const [risk, setRisk] = useState<"low" | "medium" | "high" | "all">(
    (searchParams?.get("risk") as "low" | "medium" | "high" | "all") ?? "all"
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const actionParam = searchParams?.get("action") ?? null;

  const { enabled: governanceEnabled, actions: apiActions, evidenceByAlias, refresh, ownerQueues, dashboard } =
    useGovernanceData();

  const actions = useMemo(() => {
    if (governanceEnabled) {
      return prioritizeDemoActions(
        mapApiActionsToGovernedList(apiActions, evidenceByAlias)
      );
    }
    return [];
  }, [governanceEnabled, apiActions, evidenceByAlias]);

  useEffect(() => {
    const p = new URLSearchParams(searchParams?.toString() ?? "");
    if (tab === "pending") p.delete("tab");
    else p.set("tab", tab);
    if (query.trim()) p.set("q", query.trim());
    else p.delete("q");
    if (risk === "all") p.delete("risk");
    else p.set("risk", risk);
    p.delete("type");
    const next = p.toString();
    const current = searchParams?.toString() ?? "";
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [tab, query, risk, searchParams, pathname, router]);

  useEffect(() => {
    if (!actionParam) return;
    const match = actions.find(
      (a) => a.id === actionParam || a.incidentId === actionParam
    );
    if (!match) return;
    setSelectedId(governedSelectionId(match.id));
    const lane = resolveActionVerificationUx({
      status: match.status,
      rawVerificationStatus: match.rawVerificationStatus,
      verificationStatus: match.verificationStatus,
      incidentId: match.incidentId
    }).lane;
    const laneTab: ActionTab =
      lane === "awaiting_decision"
        ? "pending"
        : lane === "verification_result"
          ? "closed"
          : "ready";
    setTab(laneTab);
  }, [actionParam, actions]);

  const counts = useMemo(() => {
    const c: Record<ActionTab, number> = { pending: 0, ready: 0, closed: 0 };
    actions.forEach((a) => {
      (["pending", "ready", "closed"] as ActionTab[]).forEach((t) => {
        if (governedInTab(a, t)) c[t] += 1;
      });
    });
    return c;
  }, [actions]);

  const pendingActions = useMemo(
    () => actions.filter((a) => governedInTab(a, "pending")),
    [actions]
  );

  const highRiskPending = pendingActions.filter(
    (a) => a.riskLevel === "high" || isDemoHighRisk(a.severity)
  ).length;
  const underVerification = actions.filter((a) => governedInTab(a, "ready")).length;
  const verifiedImproved = actions.filter((a) => {
    const ux = resolveActionVerificationUx({
      status: a.status,
      rawVerificationStatus: a.rawVerificationStatus,
      verificationStatus: a.verificationStatus
    });
    return ux.resultKind === "improved";
  }).length;
  const rollbackCount = actions.filter((a) => {
    const ux = resolveActionVerificationUx({
      status: a.status,
      rawVerificationStatus: a.rawVerificationStatus,
      verificationStatus: a.verificationStatus
    });
    return ux.resultKind === "rollback";
  }).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = actions.filter((a) => {
      if (!governedInTab(a, tab)) return false;
      if (risk !== "all" && a.riskLevel !== risk) return false;
      if (q) {
        const hay = `${a.incidentTitle} ${a.incidentId} ${a.systemName} ${a.ownerTeam} ${a.assignedTo} ${a.recommendedAction} ${a.source}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return prioritizeDemoActions(list);
  }, [actions, tab, risk, query]);

  const selected = useMemo(() => {
    const id = selectedId ? parseGovernedSelectionId(selectedId) : null;
    if (!id) return null;
    return actions.find((a) => a.id === id) ?? null;
  }, [selectedId, actions]);

  useEffect(() => {
    if (!selectedId) {
      if (filtered[0]) setSelectedId(governedSelectionId(filtered[0].id));
      return;
    }
    const current = actions.find((a) => governedSelectionId(a.id) === selectedId);
    if (!current) {
      if (filtered[0]) setSelectedId(governedSelectionId(filtered[0].id));
      else setSelectedId(null);
      return;
    }
    if (governedInTab(current, tab)) return;
    const lane = resolveActionVerificationUx({
      status: current.status,
      rawVerificationStatus: current.rawVerificationStatus,
      verificationStatus: current.verificationStatus,
      incidentId: current.incidentId
    }).lane;
    setTab(lane === "awaiting_decision" ? "pending" : lane === "verification_result" ? "closed" : "ready");
  }, [tab, filtered, selectedId, actions]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const onDecision = useCallback(() => {
    void refresh(true);
  }, [refresh]);

  const tabDef = TABS.find((t) => t.id === tab)!;
  const ownerTeam = useMemo(
    () =>
      highestRiskOwnerTeamFromInsights(
        buildOwnerInsightsFromApi(ownerQueues, dashboard)
      ),
    [ownerQueues, dashboard]
  );

  return (
    <GovernancePageShell
      loop="act"
      eyebrow="Act · Bounded remediation"
      title="Action Center"
      subtitle={`${counts.pending} awaiting decision · ${underVerification} ready to verify · scope: ${scopeLabel}`}
      workflowLine="Approve bounded action → verify impact → reflect outcome on Risk Detail"
      summary={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryMini label="Awaiting decision" value={String(counts.pending)} />
          <SummaryMini label="Ready to verify" value={String(underVerification)} />
          <SummaryMini label="Improved" value={String(verifiedImproved)} />
          <SummaryMini
            label="Rollback candidates"
            value={String(rollbackCount)}
          />
        </div>
      }
    >
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-1.5">
          {TABS.map((t) => (
            <TabButton
              key={t.id}
              active={tab === t.id}
              label={t.label}
              count={counts[t.id]}
              onClick={() => setTab(t.id)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search actions, risks, agents…"
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <Select
            value={risk}
            onChange={(e) => setRisk(e.target.value as typeof risk)}
            className="h-8 min-w-[110px] text-[11px]"
          >
            <option value="all">Risk: Any</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-slate-50 px-3 py-2 text-[11px]">
          <p className="text-slate-500">{tabDef.caption}</p>
          <p className="shrink-0 tabular-nums text-slate-400">
            {filtered.length} of {counts[tab]}
            {highRiskPending > 0 && tab === "pending"
              ? ` · ${highRiskPending} high-risk`
              : ""}
          </p>
        </div>

        <div className="grid gap-4 p-3 lg:grid-cols-[1fr_minmax(300px,360px)]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Governed actions · {filtered.length}
              </p>
            </div>
            <div className="max-h-[min(70vh,40rem)] space-y-2 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="px-3 py-8 text-center text-[12px] text-slate-500">
                  {tab === "pending" ? (
                    <span>
                      No actions awaiting decision.{" "}
                      <Link
                        href={routeToIncidentsOwnerQueue(ownerTeam)}
                        className="font-medium text-slate-800 underline"
                      >
                        Review risk queue
                      </Link>
                      .
                    </span>
                  ) : tab === "ready" ? (
                    "No actions are waiting for verification. Approve a governed action first."
                  ) : (
                    "No verification results yet. Outcomes appear after you verify an approved action."
                  )}
                </div>
              ) : (
                filtered.map((a) => (
                  <ActionListCard
                    key={a.id}
                    action={a}
                    selected={selectedId === governedSelectionId(a.id)}
                    onSelect={() => setSelectedId(governedSelectionId(a.id))}
                  />
                ))
              )}
            </div>
          </div>

          <ActionCenterDetailPanel
            action={selected}
            onDecision={onDecision}
            onToast={showToast}
          />
        </div>
      </div>

      <p className="text-center text-[12px] text-slate-600">
        <Link
          href={routes.outcomes()}
          className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
        >
          Historical outcome evidence (audit) →
        </Link>
      </p>

      {toast ? (
        <div
          className="fixed bottom-4 right-4 z-[110] max-w-sm rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-800 shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </GovernancePageShell>
  );
}

function ActionListCard({
  action,
  selected,
  onSelect
}: {
  action: GovernedAction;
  selected: boolean;
  onSelect: () => void;
}) {
  const ux = resolveActionVerificationUx({
    status: action.status,
    verificationStatus: action.verificationStatus,
    rawVerificationStatus: action.rawVerificationStatus,
    incidentId: action.incidentId
  });

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${action.incidentId}: ${ux.decisionLabel}. ${ux.nextStepCta}`}
      className={cn(
        "w-full rounded-md border px-3 py-2.5 text-left transition",
        selected
          ? "border-slate-900 bg-slate-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                verificationToneClass(ux.tone)
              )}
            >
              {ux.decisionLabel}
            </span>
            {ux.verificationLabel !== "Not started" ? (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200">
                {ux.verificationLabel}
              </span>
            ) : null}
            <RiskBadge risk={action.riskLevel ?? severityToRisk(action.severity)} />
            <ExecutionModeChip mode={action.executionMode} />
          </div>
          <p className="mt-1.5 truncate text-[13px] font-semibold text-slate-900">
            {action.incidentTitle}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600">
            <span className="font-medium text-slate-700">
              {action.systemName || action.systemId || "Agent"}
            </span>
            <span className="text-slate-300"> · </span>
            <span>{action.ownerTeam}</span>
            <span className="text-slate-300"> · </span>
            <Link
              href={routeToIncident(action.incidentId)}
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-slate-500 hover:text-slate-800 hover:underline"
            >
              {action.incidentId}
            </Link>
          </p>
          {action.expectedMetric ? (
            <p className="mt-0.5 text-[11px] text-slate-500">
              Expected metric: {action.expectedMetric.replace(/_/g, " ")}
            </p>
          ) : null}
          <p className="mt-1.5 text-[11px] font-medium text-slate-800">
            Next: {ux.nextStepCta}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Updated</p>
          <p className="text-[11px] tabular-nums text-slate-600">
            {action.decidedAt
              ? formatRelativeTime(new Date(action.decidedAt))
              : action.createdAtLabel}
          </p>
          <span className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-700">
            {ux.nextStepCta}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </span>
        </div>
      </div>
    </button>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-xs font-medium transition",
        active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      {label}
      <span
        className={cn(
          "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
          active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
        )}
      >
        {count}
      </span>
    </button>
  );
}
