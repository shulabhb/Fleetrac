"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { GovernancePageShell } from "@/components/layout/governance-page-shell";
import { Select } from "@/components/ui/select";
import { SummaryMini } from "@/components/ui/summary-mini";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import {
  approveDemoWorkflowAction,
  isDemoHighRisk,
  readDemoWorkflowActions,
  rejectDemoWorkflowAction
} from "@/lib/governance-demo-actions";
import { highestRiskOwnerTeam } from "@/lib/governance-demo-model";
import {
  governedInTab,
  governedSelectionId,
  mergeGovernedActions,
  parseGovernedSelectionId,
  type GovernedAction
} from "@/lib/governed-actions-mock";
import {
  routeToEvidenceLibraryTeam,
  routeToIncidentsOwnerQueue,
  routes
} from "@/lib/routes";
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
    label: "Awaiting approval",
    caption: "Fleetrac-recommended changes awaiting a human governance decision."
  },
  {
    id: "ready",
    label: "Approved",
    caption: "Approved within policy — cleared for bounded execution or owner handoff."
  },
  {
    id: "closed",
    label: "Closed · exceptions",
    caption: "Policy-blocked, rejected, or rollback candidates — measure impact in Evidence Library."
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
  const [actions, setActions] = useState<GovernedAction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(() => {
    setActions(mergeGovernedActions(readDemoWorkflowActions()));
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener("fleetrac-demo-actions-updated", reload);
    window.addEventListener("focus", reload);
    return () => {
      window.removeEventListener("fleetrac-demo-actions-updated", reload);
      window.removeEventListener("focus", reload);
    };
  }, [reload]);

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
    const actionParam = searchParams?.get("action");
    if (!actionParam) return;
    const match = actions.find(
      (a) => a.id === actionParam || a.incidentId === actionParam
    );
    if (match) setSelectedId(governedSelectionId(match.id));
  }, [searchParams, actions]);

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

  const fromQueue = pendingActions.filter((a) => a.source === "Incident Queue").length;
  const fromEvidence = pendingActions.filter((a) => a.source === "Evidence Library").length;
  const highRiskPending = pendingActions.filter(
    (a) => a.riskLevel === "high" || isDemoHighRisk(a.severity)
  ).length;
  const policyBlocked = actions.filter((a) => a.status === "Policy-blocked").length;
  const autoInScope = pendingActions.filter((a) => a.executionMode === "auto_in_scope").length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return actions.filter((a) => {
      if (!governedInTab(a, tab)) return false;
      if (risk !== "all" && a.riskLevel !== risk) return false;
      if (q) {
        const hay = `${a.incidentTitle} ${a.incidentId} ${a.systemName} ${a.ownerTeam} ${a.assignedTo} ${a.recommendedAction} ${a.source}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [actions, tab, risk, query]);

  const selected = useMemo(() => {
    const id = selectedId ? parseGovernedSelectionId(selectedId) : null;
    if (!id) return null;
    return actions.find((a) => a.id === id) ?? null;
  }, [selectedId, actions]);

  useEffect(() => {
    const inList =
      selectedId != null && filtered.some((a) => governedSelectionId(a.id) === selectedId);
    if (inList) return;
    if (filtered[0]) setSelectedId(governedSelectionId(filtered[0].id));
    else setSelectedId(null);
  }, [tab, filtered, selectedId]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const tabDef = TABS.find((t) => t.id === tab)!;
  const ownerTeam = highestRiskOwnerTeam();

  return (
    <GovernancePageShell
      loop="act"
      eyebrow="Act · Governed remediation"
      title="Action Center"
      subtitle={`${counts.pending} awaiting approval · ${highRiskPending} high-risk · scope: ${scopeLabel}`}
      workflowLine="Fleetrac recommends · approval required before execution · measure outcomes in Evidence Library"
      summary={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryMini label="Awaiting approval" value={String(counts.pending)} />
          <SummaryMini
            label="Workflow handoffs"
            value={`${fromQueue} queue · ${fromEvidence} evidence`}
          />
          <SummaryMini label="High-risk awaiting" value={String(highRiskPending)} />
          <SummaryMini label="Policy-blocked" value={String(policyBlocked)} />
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
              placeholder="Search actions, incidents, systems…"
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
            {autoInScope > 0 && tab === "pending" ? ` · ${autoInScope} auto in scope` : ""}
          </p>
        </div>

        <div className="grid gap-4 p-3 lg:grid-cols-[1fr_minmax(280px,340px)]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Governed actions · {filtered.length}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full divide-y divide-slate-100 text-[12px]">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium">Source</th>
                    <th className="px-2 py-2 text-left font-medium">Incident</th>
                    <th className="px-2 py-2 text-left font-medium">Mode</th>
                    <th className="px-2 py-2 text-left font-medium">Risk</th>
                    <th className="px-2 py-2 text-left font-medium">Owner</th>
                    <th className="px-2 py-2 text-left font-medium">Status</th>
                    <th className="px-2 py-2 text-left font-medium">Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                        {tab === "pending" ? (
                          <span>
                            No governed actions yet.{" "}
                            <Link
                              href={routeToIncidentsOwnerQueue(ownerTeam)}
                              className="font-medium text-slate-800 underline"
                            >
                              Open Incident Queue
                            </Link>
                            {" or "}
                            <Link
                              href={routeToEvidenceLibraryTeam()}
                              className="font-medium text-slate-800 underline"
                            >
                              Evidence Library
                            </Link>
                            .
                          </span>
                        ) : (
                          "No governed actions in this tab."
                        )}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((a) => {
                      const sel = selectedId === governedSelectionId(a.id);
                      return (
                        <tr
                          key={a.id}
                          onClick={() => setSelectedId(governedSelectionId(a.id))}
                          className={cn(
                            "cursor-pointer transition hover:bg-slate-50/90",
                            sel && "border-l-2 border-l-slate-900 bg-slate-50"
                          )}
                        >
                          <td className="whitespace-nowrap px-2 py-2 text-[11px] text-slate-700">
                            {a.source}
                          </td>
                          <td className="max-w-[160px] px-2 py-2 font-medium text-slate-900">
                            {a.incidentTitle}
                          </td>
                          <td className="px-2 py-2">
                            <ExecutionModeChip mode={a.executionMode} />
                          </td>
                          <td className="px-2 py-2">
                            <RiskBadge risk={a.riskLevel ?? severityToRisk(a.severity)} />
                          </td>
                          <td className="max-w-[120px] truncate px-2 py-2 text-slate-700">
                            {a.ownerTeam}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-slate-700">
                            {a.status}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 tabular-nums text-slate-500">
                            {a.decidedAt
                              ? formatRelativeTime(new Date(a.decidedAt))
                              : a.createdAtLabel}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <ActionCenterDetailPanel
            action={selected}
            onDecision={reload}
            onToast={showToast}
          />
        </div>
      </div>

      <p className="text-center text-[12px] text-slate-600">
        <Link
          href={routes.outcomes()}
          className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
        >
          Review measured outcomes in Evidence Library →
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
