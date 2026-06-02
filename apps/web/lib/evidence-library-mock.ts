/**
 * Evidence Library demo model — living packages synced with governance incidents (frontend-only).
 */

import { getOwnerTeamDetails, OWNER_INSIGHTS } from "@/lib/governance-dashboard-mock";

export type TeamLibraryRow = {
  ownerTeam: string;
  handoff: string;
  activeIncidents: number;
  critical: number;
  bottleneck: string;
  evidenceStatus: "Synced" | "Needs refresh";
  lastUpdated: string;
};

/** Team library table — aligns with OWNER_INSIGHTS + delivery lines */
export const TEAM_LIBRARY_ROWS: TeamLibraryRow[] = [
  {
    ownerTeam: "Model Risk Management",
    handoff: "Notified",
    activeIncidents: 8,
    critical: 4,
    bottleneck: "Owner Review",
    evidenceStatus: "Synced",
    lastUpdated: "8m ago"
  },
  {
    ownerTeam: "Security Operations",
    handoff: "Notified",
    activeIncidents: 5,
    critical: 3,
    bottleneck: "Action Approval",
    evidenceStatus: "Synced",
    lastUpdated: "4m ago"
  },
  {
    ownerTeam: "Platform Reliability",
    handoff: "Acknowledged",
    activeIncidents: 4,
    critical: 1,
    bottleneck: "Verification",
    evidenceStatus: "Synced",
    lastUpdated: "22m ago"
  },
  {
    ownerTeam: "Responsible AI Review Board",
    handoff: "Pending",
    activeIncidents: 4,
    critical: 1,
    bottleneck: "Evidence Review",
    evidenceStatus: "Needs refresh",
    lastUpdated: "1h ago"
  },
  {
    ownerTeam: "LLM Quality Operations",
    handoff: "Monitoring",
    activeIncidents: 3,
    critical: 0,
    bottleneck: "Monitoring",
    evidenceStatus: "Synced",
    lastUpdated: "34m ago"
  }
];

export type OwnerIncidentRecord = {
  id: string;
  title: string;
  systemName: string;
  risk: string;
  severity: string;
  stage: string;
  assigned: string;
  evidenceCount: number;
  lastUpdated: string;
  confidence: "High" | "Medium" | "Low";
  nextAction: string;
};

export type ResolvedArchiveRecord = {
  id: string;
  title: string;
  systemName: string;
  outcome: string;
  closedAt: string;
  evidenceCount: number;
  verificationResult: string;
};

/** Fleetrac narrative per owner package (concise). */
export const OWNER_FLEETRAC_ANALYSIS: Partial<
  Record<
    string,
    {
      summary: string;
      recommendedOwnerAction: string;
    }
  >
> = {
  "Model Risk Management": {
    summary:
      "Fleetrac detected recurring output reliability risk across three critical systems. The primary bottleneck is owner review. The active package includes evidence for unsupported claims, governance-control exceptions, and groundedness degradation.",
    recommendedOwnerAction:
      "Prioritize unsupported claim remediation and governance-control approval before new model approvals."
  },
  "Security Operations": {
    summary:
      "Fleetrac correlates tool-scope anomalies with elevated cyber signals on ticket routing. Containment actions are queued pending approval.",
    recommendedOwnerAction:
      "Approve containment manifest changes and validate routing policy before expanded rollout."
  },
  "Platform Reliability": {
    summary:
      "Fleetrac shows latency regression concentrated on OCR validation with verification-stage backlog.",
    recommendedOwnerAction:
      "Complete verification on rollback candidate and confirm SLO recovery before clearing the package."
  }
};

/** Active incidents per owner (demo). */
export const OWNER_ACTIVE_INCIDENTS: Partial<
  Record<string, OwnerIncidentRecord[]>
