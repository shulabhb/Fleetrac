import { PlayCircle } from "lucide-react";
import type { Action } from "@/lib/action-types";
import { DashboardStrip, StripStat } from "@/components/dashboard/strip";
import { routes, routeToActionsTab } from "@/lib/routes";

/**
 * Dashboard strip for governed remediation. Emphasizes that every action is
 * approver-gated, risk-scoped and execution-bounded — this is the "Act" band
 * in the Observe → Investigate → Act → Measure narrative.
 */
export function ActionCenterStrip({ actions }: { actions: Action[] }) {
  const pending = actions.filter(
    (a) =>
      a.execution_status === "awaiting_approval" ||
      a.execution_status === "drafted" ||
      a.execution_status === "prepared"
  ).length;
  const ready = actions.filter(
    (a) =>
      a.execution_status === "ready_to_execute" ||
      a.execution_status === "approved"
  ).length;
  const blocked = actions.filter(
    (a) => a.execution_status === "policy_blocked"
  ).length;
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
        a.execution_status === "prepared")
  ).length;

  return (
    <DashboardStrip
      accent="slate"
      icon={<PlayCircle className="h-3.5 w-3.5" />}
      eyebrow="Act · Governed action queue"
      caption="Approval-gated, policy-checked, bounded execution."
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
            label="Approved · ready"
            value={ready}
            href={routeToActionsTab("ready")}
          />
          <StripStat
            label="Policy-blocked"
            value={blocked}
            tone="warn"
            emphasize={blocked > 0}
            href={routeToActionsTab("blocked")}
          />
          <StripStat
            label="Rollback candidates"
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
