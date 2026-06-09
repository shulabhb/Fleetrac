/**
 * Demo governance dashboard data — executive-first copy and structure.
 * @deprecated Operational arrays are API-off fallbacks only when NEXT_PUBLIC_GOVERNANCE_API=0.
 */

export type SlaRiskLevel = "High" | "Medium" | "Low";

/** Dashboard governance lifecycle step (Observe → … → Measure). */
export type GovernanceLoopStage = "signal" | "packaged" | "review" | "action" | "verified";

/** Notification / queue posture shown on Risk Ownership table (compact). */
export type OwnerNotificationUIFlag = "Notified" | "Acknowledged" | "Pending" | "Monitoring";

/** Accountable owner team — lead, reviewers, delivery handoff (dashboard mock). */
export type OwnerTeamDetails = {
  teamName: string;
  teamLead: string;
  leadRole: string;
  leadEmail: string;
  members: string[];
  notificationStatus: OwnerNotificationUIFlag;
  lastNotifiedAt: string;
  evidencePackStatus: "Generated" | "Sent" | "Not generated";
  pendingAssignments: number;
  evidencePackId: string;
};

export type OwnerInsight = {
  ownerTeam: string;
  open: number;
  critical: number;
  /** Governance decisions awaiting owner attention (dashboard Owner Action Panel). */
  decisionsNeeded: number;
  /** Human-readable bottleneck (Owner Action Panel headline). */
  bottleneck: string;
  /** Oldest evidence age across this owner’s queue (compact summary). */
  oldestEvidenceAge: string;
  /** Aggregate bottleneck stage for this owner team. */
  governanceStage: GovernanceLoopStage;
  /** Compact status line under the governance loop stepper. */
  stageSummary: string;
  riskBreakdown: {
    technology: number;
    outputReliability: number;
    cyber: number;
    governance: number;
  };
  slaRisk: SlaRiskLevel;
  nextAction: string;
};

export type GovernedSystem = {
  id: string;
  name: string;
  type: "Agentic workflow" | "RAG workflow" | "Model workflow";
  platform: string;
  ownerTeam: string;
  businessFunction: string;
  primaryRisk: "Technology Risk" | "Output Reliability" | "Cyber Risk" | "Governance";
  status: "Critical" | "High" | "Medium" | "Low";
  openIncidents: number;
  criticalIncidents: number;
  evidenceAge: string;
  dataSensitivity: "Critical" | "Confidential" | "Internal" | "Public";
  nextAction: string;
  /** Primary incident / system lifecycle stage for the dashboard loop stepper. */
  governanceStage: GovernanceLoopStage;
  stageSummary: string;
};

export type GovernanceIncident = {
  id: string;
  systemId: string;
  title: string;
  status: "Open" | "Pending" | "Escalated" | "Resolved";
  severity: "Critical" | "High" | "Medium" | "Low";
  riskCategory: "Technology Risk" | "Output Reliability" | "Cyber Risk" | "Governance";
  /** Demo-only: accountable owner team (aligns with governed system owner). */
  ownerTeam?: string;
  teamLead?: string;
  assignedMembers?: string[];
  notificationStatus?: "Notified" | "Acknowledged" | "Pending";
  evidencePackId?: string;
  evidencePackStatus?: "Generated" | "Sent" | "Not generated";
  lastNotifiedAt?: string;
  actionState:
    | "Review required"
    | "Escalated"
    | "Awaiting approval"
    | "Under monitoring"
    | "Monitor";
  age: string;
  recommendedAction: string;
  evidenceCount: number;
};

/** Primary governance decision surfaced in the Dashboard Decision Panel. */
export type DecisionPanelCopy = {
  headline: string;
  context: string;
  recommendedAction: string;
  /** e.g. "4 evidence items · 2 recurring signals · 10d oldest" */
  evidenceSummary: string;
};

export const DASHBOARD_KPI = {
  governedSystems: 10,
  governedSystemsSub: "10 agentic workflows · multi-cloud telemetry",
  activeIncidents: 24,
  activeIncidentsSub: "<30d 18 · 30–60d 5 · >60d 1",
  criticalDecisions: 7,
  criticalDecisionsSub: "Human approval required",
  ownersAboveTolerance: 3,
  ownersAboveToleranceSub: "MRM · Security Ops · Platform Reliability",
  remediationVerified: 14,
  remediationVerifiedSub: "Last 30 days"
} as const;

