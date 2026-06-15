/**
 * Shared governance types from API DTOs — no operational mock rows.
 */

export type {
  FleetracAnalysisDTO,
  LiveSignalRowDTO,
  LiveSignalsResponseDTO,
  OwnerQueueRowDTO,
  OwnerQueueResponseDTO,
  EvidenceRecordDTO,
  EvidenceLibraryItemDTO,
  EvidenceLibraryResponseDTO,
  DashboardSummaryDTO,
  NotificationDTO,
  GovernedActionDTO
} from "@/lib/governance-api";

export type {
  LiveRuntimeSignal,
  LiveSignalCategory,
  LiveSignalSeverity,
  LiveSignalsSummary
} from "@/lib/live-signals-types";

export type {
  OwnerReviewTableRow,
  QueueTableRow
} from "@/lib/incident-queue-types";

export type {
  IncidentEvidenceDetail,
  TeamLibraryRow,
  OwnerIncidentRecord
} from "@/lib/evidence-library-types";

export type {
  GovernedSystem,
  OwnerInsight,
  GovernanceLoopStage
} from "@/lib/governance-dashboard-mock";

export type { NotificationEvent } from "@/lib/governance-notification-types";

export {
  governanceApiEnabled,
  findOwnerTeamInQueues
} from "@/lib/governance-merge";

export {
  findOwnerTeamForQueueIncident,
  isGovernanceQueueIncidentId
} from "@/lib/governance-incident-routing";

export {
  SLICE_A_SYSTEM_DISPLAY_ID,
  SLICE_A_INCIDENT_ALIAS,
  SLICE_A_OWNER_TEAM,
  PRIMARY_OWNER_TEAMS
} from "@/lib/governance-api";
