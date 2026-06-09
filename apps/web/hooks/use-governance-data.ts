"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchDashboardSummary,
  fetchEvidence,
  fetchEvidenceLibrary,
  fetchGovernedActions,
  fetchIngestLog,
  fetchLiveSignals,
  fetchNotifications,
  fetchOwnerQueue,
  fetchSimulatorStatus,
  GOVERNANCE_UPDATED_EVENT,
  PRIMARY_OWNER_TEAMS,
  type DashboardSummaryDTO,
  type EvidenceLibraryResponseDTO,
  type EvidenceRecordDTO,
  type GovernedActionDTO,
  type IngestLogResponseDTO,
  type LiveSignalsResponseDTO,
  type NotificationDTO,
  type OwnerQueueResponseDTO,
  type SimulatorStatusDTO
} from "@/lib/governance-api";
import { governanceApiEnabled } from "@/lib/governance-merge";

const POLL_MS = 5000;

export type GovernanceDataState = {
  enabled: boolean;
  loading: boolean;
  liveSignals: LiveSignalsResponseDTO | null;
  ingestLog: IngestLogResponseDTO | null;
  ownerQueues: Record<string, OwnerQueueResponseDTO | null>;
  evidenceByAlias: Record<string, EvidenceRecordDTO | null>;
  dashboard: DashboardSummaryDTO | null;
  actions: GovernedActionDTO[];
  evidenceLibrary: EvidenceLibraryResponseDTO | null;
  notifications: NotificationDTO[];
  simulatorStatus: SimulatorStatusDTO | null;
  refresh: (force?: boolean) => void;
};

export function useGovernanceData(): GovernanceDataState {
  const enabled = governanceApiEnabled();
  const [loading, setLoading] = useState(enabled);
  const [liveSignals, setLiveSignals] = useState<LiveSignalsResponseDTO | null>(null);
  const [ingestLog, setIngestLog] = useState<IngestLogResponseDTO | null>(null);
  const [ownerQueues, setOwnerQueues] = useState<
    Record<string, OwnerQueueResponseDTO | null>
  >({});
  const [evidenceByAlias, setEvidenceByAlias] = useState<
    Record<string, EvidenceRecordDTO | null>
  >({});
  const [dashboard, setDashboard] = useState<DashboardSummaryDTO | null>(null);
  const [actions, setActions] = useState<GovernedActionDTO[]>([]);
  const [evidenceLibrary, setEvidenceLibrary] = useState<EvidenceLibraryResponseDTO | null>(
    null
  );
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [simulatorStatus, setSimulatorStatus] = useState<SimulatorStatusDTO | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async (force = false) => {
    if (!enabled) return;
    if (inFlight.current && !force) return;
    inFlight.current = true;
    try {
      const queueResults = await Promise.all(
        PRIMARY_OWNER_TEAMS.map(async (team) => ({
          team,
          data: await fetchOwnerQueue(team)
        }))
      );
      const queues: Record<string, OwnerQueueResponseDTO | null> = {};
      const aliasIds = new Set<string>();
      for (const { team, data } of queueResults) {
        queues[team] = data;
        for (const row of data?.items ?? []) {
          if (row.alias_id) aliasIds.add(row.alias_id);
        }
      }

      const evidenceEntries = await Promise.all(
        [...aliasIds].map(async (alias) => ({
          alias,
          data: await fetchEvidence(alias)
        }))
      );
      const evidenceMap: Record<string, EvidenceRecordDTO | null> = {};
      for (const { alias, data } of evidenceEntries) {
        evidenceMap[alias] = data;
      }

      const [signals, ingest, dash, actionData, simStatus, library, notifData] = await Promise.all([
        fetchLiveSignals(100),
        fetchIngestLog(100),
        fetchDashboardSummary(),
        fetchGovernedActions(),
        fetchSimulatorStatus(),
        fetchEvidenceLibrary(),
        fetchNotifications(50)
      ]);

      setLiveSignals(signals);
      setIngestLog(ingest);
      setOwnerQueues(queues);
      setEvidenceByAlias(evidenceMap);
      setDashboard(dash);
      setActions(actionData?.items ?? []);
      setEvidenceLibrary(library);
      setNotifications(notifData?.items ?? []);
      setSimulatorStatus(simStatus);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void refresh();
    const pollId = window.setInterval(() => void refresh(), POLL_MS);
    const onUpdated = () => void refresh(true);
    window.addEventListener(GOVERNANCE_UPDATED_EVENT, onUpdated);
    return () => {
      window.clearInterval(pollId);
      window.removeEventListener(GOVERNANCE_UPDATED_EVENT, onUpdated);
    };
  }, [enabled, refresh]);

  return {
    enabled,
    loading,
    liveSignals,
    ingestLog,
    ownerQueues,
    evidenceByAlias,
    dashboard,
    actions,
    evidenceLibrary,
    notifications,
    simulatorStatus,
    refresh
  };
}

/** @deprecated use useGovernanceData */
export { useGovernanceData as useGovernanceSliceA };