export const OWNER_INSIGHTS: OwnerInsight[] = [
  {
    ownerTeam: "Model Risk Management",
    open: 8,
    critical: 4,
    decisionsNeeded: 3,
    bottleneck: "Owner Review",
    oldestEvidenceAge: "10d",
    governanceStage: "review",
    stageSummary: "3 items waiting in owner review",
    riskBreakdown: {
      technology: 1,
      outputReliability: 4,
      cyber: 0,
      governance: 3
    },
    slaRisk: "High",
    nextAction: "Review queue"
  },
  {
    ownerTeam: "Security Operations",
    open: 5,
    critical: 3,
    decisionsNeeded: 2,
    bottleneck: "Action Approval",
    oldestEvidenceAge: "1d",
    governanceStage: "action",
    stageSummary: "2 containment actions awaiting approval",
    riskBreakdown: {
      technology: 0,
      outputReliability: 0,
      cyber: 5,
      governance: 0
    },
    slaRisk: "High",
    nextAction: "Approve containment"
  },
  {
    ownerTeam: "Platform Reliability",
    open: 4,
    critical: 1,
    decisionsNeeded: 1,
    bottleneck: "Verification",
    oldestEvidenceAge: "2d",
    governanceStage: "verified",
    stageSummary: "1 rollback candidate under verification",
    riskBreakdown: {
      technology: 4,
      outputReliability: 0,
      cyber: 0,
      governance: 0
    },
    slaRisk: "Medium",
    nextAction: "Verify rollback"
  },
  {
    ownerTeam: "Responsible AI Review Board",
    open: 4,
    critical: 1,
    decisionsNeeded: 2,
    bottleneck: "Evidence Review",
    oldestEvidenceAge: "5d",
    governanceStage: "review",
    stageSummary: "Governance sign-offs pending on SAR narratives",
    riskBreakdown: {
      technology: 0,
      outputReliability: 2,
      cyber: 0,
      governance: 2
    },
    slaRisk: "Medium",
    nextAction: "Review evidence"
  },
  {
    ownerTeam: "LLM Quality Operations",
    open: 3,
    critical: 0,
    decisionsNeeded: 1,
    bottleneck: "Monitoring",
    oldestEvidenceAge: "3d",
    governanceStage: "packaged",
    stageSummary: "Fairness drift signals packaged · owner triage next",
    riskBreakdown: {
      technology: 1,
      outputReliability: 2,
      cyber: 0,
      governance: 0
    },
    slaRisk: "Low",
    nextAction: "Monitor trend"
  }
];

/** Mock roster + delivery state per accountable owner team. */
export const OWNER_TEAM_DETAILS: Record<string, OwnerTeamDetails> = {
  "Model Risk Management": {
    teamName: "Model Risk Management",
    teamLead: "Anika Rao",
    leadRole: "Model Risk Lead",
    leadEmail: "anika.rao@company.com",
    members: ["Evan Brooks", "Maya Chen"],
    notificationStatus: "Notified",
    lastNotifiedAt: "8m ago",
    evidencePackStatus: "Generated",
    pendingAssignments: 3,
    evidencePackId: "ep-mrm-2026-05"
  },
  "Security Operations": {
    teamName: "Security Operations",
    teamLead: "Marcus Lee",
    leadRole: "Security Operations Lead",
    leadEmail: "marcus.lee@company.com",
    members: ["Nora Patel", "James Kim"],
    notificationStatus: "Notified",
    lastNotifiedAt: "4m ago",
    evidencePackStatus: "Sent",
    pendingAssignments: 2,
    evidencePackId: "ep-sec-2026-05"
  },
  "Platform Reliability": {
    teamName: "Platform Reliability",
    teamLead: "Sofia Martinez",
    leadRole: "Platform Reliability Manager",
    leadEmail: "sofia.martinez@company.com",
    members: ["Daniel Wu", "Priya Shah"],
    notificationStatus: "Acknowledged",
    lastNotifiedAt: "22m ago",
    evidencePackStatus: "Generated",
    pendingAssignments: 1,
    evidencePackId: "ep-plat-2026-05"
  },
  "Responsible AI Review Board": {
    teamName: "Responsible AI Review Board",
    teamLead: "Jordan Ellis",
    leadRole: "Responsible AI Chair",
    leadEmail: "jordan.ellis@company.com",
    members: ["Amit Desai", "Claire Ogden"],
    notificationStatus: "Pending",
    lastNotifiedAt: "—",
    evidencePackStatus: "Generated",
    pendingAssignments: 2,
    evidencePackId: "ep-rarb-2026-05"
  },
  "LLM Quality Operations": {
    teamName: "LLM Quality Operations",
    teamLead: "Priya Nair",
    leadRole: "LLM Quality Lead",
    leadEmail: "priya.nair@company.com",
    members: ["Chris Ortiz", "Sam Okonkwo"],
    notificationStatus: "Monitoring",
    lastNotifiedAt: "1h ago",
    evidencePackStatus: "Generated",
    pendingAssignments: 1,
    evidencePackId: "ep-llm-2026-05"
  }
};

