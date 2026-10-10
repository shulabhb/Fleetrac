import type { GovernedActionDTO, EvidenceRecordDTO } from "@/lib/governance-api";
import { formatRelativeTime, parseApiTimestamp } from "@/lib/format";
import type {
  GovernedAction,
  GovernedActionSource,
  GovernedActionStatus,
  GovernedExecutionMode,
  GovernedVerificationStatus
} from "@/lib/governed-actions-types";

function severityToRisk(severity: string): "low" | "medium" | "high" {
  const s = severity.toLowerCase();
  if (s.includes("critical") || s.includes("high")) return "high";
  if (s.includes("medium")) return "medium";
  return "low";
}

function mapExecutionMode(mode: string): GovernedExecutionMode {
  if (mode === "auto_in_scope") return "auto_in_scope";
  if (mode === "notify_only") return "notify_only";
  return "approval_required";
}

function mapStatus(status: string): GovernedActionStatus {
  if (status === "Approved") return "Approved";
  if (status === "Rejected") return "Rejected";
  if (status === "Executed") return "Executed";
  if (status === "Policy-blocked") return "Policy-blocked";
  if (status === "Monitoring") return "Monitoring";
  if (status === "Closed") return "Closed";
  if (status === "Rollback candidate") return "Rollback candidate";
  return "Awaiting approval";
}

function mapVerificationStatus(status: string): GovernedVerificationStatus {
  const normalized = status.toLowerCase();
  if (
    normalized === "complete" ||
    normalized.includes("improvement") ||
    normalized.includes("rollback") ||
    normalized.includes("regression") ||
    normalized.includes("no material") ||
    normalized.includes("follow")
  ) {
    return "Complete";
  }
  if (
    normalized === "monitoring" ||
    normalized === "awaiting measurement"
  ) {
    return "Awaiting measurement";
  }
  return "Not started";
}

export function mapApiActionToGoverned(
  dto: GovernedActionDTO,
  evidence?: EvidenceRecordDTO | null,
  source: GovernedActionSource = "Incident Queue"
): GovernedAction {
  const incidentId = dto.alias_id ?? dto.incident_id;
  const createdMs = dto.created_at ? parseApiTimestamp(dto.created_at).getTime() : Date.now();
  const analysis =
    evidence?.fleetrac_analysis?.summary ??
    dto.recommended_action ??
    "Fleetrac correlated telemetry, policy signals, and evidence for this incident.";

  return {
    id: dto.id,
    incidentId,
    systemId: dto.system_id ?? dto.system_name,
    incidentTitle: dto.title.replace(/^Remediate — /, ""),
    ownerTeam: dto.owner_team,
    assignedTo: dto.assigned_to ?? "—",
    systemName: dto.system_name,
    riskCategory: dto.risk_category,
    severity: dto.severity,
    source,
    recommendedAction: dto.recommended_action,
    fleetracAnalysisSummary: analysis,
    executionMode: mapExecutionMode(dto.execution_mode),
    status: mapStatus(dto.status),
    verificationStatus: mapVerificationStatus(dto.verification_status),
    rawVerificationStatus: dto.verification_status || "Not started",
    riskLevel: severityToRisk(dto.severity),
    createdAtLabel: dto.created_at ? formatRelativeTime(dto.created_at) : "Just now",
    createdAtMs: Number.isFinite(createdMs) ? createdMs : Date.now(),
    governanceSource: "api",
    expectedMetric: dto.expected_metric ?? null,
    resolutionStatus: dto.resolution_status ?? null,
    resolutionNote: dto.resolution_note ?? null,
    resolutionRecordedAt: dto.resolution_recorded_at ?? null,
    serverStage: dto.current_stage ?? null,
    serverLabel: dto.current_stage_label ?? null,
    serverStep: dto.next_required_step ?? null,
    serverCta: dto.primary_cta ?? null,
    serverDestination: dto.primary_destination ?? null,
    serverClosure: dto.closure_state ?? null
  };
}

function isSupersededAction(dto: GovernedActionDTO): boolean {
  return (
    dto.status === "Superseded" ||
    (dto.verification_status || "").toLowerCase() === "superseded"
  );
}

/** One card per incident: recipe-backed row wins over a legacy duplicate. */
export function primaryApiActions(apiItems: GovernedActionDTO[]): GovernedActionDTO[] {
  const byIncident = new Map<string, GovernedActionDTO>();
  for (const dto of apiItems) {
    if (isSupersededAction(dto)) continue;
    const key = dto.alias_id || dto.incident_id;
    const current = byIncident.get(key);
    if (!current || prefersAction(dto, current)) byIncident.set(key, dto);
  }
  return [...byIncident.values()];
}

function prefersAction(candidate: GovernedActionDTO, current: GovernedActionDTO): boolean {
  const candidateRecipe = Boolean(candidate.expected_metric && candidate.expected_direction);
  const currentRecipe = Boolean(current.expected_metric && current.expected_direction);
  if (candidateRecipe !== currentRecipe) return candidateRecipe;
  const candidateTs = candidate.created_at ? Date.parse(candidate.created_at) : 0;
  const currentTs = current.created_at ? Date.parse(current.created_at) : 0;
  return candidateTs > currentTs;
}

export function mapApiActionsToGovernedList(
  apiItems: GovernedActionDTO[],
  evidenceByAlias: Record<string, EvidenceRecordDTO | null> = {}
): GovernedAction[] {
  return primaryApiActions(apiItems)
    .map((dto) => {
      const alias = dto.alias_id ?? dto.incident_id;
      return mapApiActionToGoverned(dto, evidenceByAlias[alias] ?? null);
    })
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}

/** @deprecated use mapApiActionsToGovernedList */
export function mergeGovernedActionsList(
  apiItems: GovernedActionDTO[],
  _mockMerged: GovernedAction[],
  evidenceByAlias: Record<string, EvidenceRecordDTO | null> = {}
): GovernedAction[] {
  return mapApiActionsToGovernedList(apiItems, evidenceByAlias);
}
