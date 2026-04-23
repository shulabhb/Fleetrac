import { Sparkles } from "lucide-react";
import { DashboardStrip, StripStat } from "@/components/dashboard/strip";
import { routes, routeToBobByStatus } from "@/lib/routes";

type Investigation = {
  status: string;
  recurring_issue_flag?: boolean;
  recommendations?: Array<{ approval_status?: string }>;
};

/**
 * Dashboard strip for Bob Copilot. This is the "Investigate" band in the
 * Observe → Investigate → Act → Measure narrative — it emphasizes that the
 * governance AI layer is actively examining incidents and drafting bounded,
 * approver-gated recommendations.
 */
export function BobDashboardStrip({
  investigations
}: {
  investigations: Investigation[];
}) {
  const open = investigations.filter((i) =>
    ["draft", "ready_for_review", "awaiting_approval"].includes(i.status)
  );
  const awaiting = investigations.filter((i) => i.status === "awaiting_approval");
  const recurring = investigations.filter((i) => i.recurring_issue_flag);
  const pendingRecs = investigations.reduce(
    (acc, inv) =>
      acc +
      (inv.recommendations || []).filter((r) => r.approval_status === "pending")
        .length,
    0
  );

  return (
    <DashboardStrip
      accent="indigo"
      icon={<Sparkles className="h-3.5 w-3.5" />}
      eyebrow="Investigate · Bob Copilot"
      caption="Bounded, approval-gated recommendations."
      cta={{ label: "Open Bob Copilot", href: routes.bob() }}
      stats={
        <>
          <StripStat
            label="Open investigations"
            value={open.length}
            href={routeToBobByStatus("open")}
          />
          <StripStat
            label="Awaiting approval"
            value={awaiting.length}
            tone="warn"
            emphasize={awaiting.length > 0}
            href={routeToBobByStatus("awaiting_approval")}
          />
          <StripStat
            label="Pending recommendations"
            value={pendingRecs}
            href={routeToBobByStatus("awaiting_approval")}
          />
          <StripStat
            label="Recurring patterns"
            value={recurring.length}
            href={routes.bob()}
          />
        </>
      }
    />
  );
}