export function getOwnerTeamDetails(teamName: string): OwnerTeamDetails {
  return (
    OWNER_TEAM_DETAILS[teamName] ?? {
      teamName,
      teamLead: "—",
      leadRole: "Owner",
      leadEmail: "",
      members: [],
      notificationStatus: "Pending",
      lastNotifiedAt: "—",
      evidencePackStatus: "Not generated",
      pendingAssignments: 0,
      evidencePackId: "ep-unknown"
    }
  );
}

/** One-line delivery summary for the governance loop panel. */
export function ownerDeliveryLine(details: OwnerTeamDetails): string {
  if (details.evidencePackStatus === "Not generated") {
    return "Evidence pack not generated yet";
  }
  const t = details.lastNotifiedAt === "—" ? "" : ` ${details.lastNotifiedAt}`;
  return `Evidence pack sent to ${details.teamLead}${t}`.trim();
}

/** Short delivery line for compact owner panel (time-forward). */
export function ownerDeliveryLineCompact(details: OwnerTeamDetails): string {
  if (details.evidencePackStatus === "Not generated") {
    return "Evidence pack not generated";
  }
  if (details.lastNotifiedAt === "—") return "Evidence pack ready";
  return `Evidence pack sent ${details.lastNotifiedAt}`;
}

export const GOVERNED_SYSTEMS: GovernedSystem[] = [
  {
    id: "M40",
    name: "NII Sensitivity",
    type: "Agentic workflow",
    platform: "Azure OpenAI",
    ownerTeam: "Model Risk Management",
    businessFunction: "Markets & Treasury",
    primaryRisk: "Output Reliability",
    status: "Critical",
    openIncidents: 4,
    criticalIncidents: 3,
    evidenceAge: "10d",
    dataSensitivity: "Critical",
    nextAction: "Review",
    governanceStage: "review",
    stageSummary: "Current stage: Owner review · awaiting remediation approval"
  },
  {
    id: "M44",
    name: "Invoice OCR Validation",
    type: "RAG workflow",
    platform: "AWS Bedrock",
    ownerTeam: "Platform Reliability",
    businessFunction: "Operations",
    primaryRisk: "Technology Risk",
    status: "Critical",
    openIncidents: 4,
    criticalIncidents: 2,
    evidenceAge: "10d",
    dataSensitivity: "Confidential",
    nextAction: "Verify",
    governanceStage: "verified",
    stageSummary: "Current stage: Verification · measuring recurrence reduction"
  },
  {
    id: "M46",
    name: "Model Risk FAQ",
    type: "RAG workflow",
    platform: "Azure OpenAI",
    ownerTeam: "Model Risk Management",
    businessFunction: "Risk",
    primaryRisk: "Output Reliability",
    status: "Critical",
    openIncidents: 4,
    criticalIncidents: 1,
    evidenceAge: "10d",
    dataSensitivity: "Internal",
    nextAction: "Review",
    governanceStage: "review",
    stageSummary: "Current stage: Owner review · groundedness evidence pending"
  },
  {
    id: "M50",
    name: "PEP Screening",
    type: "Agentic workflow",
    platform: "AWS Bedrock",
    ownerTeam: "Model Risk Management",
    businessFunction: "Compliance",
    primaryRisk: "Governance",
    status: "Critical",
    openIncidents: 2,
    criticalIncidents: 2,
    evidenceAge: "10d",
    dataSensitivity: "Critical",
    nextAction: "Approve",
    governanceStage: "action",
    stageSummary: "Current stage: Action approval · control exception queue"
  },
  {
    id: "A12",
    name: "Ticket Routing Agent",
    type: "Agentic workflow",
    platform: "LangGraph / OTel",
    ownerTeam: "Security Operations",
    businessFunction: "Security",
    primaryRisk: "Cyber Risk",
    status: "Critical",
    openIncidents: 3,
    criticalIncidents: 1,
    evidenceAge: "2d",
    dataSensitivity: "Confidential",
    nextAction: "Contain",
    governanceStage: "action",
    stageSummary: "Current stage: Action approval · containment pending"
  },
  {
    id: "A18",
    name: "Collections Prioritization",
    type: "Agentic workflow",
    platform: "OpenTelemetry",
    ownerTeam: "LLM Quality Operations",
    businessFunction: "Collections",
    primaryRisk: "Output Reliability",
    status: "High",
    openIncidents: 2,
    criticalIncidents: 1,
    evidenceAge: "3d",
    dataSensitivity: "Internal",
    nextAction: "Monitor",
    governanceStage: "review",
    stageSummary: "Current stage: Owner review · fairness drift investigation"
  },
  {
    id: "S08",
    name: "Phishing Triage Agent",
    type: "Agentic workflow",
    platform: "AWS Bedrock",
    ownerTeam: "Security Operations",
    businessFunction: "SOC",
    primaryRisk: "Cyber Risk",
    status: "High",
    openIncidents: 2,
    criticalIncidents: 1,
    evidenceAge: "2d",
    dataSensitivity: "Confidential",
    nextAction: "Review",
    governanceStage: "packaged",
    stageSummary: "Current stage: Packaging · SOC enrichment incidents queued"
  },
  {
    id: "C21",
    name: "SAR Narrative Assistant",
    type: "RAG workflow",
    platform: "Azure OpenAI",
    ownerTeam: "Responsible AI Review Board",
    businessFunction: "AML",
    primaryRisk: "Governance",
    status: "High",
    openIncidents: 2,
    criticalIncidents: 1,
    evidenceAge: "5d",
    dataSensitivity: "Critical",
    nextAction: "Review evidence",
    governanceStage: "review",
    stageSummary: "Current stage: Owner review · dual-sign narrative queue"
  }
];

