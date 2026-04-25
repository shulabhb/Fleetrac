import { PlayCircle } from "lucide-react";
import type { Action } from "@/lib/action-types";
import {
  DashboardStrip,
  StripDivider,
  StripStat
} from "@/components/dashboard/strip";
import { routes, routeToActionsTab } from "@/lib/routes";

type Props = {
  actions: Action[];
  /** When true, strip sits inside a parent command shell (no card chrome). */
  embedded?: boolean;
};

/**
 * Dashboard strip for governed remediation — "Response command center" summary.
 * Counts align with Action Center segments where applicable.
 */
export function ActionCenterStrip({ actions, embedded = false }: Props) {
  const pending = actions.filter(
    (a) =>
      (a.execution_status === "awaiting_approval" ||
        a.execution_status === "drafted" ||
        a.execution_status === "prepared") &&
      a.allowed_by_policy !== false
  ).length;
  const ready = actions.filter(
    (a) =>
      a.execution_status === "ready_to_execute" ||
      a.execution_status === "approved"
  ).length;
  const blocked = actions.filter((a) => a.allowed_by_policy === false).length;
  const regression = actions.filter(
    (a) =>
      a.monitoring_status === "regression_detected" ||
      a.monitoring_status === "rollback_recommended"
  ).length;
  const highRiskPending = actions.filter(
    (a) =>
      a.risk_level === "high" &&
      (a.execution_status === "awaiting_approval" ||
        a.execution_status === "drafted" ||
        a.execution_status === "prepared") &&
      a.allowed_by_policy !== false
  ).length;

  return (
    <DashboardStrip
      embedded={embedded}
      layout="stacked"
      accent="slate"
      icon={<PlayCircle className="h-3.5 w-3.5" />}
      eyebrow="Response command center"
      caption="Governed actions — same lanes as Action Center: decide, clear blocks, then execute within policy."
      cta={{ label: "Open Action Center", href: routes.actions() }}
      stats={
        <>
          <StripStat
            label="Awaiting approval"
            value={pending}
            tone="warn"
            emphasize={pending > 0}
            href={routeToActionsTab("pending")}
          />
          <StripStat
            label="High-risk awaiting"
            value={highRiskPending}
            tone="urgent"
            emphasize={highRiskPending > 0}
            href={routeToActionsTab("pending")}
          />
          <StripStat
            label="Policy-blocked"
            value={blocked}
            tone="warn"
            emphasize={blocked > 0}
            href={routeToActionsTab("blocked")}
          />
          <StripDivider />
          <StripStat
            label="Approved · ready"
            value={ready}
            href={routeToActionsTab("ready")}
          />
          <StripDivider />
          <StripStat
            label="Rollback signal"
            value={regression}
            tone="urgent"
            emphasize={regression > 0}
            href={routeToActionsTab("rollback")}
          />
        </>
      }
    />
  );
}