> = {
  "Model Risk Management": [
    {
      id: "inc-mrm-001",
      title: "Unsupported Claim Rate High",
      systemName: "NII Sensitivity",
      risk: "Output Reliability",
      severity: "Critical",
      stage: "Owner Review",
      assigned: "Evan Brooks",
      evidenceCount: 4,
      lastUpdated: "8m ago",
      confidence: "High",
      nextAction: "View record"
    },
    {
      id: "inc-mrm-002",
      title: "Control Exception Requires Approval",
      systemName: "PEP Screening",
      risk: "Governance",
      severity: "Critical",
      stage: "Owner Review",
      assigned: "Maya Chen",
      evidenceCount: 3,
      lastUpdated: "8m ago",
      confidence: "Medium",
      nextAction: "View record"
    },
    {
      id: "inc-mrm-003",
      title: "Groundedness Evidence Review",
      systemName: "Model Risk FAQ",
      risk: "Output Reliability",
      severity: "Critical",
      stage: "Owner Review",
      assigned: "Evan Brooks",
      evidenceCount: 3,
      lastUpdated: "12m ago",
      confidence: "High",
      nextAction: "View record"
    },
    {
      id: "inc-mrm-004",
      title: "Baseline Drift Requires Confirmation",
      systemName: "NII Sensitivity",
      risk: "Technology",
      severity: "High",
      stage: "Packaged",
      assigned: "Evan Brooks",
      evidenceCount: 2,
      lastUpdated: "26m ago",
      confidence: "Medium",
      nextAction: "View record"
    }
  ],
  "Security Operations": [
    {
      id: "inc-sec-001",
      title: "Tool Scope Violation on Refund API",
      systemName: "Ticket Routing Agent",
      risk: "Cyber",
      severity: "Critical",
      stage: "Action Approval",
      assigned: "Nora Patel",
      evidenceCount: 5,
      lastUpdated: "4m ago",
      confidence: "High",
      nextAction: "View record"
    }
  ],
  "Platform Reliability": [
    {
      id: "inc-plat-001",
      title: "Provider Latency Regression",
      systemName: "Invoice OCR Validation",
      risk: "Technology",
      severity: "Critical",
      stage: "Verification",
      assigned: "Daniel Wu",
      evidenceCount: 4,
      lastUpdated: "22m ago",
      confidence: "High",
      nextAction: "View record"
    }
  ]
};

export const OWNER_RESOLVED_ARCHIVE: Partial<
  Record<string, ResolvedArchiveRecord[]>
> = {
  "Model Risk Management": [
    {
      id: "inc-mrm-arch-1",
      title: "Citation Fallback Misfire",
      systemName: "NII Sensitivity",
      outcome: "Closed / no material change",
      closedAt: "3d ago",
      evidenceCount: 5,
      verificationResult: "No recurrence"
    },
    {
      id: "inc-mrm-arch-2",
      title: "Policy Mapping Gap",
      systemName: "PEP Screening",
      outcome: "Verified",
      closedAt: "12d ago",
      evidenceCount: 4,
      verificationResult: "Recurrence reduced"
    }
  ],
  "Security Operations": [
    {
      id: "inc-sec-arch-1",
      title: "Rate Limit Breach",
      systemName: "Ticket Routing Agent",
      outcome: "Closed",
      closedAt: "6d ago",
      evidenceCount: 3,
      verificationResult: "Containment verified"
    }
  ]
};

export const INCIDENT_LIFECYCLE_ORDER = [
  "signal",
  "packaged",
  "owner_notified",
  "owner_review",
  "action_approval",
  "remediation",
  "verification",
  "closed"
] as const;

const DEFAULT_STEP_LABEL: Record<string, string> = {
  signal: "Signal detected",
  packaged: "Incident packaged",
  owner_notified: "Owner notified",
  owner_review: "Owner review",
  action_approval: "Action approval",
  remediation: "Remediation",
  verification: "Verification",
  closed: "Closed / archived"
};

export function lifecycleLabel(key: string): string {
  return DEFAULT_STEP_LABEL[key] ?? key;
}

export type FleetracAnalysisBlock = {
  narrative: string;
  rootSignal: string;
  likelyCause: string;
  governanceImplication: string;
};