/** Wireframe order: primary decision ties to unsupported-claim incident first. */
export const INCIDENTS_M40: GovernanceIncident[] = [
  {
    id: "inc-m40-3",
    systemId: "M40",
    title: "Unsupported Claim Rate High on M40",
    status: "Pending",
    severity: "High",
    riskCategory: "Output Reliability",
    actionState: "Review required",
    age: "10d",
    recommendedAction: "Raise retrieval threshold and require citation fallback.",
    evidenceCount: 5,
    ownerTeam: "Model Risk Management",
    teamLead: "Anika Rao",
    assignedMembers: ["Evan Brooks", "Maya Chen"],
    notificationStatus: "Notified",
    evidencePackId: "ep-mrm-2026-05",
    evidencePackStatus: "Generated",
    lastNotifiedAt: "8m ago"
  },
  {
    id: "inc-m40-2",
    systemId: "M40",
    title: "Drift Too High on M40",
    status: "Pending",
    severity: "High",
    riskCategory: "Technology Risk",
    actionState: "Review required",
    age: "10d",
    recommendedAction: "Compare current behavior against approved baseline.",
    evidenceCount: 4
  },
  {
    id: "inc-m40-1",
    systemId: "M40",
    title: "Security Anomaly Count Above Zero on M40",
    status: "Open",
    severity: "High",
    riskCategory: "Cyber Risk",
    actionState: "Escalated",
    age: "10d",
    recommendedAction:
      "Review access anomaly and confirm whether containment is required.",
    evidenceCount: 6
  },
  {
    id: "inc-m40-4",
    systemId: "M40",
    title: "Latency Too High on M40",
    status: "Pending",
    severity: "Medium",
    riskCategory: "Technology Risk",
    actionState: "Review required",
    age: "10d",
    recommendedAction: "Check provider latency and fallback routing.",
    evidenceCount: 3
  }
];

const INCIDENTS_M44: GovernanceIncident[] = [
  {
    id: "inc-m44-1",
    systemId: "M44",
    title: "OCR Confidence Below Floor on M44",
    status: "Pending",
    severity: "High",
    riskCategory: "Technology Risk",
    actionState: "Review required",
    age: "10d",
    recommendedAction: "Retune OCR pipeline and validate ground-truth samples.",
    evidenceCount: 4
  },
  {
    id: "inc-m44-2",
    systemId: "M44",
    title: "Latency Spike on Batch Validation",
    status: "Open",
    severity: "Medium",
    riskCategory: "Technology Risk",
    actionState: "Review required",
    age: "10d",
    recommendedAction: "Scale batch workers and review timeout policy.",
    evidenceCount: 2
  },
  {
    id: "inc-m44-3",
    systemId: "M44",
    title: "Schema Drift vs Approved Taxonomy",
    status: "Pending",
    severity: "High",
    riskCategory: "Technology Risk",
    actionState: "Escalated",
    age: "9d",
    recommendedAction: "Freeze schema changes until governance sign-off.",
    evidenceCount: 3
  },
  {
    id: "inc-m44-4",
    systemId: "M44",
    title: "Retry Storm on Downstream API",
    status: "Open",
    severity: "Medium",
    riskCategory: "Technology Risk",
    actionState: "Review required",
    age: "8d",
    recommendedAction: "Back off retries and add circuit breaker.",
    evidenceCount: 2
  }
];

