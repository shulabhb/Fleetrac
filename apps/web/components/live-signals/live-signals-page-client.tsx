"use client";

import { useMemo } from "react";
import { GovernancePageShell } from "@/components/layout/governance-page-shell";
import { SummaryMini } from "@/components/ui/summary-mini";
import { LiveSignalsFeed } from "@/components/live-signals/live-signals-feed";
import { useGovernanceData } from "@/hooks/use-governance-data";
import { buildLiveSignalsSummaryFromApi } from "@/lib/governance-merge";

const EMPTY_LIVE_SIGNALS_SUMMARY = {
  active: 0,
  critical: 0,
  linkedIncidents: 0,
  systemsAffected: 0
};

export function LiveSignalsPageClient() {
  const { liveSignals, ingestLog, simulatorStatus, governanceSystems, refreshObserve } =
    useGovernanceData();

  const summary = useMemo(
    () => buildLiveSignalsSummaryFromApi(liveSignals) ?? EMPTY_LIVE_SIGNALS_SUMMARY,
    [liveSignals]
  );

  return (
    <GovernancePageShell
      loop="observe"
      eyebrow="Observe · Signal hygiene"
      title="Live Signals"
      subtitle={`${summary.active} active · ${summary.critical} critical / high`}
      workflowLine="Streaming governance signals — drift, grounding, policy, and security — before they become incidents"
      summary={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryMini label="Active signals" value={String(summary.active)} />
          <SummaryMini label="Critical / high" value={String(summary.critical)} />
          <SummaryMini label="Linked incidents" value={String(summary.linkedIncidents)} />
          <SummaryMini label="Systems affected" value={String(summary.systemsAffected)} />
        </div>
      }
    >
      <LiveSignalsFeed
        liveSignals={liveSignals}
        ingestLog={ingestLog}
        simulatorStatus={simulatorStatus}
        governanceSystems={governanceSystems}
        refreshObserve={refreshObserve}
      />
    </GovernancePageShell>
  );
}
