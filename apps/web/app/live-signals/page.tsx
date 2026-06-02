import { LiveSignalsFeed } from "@/components/live-signals/live-signals-feed";
import { GovernancePageShell } from "@/components/layout/governance-page-shell";
import { SummaryMini } from "@/components/ui/summary-mini";
import { LIVE_SIGNALS_SUMMARY } from "@/lib/governance-demo-model";

export default function LiveSignalsPage() {
  return (
    <GovernancePageShell
      loop="observe"
      eyebrow="Observe · Signal hygiene"
      title="Live Signals"
      subtitle={`${LIVE_SIGNALS_SUMMARY.active} active · ${LIVE_SIGNALS_SUMMARY.critical} critical / high`}
      workflowLine="Streaming governance signals — drift, grounding, policy, and security — before they become incidents"
      summary={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryMini label="Active signals" value={String(LIVE_SIGNALS_SUMMARY.active)} />
          <SummaryMini label="Critical / high" value={String(LIVE_SIGNALS_SUMMARY.critical)} />
          <SummaryMini label="Linked incidents" value={String(LIVE_SIGNALS_SUMMARY.linkedIncidents)} />
          <SummaryMini
            label="Systems affected"
            value={String(LIVE_SIGNALS_SUMMARY.systemsAffected)}
          />
        </div>
      }
    >
      <LiveSignalsFeed />
    </GovernancePageShell>
  );
}