const INCIDENTS_M46: GovernanceIncident[] = [
  {
    id: "inc-m46-1",
    systemId: "M46",
    title: "Unsupported Claim Rate Elevated on FAQ",
    status: "Pending",
    severity: "High",
    riskCategory: "Output Reliability",
    actionState: "Review required",
    age: "10d",
    recommendedAction: "Tighten citation rules for regulated answers.",
    evidenceCount: 4
  },
  {
    id: "inc-m46-2",
    systemId: "M46",
    title: "Retrieval Miss Rate Above Baseline",
    status: "Pending",
    severity: "Medium",
    riskCategory: "Output Reliability",
    actionState: "Review required",
    age: "10d",
    recommendedAction: "Refresh corpus index for policy topics.",
    evidenceCount: 3
  },
  {
    id: "inc-m46-3",
    systemId: "M46",
    title: "Policy Topic Coverage Gap",
    status: "Open",
    severity: "Medium",
    riskCategory: "Governance",
    actionState: "Review required",
    age: "9d",
    recommendedAction: "Expand reviewed topic map with Risk sign-off.",
    evidenceCount: 2
  },
  {
    id: "inc-m46-4",
    systemId: "M46",
    title: "Human Review Queue Backlog",
    status: "Pending",
    severity: "Low",
    riskCategory: "Governance",
    actionState: "Review required",
    age: "7d",
    recommendedAction: "Add reviewer capacity for peak windows.",
    evidenceCount: 1
  }
];

const INCIDENTS_M50: GovernanceIncident[] = [
  {
    id: "inc-m50-1",
    systemId: "M50",
    title: "PEP Match Escalation Threshold Breach",
    status: "Open",
    severity: "High",
    riskCategory: "Governance",
    actionState: "Awaiting approval",
    age: "10d",
    recommendedAction: "Approve escalated review workflow for PEP tier.",
    evidenceCount: 5
  },
  {
    id: "inc-m50-2",
    systemId: "M50",
    title: "Audit Trail Gap on Negative Screen",
    status: "Pending",
    severity: "High",
    riskCategory: "Governance",
    actionState: "Review required",
    age: "10d",
    recommendedAction: "Patch logging to capture full decision rationale.",
    evidenceCount: 4
  }
];

const INCIDENTS_A12: GovernanceIncident[] = [
  {
    id: "inc-a12-1",
    systemId: "A12",
    title: "Tool Scope Violation on Refund API",
    status: "Pending",
    severity: "Critical",
    riskCategory: "Cyber Risk",
    actionState: "Awaiting approval",
    age: "1d",
    recommendedAction: "Require human approval for refund tool calls above threshold.",
    evidenceCount: 5
  },
  {
    id: "inc-a12-2",
    systemId: "A12",
    title: "Prompt Injection Attempt Detected",
    status: "Open",
    severity: "High",
    riskCategory: "Cyber Risk",
    actionState: "Review required",
    age: "1d",
    recommendedAction: "Confirm guardrail trigger and preserve trace evidence.",
    evidenceCount: 3
  },
  {
    id: "inc-a12-3",
    systemId: "A12",
    title: "Excessive Tool Retry Pattern",
    status: "Pending",
    severity: "Medium",
    riskCategory: "Technology Risk",
    actionState: "Monitor",
    age: "2d",
    recommendedAction: "Review retry policy and fallback behavior.",
    evidenceCount: 2
  }
];

const INCIDENTS_A18: GovernanceIncident[] = [
  {
    id: "inc-a18-1",
    systemId: "A18",
    title: "Ranking Fairness Drift on Collections",
    status: "Pending",
    severity: "High",
    riskCategory: "Output Reliability",
    actionState: "Review required",
    age: "3d",
    recommendedAction: "Recalibrate fairness constraints with audit sample.",
    evidenceCount: 3
  },
  {
    id: "inc-a18-2",
    systemId: "A18",
    title: "Explainability Coverage Below Policy",
    status: "Open",
    severity: "Medium",
    riskCategory: "Governance",
    actionState: "Review required",
    age: "2d",
    recommendedAction: "Expand rationale templates for regulated outcomes.",
    evidenceCount: 2
  }
];

const INCIDENTS_S08: GovernanceIncident[] = [
  {
    id: "inc-s08-1",
    systemId: "S08",
    title: "SOC Enrichment Latency Above SLO",
    status: "Pending",
    severity: "High",
    riskCategory: "Cyber Risk",
    actionState: "Review required",
    age: "2d",
    recommendedAction: "Scale enrichment workers and cache benign verdicts.",
    evidenceCount: 3
  },
  {
    id: "inc-s08-2",
    systemId: "S08",
    title: "False Negative Spike on Phishing Classifier",
    status: "Open",
    severity: "Medium",
    riskCategory: "Technology Risk",
    actionState: "Review required",
    age: "1d",
    recommendedAction: "Roll back model bundle and compare confusion matrix.",
    evidenceCount: 2
  }
];

