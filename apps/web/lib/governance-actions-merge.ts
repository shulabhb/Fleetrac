import type { GovernedActionDTO, EvidenceRecordDTO } from "@/lib/governance-api";
import { formatRelativeTime } from "@/lib/format";
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
  if (normalized === "complete" || normalized.includes("improvement observed")) {
    return "Complete";
  }
  if (
    normalized === "monitoring" ||
    normalized === "awaiting measurement" ||
    normalized.includes("no material change")
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
  const createdMs = dto.created_at ? Date.parse(dto.created_at) : Date.now();
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
    riskLevel: severityToRisk(dto.severity),
    createdAtLabel: dto.created_at
      ? formatRelativeTime(new Date(dto.created_at))
      : "Just now",
    createdAtMs: Number.isFinite(createdMs) ? createdMs : Date.now(),
    governanceSource: "api"
  };
}

export function mapApiActionsToGovernedList(
  apiItems: GovernedActionDTO[],
  evidenceByAlias: Record<string, EvidenceRecordDTO | null> = {}
): GovernedAction[] {
  return apiItems
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