export type StructuredEvidenceRow = {
  evidenceItem: string;
  source: string;
  signal: string;
  governanceRelevance: string;
  status: string;
  timestamp: string;
  rawLog: Record<string, unknown>;
};

export type IncidentEvidenceDetail = {
  id: string;
  title: string;
  /** One-line subtitle for header */
  recordSubtitle: string;
  subtitleParts: string[];
  currentStageKey: string;
  assigned: string;
  lastUpdated: string;
  evidenceConfidence: "High" | "Medium" | "Low";
  summary: string;
  systemName: string;
  ownerTeam: string;
  severity: string;
  riskCategory: string;
  teamLead: string;
  decisionNeeded: string;
  decisionStatus: string;
  decisionNotes: string;
  recommendedAction: string;
  expectedImpact: string;
  nextStep: string;
  outcomeVerification: "not_started" | "complete";
  outcomeReason?: string;
  nextMeasurementWindow?: string;
  outcomeResult?: string;
  fleetracAnalysis?: FleetracAnalysisBlock;
  structuredEvidence?: StructuredEvidenceRow[];
  actionHandoffPreview?: string[];
  lifecycleTimestamps: Partial<
    Record<
      string,
      { label: string; at?: string; state: "done" | "current" | "pending" }
    >
  >;
  /** Legacy simple evidence lines — used when structuredEvidence absent */
  evidenceItems: {
    title: string;
    source: string;
    status: string;
    timestamp: string;
  }[];
};

const RAW_LOG_MRM_001_A: Record<string, unknown> = {
  event_id: "evt-mrm-001-a",
  system_id: "M40",
  system_name: "NII Sensitivity",
  source_type: "runtime_evaluation",
  metric: "unsupported_claim_rate",
  observed: 0.084,
  threshold: 0.03,
  severity: "critical",
  trace_id: "tr-93f1",
  timestamp: "2026-05-10T00:31:02Z"
};