const INCIDENTS_C21: GovernanceIncident[] = [
  {
    id: "inc-c21-1",
    systemId: "C21",
    title: "SAR Narrative Length Outside Policy Band",
    status: "Pending",
    severity: "High",
    riskCategory: "Governance",
    actionState: "Awaiting approval",
    age: "5d",
    recommendedAction: "Route narratives through secondary reviewer queue.",
    evidenceCount: 4
  },
  {
    id: "inc-c21-2",
    systemId: "C21",
    title: "PII Token Leak Risk in Draft Surface",
    status: "Open",
    severity: "High",
    riskCategory: "Governance",
    actionState: "Review required",
    age: "4d",
    recommendedAction: "Mask drafts until scrubber passes.",
    evidenceCount: 3
  }
];

/** Primary decision copy per system for the Decision Panel. */
export const DECISION_PANEL_COPY: Record<string, DecisionPanelCopy> = {
  M40: {
    headline: "Review unsupported claim remediation",
    context: "Claim risk is above threshold and retrieval confidence is below baseline.",
    recommendedAction: "Raise retrieval threshold and require citation fallback.",
    evidenceSummary: "4 evidence items · 2 recurring signals · 10d oldest"
  },
  M44: {
    headline: "Stabilize OCR validation path",
    context: "Confidence and latency breaches are concentrated on the Bedrock path.",
    recommendedAction: "Retune OCR pipeline and validate ground-truth samples.",
    evidenceSummary: "4 evidence items · 1 recurring signal · 10d oldest"
  },
  M46: {
    headline: "Tighten FAQ grounding for regulated answers",
    context: "Unsupported claims and retrieval misses moved together this window.",
    recommendedAction: "Tighten citation rules for regulated answers.",
    evidenceSummary: "3 evidence items · 1 recurring signal · 10d oldest"
  },
  M50: {
    headline: "Approve PEP escalation governance path",
    context: "PEP tier breaches require explicit approval before automated routing.",
    recommendedAction: "Approve escalated review workflow for PEP tier.",
    evidenceSummary: "5 evidence items · 1 recurring signal · 10d oldest"
  },
  A12: {
    headline: "Approve refund tool scope",
    context: "Critical-path tool calls exceeded approved refund envelope.",
    recommendedAction: "Require human approval for refund tool calls above threshold.",
    evidenceSummary: "5 evidence items · 2 recurring signals · 2d oldest"
  },
  A18: {
    headline: "Recalibrate collections prioritization guardrails",
    context: "Fairness drift observed relative to the approved monitoring band.",
    recommendedAction: "Recalibrate fairness constraints with audit sample.",
    evidenceSummary: "3 evidence items · 1 recurring signal · 3d oldest"
  },
  S08: {
    headline: "Restore phishing triage SLO",
    context: "Latency and classifier quality diverged from the SOC baseline.",
    recommendedAction: "Scale enrichment workers and validate classifier bundle.",
    evidenceSummary: "3 evidence items · 1 recurring signal · 2d oldest"
  },
  C21: {
    headline: "Human review for SAR narrative drafts",
    context: "Narrative controls require dual review before filing.",
    recommendedAction: "Route narratives through secondary reviewer queue.",
    evidenceSummary: "4 evidence items · 1 recurring signal · 5d oldest"
  }
};

export function decisionPanelCopyForSystem(systemId: string): DecisionPanelCopy {
  return (
    DECISION_PANEL_COPY[systemId] ?? {
      headline: "Review open governance incidents",
      context: "Packaged evidence shows variance from approved operating bounds.",
      recommendedAction: "Route through Action Center with human approval.",
      evidenceSummary: "Evidence summary pending packaging"
    }
  );
}

