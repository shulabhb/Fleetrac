import type {
  EvidenceLibraryItemDTO,
  EvidenceLibraryResponseDTO,
  EvidenceRecordDTO,
  LiveSignalRowDTO,
  LiveSignalsResponseDTO,
  OwnerQueueRowDTO,
  OwnerQueueResponseDTO
} from "@/lib/governance-api";
import type {
  IncidentEvidenceDetail,
  OwnerIncidentRecord,
  ResolvedArchiveRecord,
  StructuredEvidenceRow,
  TeamLibraryRow
} from "@/lib/evidence-library-types";
import { INCIDENT_LIFECYCLE_ORDER } from "@/lib/evidence-library-types";
import { parseApiTimestamp } from "@/lib/format";
import {
  diagnosisLabelFor,
  type OwnerReviewTableRow,
  type QueueTableRow
} from "@/lib/incident-queue-types";
import type {
  LiveRuntimeSignal,
  LiveSignalCategory,
  LiveSignalSeverity
} from "@/lib/live-signals-types";
import type { LiveSignalsSummary } from "@/lib/live-signals-types";
import { keyMetricLine } from "@/lib/live-signal-display";

export function governanceApiEnabled(): boolean {
  return true;
}

export type GovernanceLiveSignal = LiveRuntimeSignal & {
  governanceSource?: "api";
};

