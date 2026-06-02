/**
 * Canonical demo governance graph — re-exports aligned mocks + shared constants.
 */

export {
  GOVERNED_SYSTEMS,
  GOVERNANCE_LOOP,
  DASHBOARD_KPI,
  OWNER_INSIGHTS,
  INCIDENTS_BY_SYSTEM,
  highestRiskOwnerTeam,
  getOwnerTeamDetails,
  ownerPriorityQueueRows,
  ownerActionCopyForTeam,
  decisionPanelCopyForSystem,
  primaryIncidentForPanel,
  DEFAULT_OWNER_TEAM,
  DEFAULT_SYSTEM_ID,
  REMEDIATION_EVIDENCE_SUMMARY,
  formatRiskMixCompact,
  type GovernedSystem,
  type GovernanceIncident,
  type OwnerInsight,
  type OwnerTeamDetails
} from "@/lib/governance-dashboard-mock";

export {
  OWNER_REVIEW_QUEUE_ROWS,
  OWNER_QUEUE_FLEETRAC_ANALYSIS,
  OWNER_QUEUE_RECENT_ACTIVITY,
  allOwnerQueueRows,
  fleetracAnalysisForQueueIncident,
  PRIMARY_OWNER_QUEUE_TEAMS,
  ownerEvidenceLibraryLine,
  OWNER_QUEUE_EVIDENCE_RECORDS,
  findOwnerTeamForQueueIncident,
  isGovernanceQueueIncidentId,
  type OwnerReviewTableRow,
  type QueueTableRow
} from "@/lib/incident-queue-owner-review-mock";

export {
  FLEETRAC_ANALYSIS_BY_INCIDENT,
  fleetracAnalysisForIncident
} from "@/lib/governance-demo-model-analysis";

export {
  TEAM_LIBRARY_ROWS,
  getTeamLibrarySummary,
  INCIDENT_EVIDENCE_DETAILS
} from "@/lib/evidence-library-mock";

export { liveRuntimeSignals, LIVE_SIGNALS_SUMMARY } from "@/lib/live-signals-mock";

export {
  GOVERNED_ACTIONS_CATALOG,
  mergeGovernedActions,
  governedInTab,
  type GovernedAction,
  type GovernedExecutionMode
} from "@/lib/governed-actions-mock";

/** Fleetrac may auto-execute vs always escalate (prototype copy). */
export const FLEETRAC_OPERATING_SCOPE = {
  autoInScope: [
    "Rotate stale agent credentials",
    "Notify owner on P3 drift",
    "Package evidence for known signal templates",
    "Post Slack summary to #ai-governance"
  ],
  approvalRequired: [
    "Threshold and routing changes",
    "Model disablement or traffic reroute",
    "Policy exception approvals",
    "Cross-system blast-radius changes"
  ]
} as const;

export type NotificationEvent = {
  id: string;
  at: string;
  channel: "Slack" | "Email" | "In-app";
  summary: string;
  ownerTeam: string;
  incidentId?: string;
};

export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  {
    id: "n1",
    at: "8m ago",
    channel: "Slack",
    summary: "Owner review requested · #ai-governance · Model Risk Management",
    ownerTeam: "Model Risk Management",
    incidentId: "inc-mrm-001"
  },
  {
    id: "n2",
    at: "4m ago",
    channel: "Slack",
    summary: "Action approval pending · Ticket Routing Agent tool scope",
    ownerTeam: "Security Operations",
    incidentId: "inc-sec-001"
  },
  {
    id: "n3",
    at: "22m ago",
    channel: "In-app",
    summary: "Verification window opened · Platform Reliability queue",
    ownerTeam: "Platform Reliability",
    incidentId: "inc-plat-001"
  }
];