function parseEvidenceAgeDays(s: string): number {
  const m = String(s).match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function incidentScore(i: GovernanceIncident): number {
  const sev = { Critical: 4, High: 3, Medium: 2, Low: 1 }[i.severity];
  const esc = i.actionState === "Escalated" ? 50 : 0;
  return esc + sev * 10 + parseEvidenceAgeDays(i.age);
}

/** Highest-severity / highest-score incident for “review top risk” flows. */
export function pickHighestIncident(incidents: GovernanceIncident[]): GovernanceIncident | null {
  if (!incidents.length) return null;
  return [...incidents].sort((a, b) => incidentScore(b) - incidentScore(a))[0];
}

/** Incident that should drive the Decision Panel primary CTA (aligns with packaged decision copy). */
const PRIMARY_INCIDENT_ID_BY_SYSTEM: Partial<Record<string, string>> = {
  M40: "inc-m40-3",
  M44: "inc-m44-1",
  M46: "inc-m46-1",
  M50: "inc-m50-1",
  A12: "inc-a12-1",
  A18: "inc-a18-1",
  S08: "inc-s08-1",
  C21: "inc-c21-1"
};

export function primaryIncidentForPanel(
  systemId: string,
  incidents: GovernanceIncident[]
): GovernanceIncident | null {
  if (!incidents.length) return null;
  const preferId = PRIMARY_INCIDENT_ID_BY_SYSTEM[systemId];
  if (preferId) {
    const found = incidents.find((i) => i.id === preferId);
    if (found) return found;
  }
  return pickHighestIncident(incidents);
}

export const INCIDENTS_BY_SYSTEM: Record<string, GovernanceIncident[]> = {
  M40: INCIDENTS_M40,
  M44: INCIDENTS_M44,
  M46: INCIDENTS_M46,
  M50: INCIDENTS_M50,
  A12: INCIDENTS_A12,
  A18: INCIDENTS_A18,
  S08: INCIDENTS_S08,
  C21: INCIDENTS_C21
};

export const GOVERNANCE_LOOP = {
  investigations: {
    open: 34,
    awaitingApproval: 27,
    pendingRecommendations: 36,
    recurring: 12
  },
  verification: {
    recurrenceReduced: 14,
    improvement: 3,
    followUp: 6,
    rollback: 1
  }
} as const;

export const REMEDIATION_EVIDENCE_SUMMARY = {
  underMonitoring: 2,
  improvementObserved: 3,
  followUpRequired: 6,
  rollbackCandidates: 1,
  closedNoMaterial: 12,
  footer: "30-day window · 9 evidence packs · reviewer load −30% vs prior period"
} as const;

/** Owner Action Panel primary copy (dashboard owner pivot). */
export type OwnerActionPanelCopy = {
  headline: string;
  context: string;
  recommendedAction: string;
  evidenceSummary: string;
};

/** Compressed risk category counts for Risk Ownership table (new “Risk mix” column). */
export function formatRiskMix(insight: OwnerInsight): string {
  type Key = keyof OwnerInsight["riskBreakdown"];
  const label: Record<Key, string> = {
    outputReliability: "Output Reliability",
    governance: "Governance",
    cyber: "Cyber",
    technology: "Technology"
  };
  const pairs = (
    [
      ["outputReliability", insight.riskBreakdown.outputReliability],
      ["governance", insight.riskBreakdown.governance],
      ["cyber", insight.riskBreakdown.cyber],
      ["technology", insight.riskBreakdown.technology]
    ] as [Key, number][]
  )
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  return pairs.map(([k, n]) => `${label[k]} ${n}`).join(" · ");
}

/** Abbreviated risk mix for dense dashboard tables. */
export function formatRiskMixCompact(insight: OwnerInsight): string {
  type Key = keyof OwnerInsight["riskBreakdown"];
  const label: Record<Key, string> = {
    outputReliability: "Out",
    governance: "Gov",
    cyber: "Cyber",
    technology: "Tech"
  };
  const pairs = (
    [
      ["outputReliability", insight.riskBreakdown.outputReliability],
      ["governance", insight.riskBreakdown.governance],
      ["cyber", insight.riskBreakdown.cyber],
      ["technology", insight.riskBreakdown.technology]
    ] as [Key, number][]
  )
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  return pairs.map(([k, n]) => `${label[k]} ${n}`).join(" · ");
}

/** Two highest-weight risk categories for an owner row (executive line). */
export function primaryRiskConcentrationLabel(insight: OwnerInsight): string {
  const entries: [string, number][] = [
    ["Technology Risk", insight.riskBreakdown.technology],
    ["Output Reliability", insight.riskBreakdown.outputReliability],
    ["Cyber Risk", insight.riskBreakdown.cyber],
    ["Governance", insight.riskBreakdown.governance]
  ];
  const nonzero = entries.filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  return nonzero
    .slice(0, 2)
    .map(([label]) => label)
    .join(" + ");
}

const OWNER_ACTION_COPY: Record<string, OwnerActionPanelCopy> = {
  "Model Risk Management": {
    headline: "Review 3 high-priority incidents",
    context: "Blocking remediation for three critical systems.",
    recommendedAction: "Prioritize unsupported claim and governance-control reviews.",
    evidenceSummary: "8 open incidents · 4 critical · oldest 10d"
  },
  "Security Operations": {
    headline: "Approve containment for elevated cyber incidents",
    context: "Cyber incidents concentrated on SOC and ticket automation paths.",
    recommendedAction: "Contain high-severity paths; approve guardrail changes before rollout.",
    evidenceSummary: "5 open incidents · 3 critical · oldest 2d"
  },
  "Platform Reliability": {
    headline: "Verify rollback readiness on Bedrock workloads",
    context: "Technology risk clusters on OCR validation and downstream dependencies.",
    recommendedAction: "Validate rollback scripts and timeouts before peak batch windows.",
    evidenceSummary: "4 open incidents · 1 critical · oldest 10d"
  },
  "Responsible AI Review Board": {
    headline: "Review dual-sign-off evidence for AML drafts",
    context: "Governance load on SAR narratives and sensitive drafts.",
    recommendedAction: "Prioritize narrative scrubbing and reviewer coverage for AML filings.",
    evidenceSummary: "4 open incidents · 1 critical · oldest 5d"
  },
  "LLM Quality Operations": {
    headline: "Recalibrate fairness monitoring samples",
    context: "Output reliability concentrated on collections prioritization.",
    recommendedAction: "Align fairness audits with the latest production cohort.",
    evidenceSummary: "3 open incidents · 0 critical · oldest 3d"
  }
};

export function ownerActionCopyForTeam(
  ownerTeam: string,
  insight: OwnerInsight
): OwnerActionPanelCopy {
  return (
    OWNER_ACTION_COPY[ownerTeam] ?? {
      headline: `Review ${insight.decisionsNeeded} queued governance decisions`,
      context: `Risk is elevated across ${insight.open} open incidents under this owner.`,
      recommendedAction: "Route highest-severity items through Action Center with human approval.",
      evidenceSummary: `${insight.open} open incidents · ${insight.critical} critical · review SLA`
    }
  );
}

export type OwnerPriorityQueueRow = {
  systemId: string;
  decisionLine: string;
  /** Primary reviewer assignment (demo). */
  assignedMember?: string;
};

const OWNER_PRIORITY_PRESET: Partial<Record<string, OwnerPriorityQueueRow[]>> = {
  "Model Risk Management": [
    {
      systemId: "M40",
      decisionLine: "Review unsupported claim remediation",
      assignedMember: "Evan Brooks"
    },
    {
      systemId: "M50",
      decisionLine: "Approve control exception",
      assignedMember: "Maya Chen"
    },
    {
      systemId: "M46",
      decisionLine: "Review groundedness evidence",
      assignedMember: "Evan Brooks"
    }
  ]
};

function governedStatusRank(s: GovernedSystem["status"]): number {
  switch (s) {
    case "Critical":
      return 4;
    case "High":
      return 3;
    case "Medium":
      return 2;
    default:
      return 1;
  }
}

function parseEvidenceAgeShort(s: string): number {
  const m = String(s).match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function compareSystemsGovernance(a: GovernedSystem, b: GovernedSystem): number {
  const sr = governedStatusRank(b.status) - governedStatusRank(a.status);
  if (sr !== 0) return sr;
  const cr = b.criticalIncidents - a.criticalIncidents;
  if (cr !== 0) return cr;
  const ea = parseEvidenceAgeShort(b.evidenceAge) - parseEvidenceAgeShort(a.evidenceAge);
  if (ea !== 0) return ea;
  return b.openIncidents - a.openIncidents;
}

/** Top systems for the Owner Action Panel queue (preset or derived). */
export function ownerPriorityQueueRows(ownerTeam: string): OwnerPriorityQueueRow[] {
  const preset = OWNER_PRIORITY_PRESET[ownerTeam];
  const roster = getOwnerTeamDetails(ownerTeam);
  if (preset) return preset;
  return GOVERNED_SYSTEMS.filter((s) => s.ownerTeam === ownerTeam)
    .sort(compareSystemsGovernance)
    .slice(0, 3)
    .map((sys, idx) => ({
      systemId: sys.id,
      decisionLine: decisionPanelCopyForSystem(sys.id).headline,
      assignedMember: roster.members[idx % Math.max(roster.members.length, 1)]
    }));
}

/** Owner team with the strongest SLA / concentration signal (dashboard default after clearing filters). */
export function highestRiskOwnerTeam(): string {
  const rank: Record<SlaRiskLevel, number> = { High: 3, Medium: 2, Low: 1 };
  const sorted = [...OWNER_INSIGHTS].sort((a, b) => {
    const sr = rank[b.slaRisk] - rank[a.slaRisk];
    if (sr !== 0) return sr;
    if (b.critical !== a.critical) return b.critical - a.critical;
    return b.open - a.open;
  });
  return sorted[0]?.ownerTeam ?? DEFAULT_OWNER_TEAM;
}

export const DEFAULT_SYSTEM_ID = "M40";
export const DEFAULT_OWNER_TEAM = "Model Risk Management";