function capitalizeWord(value: string): string {
  if (!value) return value;
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatSignalTimestamp(iso: string): string {
  const then = parseApiTimestamp(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatAgeLabel(iso: string): string {
  const then = parseApiTimestamp(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const days = Math.max(0, Math.floor((Date.now() - then) / 86400000));
  return days === 0 ? "Today" : `${days}d`;
}

function signalCategory(row: LiveSignalRowDTO): LiveSignalCategory {
  const signalType = (row.normalized_signal_type ?? "").toLowerCase();
  if (signalType.includes("unsupported") || signalType.includes("grounding")) {
    return "Grounding";
  }
  if (signalType.includes("tool") || signalType.includes("security")) return "Security";
  if (signalType.includes("latency") || signalType.includes("retrieval")) return "Latency";
  if (signalType.includes("policy")) return "Policy";
  return "Drift";
}

function resolveUiIncidentId(row: LiveSignalRowDTO): string | undefined {
  if (!row.incident_id) return undefined;
  return row.alias_id ?? row.incident_id;
}

function mapSeverity(row: LiveSignalRowDTO): LiveSignalSeverity {
  if (!row.severity || row.signal_state === "healthy") return "Healthy";
  return capitalizeWord(row.severity) as LiveSignalSeverity;
}

export function mapLiveSignalRow(row: LiveSignalRowDTO): GovernanceLiveSignal {
  const uiIncidentId = resolveUiIncidentId(row);
  const severity = mapSeverity(row);
  const signalLabel = row.normalized_signal_type
    ? row.normalized_signal_type.replace(/_/g, " ")
    : row.parent_span_id
      ? "healthy span"
      : "healthy trace";
  return {
    id: row.event_id,
    systemId: row.display_system_id,
    canonicalSystemId: row.system_id,
    systemName: row.system_name_alias ?? row.system_name,
    modelLabel: row.model ?? undefined,
    ownerTeam: row.owner_team ?? "Model Risk Management",
    category: signalCategory(row),
    severity,
    summary: row.model
      ? `${row.model} · ${row.operation_type} · ${signalLabel}`
      : `${row.operation_type} · ${signalLabel}`,
    detectedAt: formatSignalTimestamp(row.timestamp),
    incidentLinked: Boolean(row.incident_id),
    incidentId: uiIncidentId,
    traceId: row.trace_id ?? undefined,
    spanId: row.span_id ?? undefined,
    parentSpanId: row.parent_span_id ?? undefined,
    latencyMs: row.latency_ms ?? undefined,
    signalState: row.signal_state,
    eventType: row.operation_type,
    normalizedSignalType: row.normalized_signal_type,
    keyMetric: keyMetricLine(row.evaluation_signals, row.latency_ms),
    governanceSource: "api"
  };
}

export function isGovernanceVisibleSignal(row: LiveSignalRowDTO): boolean {
  if (row.normalized_signal_type) return true;
  if (row.incident_id) return true;
  if (row.severity) return true;
  if (!row.parent_span_id) return true;
  return false;
}

export function filterGovernedLiveSignals(signals: GovernanceLiveSignal[]): GovernanceLiveSignal[] {
  return signals.filter((s) => {
    if (s.incidentLinked) return true;
    if (s.severity !== "Healthy") return true;
    if (!s.parentSpanId) return true;
    return false;
  });
}

export function buildTraceGroupsForFeed(
  allSignals: GovernanceLiveSignal[],
  governedSignals: GovernanceLiveSignal[]
): { traceId: string; signals: GovernanceLiveSignal[] }[] {
  const traceIds = new Set<string>();
  for (const s of governedSignals) {
    if (s.traceId) traceIds.add(s.traceId);
  }
  return [...traceIds].map((traceId) => ({
    traceId,
    signals: allSignals.filter((s) => s.traceId === traceId)
  }));
}

export function mapLiveSignalsFromApi(
  api: LiveSignalsResponseDTO | null | undefined
): GovernanceLiveSignal[] {
  return (api?.items ?? []).map(mapLiveSignalRow);
}

export function buildLiveSignalsSummaryFromApi(
  api: LiveSignalsResponseDTO | null | undefined
): LiveSignalsSummary {
  const items = api?.items ?? [];
  const critical = items.filter((row) => {
    if (!row.severity) return false;
    const s = row.severity.toLowerCase();
    return s === "critical" || s === "high";
  }).length;
  const linkedIncidents = items.filter((row) => row.incident_id).length;
  const systemsAffected = new Set(items.map((row) => row.display_system_id)).size;
  return {
    active: items.length,
    critical,
    linkedIncidents,
    systemsAffected
  };
}

export function mapApiOwnerQueueRow(
  row: OwnerQueueRowDTO,
  evidenceItemsCount: number
): OwnerReviewTableRow {
  const priority = row.priority as OwnerReviewTableRow["priority"];
  const incidentId = row.alias_id ?? row.id;
  const recommended =
    row.recommended_next_step?.trim() ||
    row.summary.slice(0, 120);
  return {
    incidentId,
    canonicalId: row.id,
    priority: priority === "P1" || priority === "P2" || priority === "P3" ? priority : "P2",
    title: row.title,
    systemId: row.display_system_id,
    systemCanonicalId: row.system_id,
    systemName: row.system_name_alias ?? row.system_name,
    riskCategory: row.classification_category,
    severityLabel: capitalizeWord(row.severity),
    stage: row.lifecycle,
    assignedTo: row.reviewer ?? "—",
    evidenceItemsCount,
    evidenceSyncStatus: "Synced",
    ageLabel: formatAgeLabel(row.opened_at),
    updatedLabel: formatAgeLabel(row.last_seen_at ?? row.updated_at),
    nextAction: "Review risk detail",
    decisionNeeded: row.summary.slice(0, 80),
    recommendedAction: recommended,
    evidenceSummary: row.summary,
    investigationTimeline: "Signal detected → Risk packaged → Review",
    diagnosisFamily: row.diagnosis_family ?? null,
    diagnosisLabel: diagnosisLabelFor(row.diagnosis_family),
    severityReason: row.severity_reason ?? null,
    highestSeverity: row.highest_severity
      ? capitalizeWord(row.highest_severity)
      : null,
    responderTeam: row.responder_team ?? row.owner_team,
    controlId: row.rule_id ?? null,
    controlName: row.control_name ?? null,
    metricName: row.metric_name ?? null,
    thresholdValue: row.threshold_value ?? null,
    thresholdOperator: row.threshold_operator ?? null,
    latestObservedValue: row.latest_observed_value ?? null,
    worstObservedValue: row.worst_observed_value ?? null,
    eventCount: row.occurrence_count ?? null,
    triggerEventId: row.trigger_event_id ?? null,
    lastSeenAt: row.last_seen_at ?? null
  };
}

export function buildOwnerQueueRowsFromApi(
  api: OwnerQueueResponseDTO | null | undefined,
  evidenceByAlias: Record<string, EvidenceRecordDTO | null>,
  ownerTeam: string
): QueueTableRow[] {
  return (api?.items ?? []).map((row) => {
    const incidentId = row.alias_id ?? row.id;
    const count = evidenceByAlias[incidentId]?.items?.length ?? 0;
    return { ...mapApiOwnerQueueRow(row, count), ownerTeam };
  });
}

const SEVERITY_SORT: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3
};

function queueRowPriority(row: QueueTableRow): number {
  const sev = SEVERITY_SORT[row.severityLabel] ?? 9;
  const escalated =
    row.stage === "Action Approval" || row.stage === "Remediation" ? 0 : 1;
  return sev * 10 + escalated;
}

export function buildGlobalOwnerQueueRowsFromApi(
  queues: Record<string, OwnerQueueResponseDTO | null>,
  evidenceByAlias: Record<string, EvidenceRecordDTO | null>
): QueueTableRow[] {
  const rows: QueueTableRow[] = [];
  for (const [team, api] of Object.entries(queues)) {
    for (const row of api?.items ?? []) {
      const incidentId = row.alias_id ?? row.id;
      const count = evidenceByAlias[incidentId]?.items?.length ?? 0;
      rows.push({ ...mapApiOwnerQueueRow(row, count), ownerTeam: team });
    }
  }
  return rows.sort((a, b) => {
    const pr = queueRowPriority(a) - queueRowPriority(b);
    if (pr !== 0) return pr;
    return (b.eventCount ?? 0) - (a.eventCount ?? 0);
  });
}

export function findOwnerTeamInQueues(
  incidentId: string,
  queues: Record<string, OwnerQueueResponseDTO | null>
): string | null {
  for (const [team, q] of Object.entries(queues)) {
    for (const row of q?.items ?? []) {
      if (row.alias_id === incidentId || row.id === incidentId) return team;
    }
  }
  return null;
}

function lifecycleKeyFromStage(stage: string | null | undefined): string {
  const s = (stage ?? "").toLowerCase();
  if (s.includes("closed")) return "closed";
  if (s.includes("verification")) return "verification";
  if (s.includes("remediation")) return "remediation";
  if (s.includes("action")) return "action_approval";
  if (s.includes("owner")) return "owner_review";
  if (s.includes("packaged")) return "packaged";
  return "owner_review";
}

function buildLifecycleFromHistory(
  history: Record<string, unknown>[],
  currentStage: string | null | undefined
): IncidentEvidenceDetail["lifecycleTimestamps"] {
  const reached = new Map<string, string>();
  for (const entry of history) {
    const key = lifecycleKeyFromStage(String(entry.to ?? ""));
    const at = typeof entry.at === "string" ? entry.at : undefined;
    if (!reached.has(key)) reached.set(key, at ?? "");
  }
  const current = lifecycleKeyFromStage(currentStage);
  const currentIdx = INCIDENT_LIFECYCLE_ORDER.indexOf(
    current as (typeof INCIDENT_LIFECYCLE_ORDER)[number]
  );
  const out: IncidentEvidenceDetail["lifecycleTimestamps"] = {};
  INCIDENT_LIFECYCLE_ORDER.forEach((key, i) => {
    const at = reached.get(key);
    if (at) {
      out[key] = {
        label: key.replace(/_/g, " "),
        at: formatSignalTimestamp(at),
        state: i < currentIdx ? "done" : i === currentIdx ? "current" : "done"
      };
      return;
    }
    if (i < currentIdx) {
      out[key] = { label: key.replace(/_/g, " "), state: "done" };
    } else if (i === currentIdx) {
      out[key] = { label: key.replace(/_/g, " "), at: "In progress", state: "current" };
    } else {
      out[key] = { label: key.replace(/_/g, " "), state: "pending" };
    }
  });
  return out;
}

function buildLifecycleFromStage(stage: string | null | undefined) {
  const current = lifecycleKeyFromStage(stage);
  const order = [
    "signal",
    "packaged",
    "owner_notified",
    "owner_review",
    "action_approval",
    "remediation",
    "verification",
    "closed"
  ];
  const idx = order.indexOf(current);
  const out: IncidentEvidenceDetail["lifecycleTimestamps"] = {};
  order.forEach((key, i) => {
    if (i < idx) {
      out[key] = { label: key.replace(/_/g, " "), state: "done" };
    } else if (i === idx) {
      out[key] = { label: key.replace(/_/g, " "), at: "In progress", state: "current" };
    } else {
      out[key] = { label: key.replace(/_/g, " "), state: "pending" };
    }
  });
  return out;
}

export function mapApiEvidenceToDetail(dto: EvidenceRecordDTO): IncidentEvidenceDetail {
  const analysis = dto.fleetrac_analysis;
  const systemName = dto.system_name_alias ?? dto.system_name;
  const incidentId = dto.alias_id ?? dto.incident_id;
  const severity = capitalizeWord(dto.severity ?? "high");
  const ownerTeam = dto.owner_team ?? "—";
  const title = dto.title ?? analysis.summary.slice(0, 80);
  const lifecycle = dto.lifecycle ?? dto.status;
  const structuredEvidence: StructuredEvidenceRow[] = dto.items.map((item) => {
    const traceRef =
      item.trace_id && item.span_id
        ? `trace=${item.trace_id} span=${item.span_id}`
        : item.reference_id;
    return {
      evidenceItem: item.summary,
      source: item.kind,
      signal: traceRef,
      governanceRelevance: item.operation_type ?? item.kind,
      status: dto.status,
      timestamp: formatSignalTimestamp(item.created_at),
      rawLog: {
        id: item.id,
        kind: item.kind,
        reference_id: item.reference_id,
        summary: item.summary,
        created_at: item.created_at,
        trace_id: item.trace_id,
        span_id: item.span_id,
        operation_type: item.operation_type,
        evaluation_signals: item.evaluation_signals
      }
    };
  });

  return {
    id: incidentId,
    title,
    recordSubtitle: `${systemName} · ${dto.classification_category ?? "Governance"} · ${severity} · ${lifecycle}`,
    subtitleParts: [systemName, ownerTeam, dto.classification_category ?? "Governance", severity],
    currentStageKey: lifecycleKeyFromStage(lifecycle),
    assigned: dto.reviewer ?? "—",
    lastUpdated: formatSignalTimestamp(dto.packaged_at),
    evidenceConfidence:
      analysis.confidence >= 0.75 ? "High" : analysis.confidence >= 0.5 ? "Medium" : "Low",
    summary: analysis.summary,
    systemName,
    ownerTeam,
    severity,
    riskCategory: dto.classification_category ?? "Governance",
    teamLead: "—",
    decisionNeeded: "Review remediation path",
    decisionStatus: lifecycle,
    decisionNotes: "No decision recorded yet.",
    recommendedAction: analysis.recommended_actions[0] ?? "",
    expectedImpact: analysis.bounded_scope,
    nextStep: "Send remediation to Action Center.",
    outcomeVerification:
      lifecycle.toLowerCase().includes("closed") ||
      dto.items.some((item) => item.kind === "verification_result")
        ? "complete"
        : "not_started",
    outcomeResult: dto.items.find((item) => item.kind === "verification_result")?.reference_id,
    outcomeReason: dto.items.find((item) => item.kind === "verification_result")?.summary,
    fleetracAnalysis: {
      narrative: analysis.summary,
      rootSignal: analysis.evidence_highlights[0] ?? analysis.summary,
      likelyCause: analysis.bounded_scope,
      governanceImplication: analysis.policy_notes
    },
    structuredEvidence,
    actionHandoffPreview: analysis.recommended_actions,
    lifecycleTimestamps:
      dto.lifecycle_history?.length > 0
        ? buildLifecycleFromHistory(dto.lifecycle_history, lifecycle)
        : buildLifecycleFromStage(lifecycle),
    evidenceItems: dto.items.map((item) => ({
      title: item.summary,
      source: item.kind,
      status: dto.status,
      timestamp: formatSignalTimestamp(item.created_at)
    }))
  };
}

export function isBackendEvidenceIncident(
  incidentId: string,
  evidenceByAlias: Record<string, EvidenceRecordDTO | null>
): boolean {
  return Boolean(evidenceByAlias[incidentId]);
}

export function mapEvidenceLibraryItemToOwnerRecord(
  item: EvidenceLibraryItemDTO
): OwnerIncidentRecord {
  const incidentId = item.alias_id ?? item.incident_id;
  const severity = capitalizeWord(
    item.lifecycle === "Closed" ? "low" : item.title.toLowerCase().includes("critical") ? "critical" : "high"
  );
  return {
    id: incidentId,
    title: item.title,
    systemName: item.system_name_alias ?? item.system_name,
    risk: "Governance",
    severity,
    stage: item.lifecycle,
    assigned: "—",
    evidenceCount: item.evidence_items_count,
    lastUpdated: "Live",
    confidence: "High",
    nextAction: item.verification_summary
      ? `${item.verification_outcome ?? "Verified"} · ${item.verification_summary.slice(0, 80)}`
      : "View record"
  };
}

export function buildTeamLibraryFromApi(
  library: EvidenceLibraryResponseDTO | null | undefined
): TeamLibraryRow[] {
  const byOwner = new Map<string, EvidenceLibraryItemDTO[]>();
  for (const item of library?.items ?? []) {
    const list = byOwner.get(item.owner_team) ?? [];
    list.push(item);
    byOwner.set(item.owner_team, list);
  }
  return [...byOwner.entries()].map(([ownerTeam, items]) => {
    const critical = items.filter((i) =>
      i.title.toLowerCase().includes("critical") || i.lifecycle !== "Closed"
    ).length;
    const bottleneck =
      items.find((i) => i.lifecycle !== "Closed")?.lifecycle ?? "Monitoring";
    return {
      ownerTeam,
      handoff: "Synced",
      activeIncidents: items.filter((i) => i.lifecycle !== "Closed").length,
      critical,
      bottleneck,
      evidenceStatus: "Synced" as const,
      lastUpdated: "Live"
    };
  });
}

export function buildTeamLibrarySummaryFromApi(
  library: EvidenceLibraryResponseDTO | null | undefined
) {
  const rows = buildTeamLibraryFromApi(library);
  const activeIncidentRecords = rows.reduce((s, r) => s + r.activeIncidents, 0);
  const underVerification = (library?.items ?? []).filter((i) =>
    i.lifecycle.toLowerCase().includes("verification")
  ).length;
  const archivedResolved = (library?.items ?? []).filter((i) =>
    i.lifecycle === "Closed"
  ).length;
  return {
    activeOwnerPackages: rows.length,
    activeIncidentRecords,
    awaitingReview: (library?.items ?? []).filter((i) =>
      i.lifecycle.toLowerCase().includes("owner")
    ).length,
    underVerification,
    archivedResolved
  };
}

export function buildLivePackagesFromApi(
  library: EvidenceLibraryResponseDTO | null | undefined
): Record<string, { active: OwnerIncidentRecord[]; resolved: ResolvedArchiveRecord[] }> {
  const out: Record<
    string,
    { active: OwnerIncidentRecord[]; resolved: ResolvedArchiveRecord[] }
  > = {};
  for (const item of library?.items ?? []) {
    const team = item.owner_team;
    if (!out[team]) out[team] = { active: [], resolved: [] };
    const record = mapEvidenceLibraryItemToOwnerRecord(item);
    if (item.lifecycle === "Closed") {
      out[team].resolved.push({
        id: record.id,
        title: record.title,
        systemName: record.systemName,
        outcome: item.verification_outcome ?? "Closed",
        closedAt: "Live",
        evidenceCount: record.evidenceCount,
        verificationResult: item.verification_summary ?? "Verified"
      });
    } else {
      out[team].active.push(record);
    }
  }
  return out;
}

/** @deprecated use isBackendEvidenceIncident */
export function isSliceAEvidenceIncident(incidentId: string): boolean {
  return incidentId === "inc-mrm-001" || incidentId.startsWith("inc_sys-agt-");
}