export const INCIDENT_EVIDENCE_DETAILS: Partial<Record<string, IncidentEvidenceDetail>> = {
  "inc-mrm-001": {
    id: "inc-mrm-001",
    title: "Unsupported Claim Rate High",
    recordSubtitle: "NII Sensitivity · Output Reliability · Critical · Owner Review",
    subtitleParts: [
      "NII Sensitivity",
      "Model Risk Management",
      "Output Reliability",
      "Critical"
    ],
    currentStageKey: "owner_review",
    assigned: "Evan Brooks",
    lastUpdated: "8m ago",
    evidenceConfidence: "High",
    summary:
      "Unsupported claim rate exceeded threshold while retrieval confidence dropped below the approved baseline.",
    systemName: "NII Sensitivity",
    ownerTeam: "Model Risk Management",
    severity: "Critical",
    riskCategory: "Output Reliability",
    teamLead: "Anika Rao",
    decisionNeeded: "Review unsupported claim remediation",
    decisionStatus: "Awaiting owner review",
    decisionNotes: "No decision recorded yet.",
    recommendedAction: "Raise retrieval threshold and require citation fallback.",
    expectedImpact:
      "Reduce unsupported claim recurrence and improve source-grounding compliance.",
    nextStep: "Send remediation to Action Center.",
    outcomeVerification: "not_started",
    outcomeReason: "Remediation has not been approved yet.",
    nextMeasurementWindow: "After action approval and remediation execution.",
    fleetracAnalysis: {
      narrative:
        "Unsupported claim rate exceeded the approved threshold while retrieval confidence dropped below baseline. The pattern appeared across multiple runs and is linked to missing citation fallback behavior.",
      rootSignal: "Unsupported claims increased above threshold.",
      likelyCause: "Retrieval confidence degradation and missing citation fallback.",
      governanceImplication:
        "Output reliability control requires owner review before remediation can proceed."
    },
    structuredEvidence: [
      {
        evidenceItem: "Unsupported claim rate above threshold",
        source: "Runtime evaluation",
        signal: "claim_rate = 8.4% / threshold 3%",
        governanceRelevance: "Output reliability control breach",
        status: "Confirmed",
        timestamp: "10d ago",
        rawLog: RAW_LOG_MRM_001_A
      },
      {
        evidenceItem: "Retrieval confidence below baseline",
        source: "Retrieval monitor",
        signal: "confidence = 0.62 / baseline 0.78",
        governanceRelevance: "Grounding quality degraded",
        status: "Confirmed",
        timestamp: "10d ago",
        rawLog: {
          event_id: "evt-mrm-001-b",
          system_id: "M40",
          metric: "retrieval_confidence",
          observed: 0.62,
          baseline: 0.78,
          timestamp: "2026-05-10T00:31:02Z"
        }
      },
      {
        evidenceItem: "Citation fallback missing",
        source: "Response audit",
        signal: "fallback = false",
        governanceRelevance: "Required fallback control missing",
        status: "Needs review",
        timestamp: "9d ago",
        rawLog: {
          event_id: "evt-mrm-001-c",
          audit_path: "response_pipeline",
          citation_fallback_enabled: false,
          timestamp: "2026-05-09T14:12:00Z"
        }
      },
      {
        evidenceItem: "Recurrence pattern detected",
        source: "Fleetrac pattern analysis",
        signal: "2 repeats in 10d",
        governanceRelevance: "Recurring issue, not isolated",
        status: "Confirmed",
        timestamp: "8d ago",
        rawLog: {
          pattern_id: "pat-mrm-882",
          window_days: 10,
          recurrence_count: 2,
          timestamp: "2026-05-09T08:00:00Z"
        }
      }
    ],
    actionHandoffPreview: [
      "Increase retrieval confidence threshold to approved baseline",
      "Require citation fallback when confidence drops below threshold",
      "Monitor recurrence for 7 days"
    ],
    lifecycleTimestamps: {
      signal: { label: "Signal detected", at: "10d ago", state: "done" },
      packaged: { label: "Incident packaged", at: "10d ago", state: "done" },
      owner_notified: { label: "Owner notified", at: "8m ago", state: "done" },
      owner_review: { label: "Owner review", at: "In progress", state: "current" },
      action_approval: { label: "Action approval", state: "pending" },
      remediation: { label: "Remediation", state: "pending" },
      verification: { label: "Verification", state: "pending" },
      closed: { label: "Closed / archived", state: "pending" }
    },
    evidenceItems: []
  }
};

export function getTeamLibrarySummary() {
  const teams = TEAM_LIBRARY_ROWS.length;
  const activeIncidentRecords = TEAM_LIBRARY_ROWS.reduce((s, r) => s + r.activeIncidents, 0);
  return {
    activeOwnerPackages: teams,
    activeIncidentRecords,
    awaitingReview: 7,
    underVerification: 3,
    archivedResolved: 12
  };
}

export function riskMixLabel(ownerTeam: string): string {
  const o = OWNER_INSIGHTS.find((x) => x.ownerTeam === ownerTeam);
  if (!o) return "—";
  const parts: string[] = [];
  if (o.riskBreakdown.outputReliability)
    parts.push(`Output Reliability ${o.riskBreakdown.outputReliability}`);
  if (o.riskBreakdown.governance)
    parts.push(`Governance ${o.riskBreakdown.governance}`);
  if (o.riskBreakdown.technology)
    parts.push(`Technology ${o.riskBreakdown.technology}`);
  if (o.riskBreakdown.cyber) parts.push(`Cyber ${o.riskBreakdown.cyber}`);
  return parts.join(" · ");
}

export function packageMetaForOwner(ownerTeam: string) {
  const d = getOwnerTeamDetails(ownerTeam);
  const insight = OWNER_INSIGHTS.find((x) => x.ownerTeam === ownerTeam);
  return {
    teamLead: d.teamLead,
    handoff: `${d.notificationStatus} · ${d.lastNotifiedAt}`,
    reviewers: d.members.join(", "),
    evidenceStatus: "Synced" as const,
    lastUpdated: d.lastNotifiedAt === "—" ? "recently" : d.lastNotifiedAt,
    insight
  };
}
