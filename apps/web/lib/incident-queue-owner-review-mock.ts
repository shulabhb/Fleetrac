/**
 * Demo rows for Owner Review queue mode — aligns with dashboard owner workflow.
 * Merge with API incidents by incidentId when present.
 */

export type OwnerReviewTableRow = {
  incidentId: string;
  priority: "P1" | "P2" | "P3";
  title: string;
  systemId: string;
  systemName: string;
  /** Aligns with Evidence Library risk vocabulary / filters */
  riskCategory: string;
  severityLabel: string;
  stage: string;
  assignedTo: string;
  evidenceItemsCount: number;
  ageLabel: string;
  nextAction: string;
  decisionNeeded: string;
  recommendedAction: string;
  evidenceSummary: string;
  investigationTimeline: string;
};

/** Evidence library line shown in owner queue header (demo copy per owner team). */
export const OWNER_EVIDENCE_LIBRARY_LINE: Partial<Record<string, string>> = {
  "Model Risk Management": "3 incident packs · 1 owner snapshot",
  "Security Operations": "3 incident packs · 1 owner snapshot",
  "Platform Reliability": "2 incident packs · 1 owner snapshot"
};

export function ownerEvidenceLibraryLine(ownerTeam: string): string {
  return OWNER_EVIDENCE_LIBRARY_LINE[ownerTeam] ?? "Incident packs · 1 owner snapshot";
}

/** Mock rows keyed by owner team. */
export const OWNER_REVIEW_QUEUE_ROWS: Partial<Record<string, OwnerReviewTableRow[]>> = {
  "Model Risk Management": [
    {
      incidentId: "inc-mrm-001",
      priority: "P1",
      title: "Unsupported Claim Rate High",
      systemId: "M40",
      systemName: "NII Sensitivity",
      riskCategory: "Output Reliability",
      severityLabel: "Critical",
      stage: "Owner Review",
      assignedTo: "Evan Brooks",
      evidenceItemsCount: 4,
      ageLabel: "10d",
      nextAction: "Open investigation",
      decisionNeeded: "Review unsupported claim remediation",
      recommendedAction: "Raise retrieval threshold and require citation fallback.",
      evidenceSummary:
        "Unsupported claim rate exceeded threshold while retrieval confidence dropped below approved baseline.",
      investigationTimeline:
        "Signal detected → Incident packaged → Owner notified → Review pending"
    },
    {
      incidentId: "inc-mrm-002",
      priority: "P1",
      title: "Control Exception Requires Approval",
      systemId: "M50",
      systemName: "PEP Screening",
      riskCategory: "Governance",
      severityLabel: "Critical",
      stage: "Owner Review",
      assignedTo: "Maya Chen",
      evidenceItemsCount: 3,
      ageLabel: "10d",
      nextAction: "Approve exception",
      decisionNeeded: "Approve control exception",
      recommendedAction: "Route exception through governance workflow with audit linkage.",
      evidenceSummary:
        "Control deviation flagged; policy mapping requires owner sign-off before automated routing resumes.",
      investigationTimeline:
        "Signal detected → Incident packaged → Owner notified → Approval pending"
    },
    {
      incidentId: "inc-mrm-003",
      priority: "P2",
      title: "Groundedness Evidence Review",
      systemId: "M46",
      systemName: "Model Risk FAQ",
      riskCategory: "Output Reliability",
      severityLabel: "Critical",
      stage: "Owner Review",
      assignedTo: "Evan Brooks",
      evidenceItemsCount: 3,
      ageLabel: "10d",
      nextAction: "Review evidence",
      decisionNeeded: "Review groundedness evidence",
      recommendedAction: "Tighten citation rules for regulated FAQ answers.",
      evidenceSummary:
        "Groundedness evidence stale; source consistency below threshold on regulated paths.",
      investigationTimeline: "Packaged → Owner notified → Evidence review in progress"
    },
    {
      incidentId: "inc-mrm-004",
      priority: "P3",
      title: "Baseline Drift Requires Confirmation",
      systemId: "M40",
      systemName: "NII Sensitivity",
      riskCategory: "Technology",
      severityLabel: "High",
      stage: "Packaged",
      assignedTo: "Evan Brooks",
      evidenceItemsCount: 2,
      ageLabel: "6d",
      nextAction: "Review baseline",
      decisionNeeded: "Confirm baseline drift interpretation",
      recommendedAction: "Re-baseline retrieval metrics and confirm acceptable drift band.",
      evidenceSummary:
        "Monitoring shows gradual drift from approved baseline; confirmation needed before closure.",
      investigationTimeline: "Signal detected → Packaged → Pending owner triage"
    }
  ],
  "Security Operations": [
    {
      incidentId: "inc-sec-001",
      priority: "P1",
      title: "Tool Scope Violation on Refund API",
      systemId: "A12",
      systemName: "Ticket Routing Agent",
      riskCategory: "Cyber",
      severityLabel: "Critical",
      stage: "Action Approval",
      assignedTo: "Nora Patel",
      evidenceItemsCount: 5,
      ageLabel: "1d",
      nextAction: "Approve containment",
      decisionNeeded: "Approve containment action",
      recommendedAction: "Approve narrowed tool manifest and redeploy routing policy.",
      evidenceSummary:
        "Automated routing invoked refund tooling outside approved scope; containment awaits approval.",
      investigationTimeline:
        "Signal detected → Incident packaged → Containment proposed → Approval pending"
    },
    {
      incidentId: "inc-sec-002",
      priority: "P1",
      title: "Prompt Injection Attempt Detected",
      systemId: "A12",
      systemName: "Ticket Routing Agent",
      riskCategory: "Cyber",
      severityLabel: "High",
      stage: "Owner Review",
      assignedTo: "James Kim",
      evidenceItemsCount: 3,
      ageLabel: "1d",
      nextAction: "Open investigation",
      decisionNeeded: "Investigate injection pathway",
      recommendedAction: "Isolate prompt boundary and enable refusal escalation.",
      evidenceSummary:
        "Repeated adversarial prompts targeting routing instructions with lateral movement indicators.",
      investigationTimeline:
        "Signal detected → Incident packaged → Owner notified → Review pending"
    },
    {
      incidentId: "inc-sec-003",
      priority: "P2",
      title: "Excessive Tool Retry Pattern",
      systemId: "A12",
      systemName: "Ticket Routing Agent",
      riskCategory: "Technology",
      severityLabel: "Medium",
      stage: "Packaged",
      assignedTo: "Nora Patel",
      evidenceItemsCount: 2,
      ageLabel: "2d",
      nextAction: "Review retry policy",
      decisionNeeded: "Review automated retry limits",
      recommendedAction: "Cap retries per session and alert on burst patterns.",
      evidenceSummary:
        "Elevated retry counts suggest instability or abuse pattern against tooling endpoints.",
      investigationTimeline: "Packaged → Pending triage"
    }
  ],
  "Platform Reliability": [
    {
      incidentId: "inc-plat-001",
      priority: "P1",
      title: "Provider Latency Regression",
      systemId: "M44",
      systemName: "Invoice OCR Validation",
      riskCategory: "Technology",
      severityLabel: "Critical",
      stage: "Verification",
      assignedTo: "Daniel Wu",
      evidenceItemsCount: 4,
      ageLabel: "2d",
      nextAction: "Verify rollback",
      decisionNeeded: "Verify rollback effectiveness",
      recommendedAction: "Verify OCR provider rollback and latency recovery vs SLA.",
      evidenceSummary:
        "Sustained latency regression vs baseline; rollback candidate under verification.",
      investigationTimeline:
        "Signal detected → Packaged → Owner notified → Verification in progress"
    },
    {
      incidentId: "inc-plat-002",
      priority: "P2",
      title: "Fallback Route Misfire",
      systemId: "M44",
      systemName: "Invoice OCR Validation",
      riskCategory: "Technology",
      severityLabel: "High",
      stage: "Action Approval",
      assignedTo: "Priya Shah",
      evidenceItemsCount: 3,
      ageLabel: "4d",
      nextAction: "Approve route update",
      decisionNeeded: "Approve fallback routing change",
      recommendedAction: "Approve routing patch and staged rollout to secondary provider.",
      evidenceSummary:
        "Fallback route fired incorrectly under partial outage; traffic briefly misdirected.",
      investigationTimeline: "Packaged → Approval pending → Rollback staged"
    }
  ]
};

/** Evidence bullet lists by system id for owner evidence pack. */
export const OWNER_PACK_EVIDENCE_REFERENCES: Record<string, string[]> = {
  M40: [
    "Retrieval confidence below baseline",
    "Unsupported claim rate above threshold",
    "Citation fallback missing",
    "Reviewer approval pending"
  ],
  M50: [
    "Control exception flagged",
    "Policy mapping incomplete",
    "Human approval required"
  ],
  M46: [
    "Groundedness evidence stale",
    "Source consistency below threshold"
  ]
};

export type IncidentEvidencePackMock = {
  incidentId: string;
  title: string;
  summary: string;
  systemName: string;
  systemId: string;
  ownerTeam: string;
  assignedReviewer: string;
  severity: string;
  riskCategory: string;
  stage: string;
  evidenceItems: string[];
  recommendedAction: string;
  timeline: string;
  outcomeStatus: string;
};

/** Legacy ids retained for deep links; prefer inc-mrm-* / inc-sec-* / inc-plat-* for queue demos. */
export const INCIDENT_EVIDENCE_PACK_BY_ID: Partial<Record<string, IncidentEvidencePackMock>> = {
  "inc-mrm-001": {
    incidentId: "inc-mrm-001",
    title: "Unsupported Claim Rate High",
    summary:
      "Unsupported claim rate exceeded threshold while retrieval confidence dropped below approved baseline.",
    systemName: "NII Sensitivity",
    systemId: "M40",
    ownerTeam: "Model Risk Management",
    assignedReviewer: "Evan Brooks",
    severity: "Critical",
    riskCategory: "Output Reliability",
    stage: "Owner Review",
    evidenceItems: [
      "Unsupported claim rate exceeded threshold",
      "Retrieval confidence below baseline",
      "Missing citation fallback",
      "Similar recurrence detected twice in last 10 days"
    ],
    recommendedAction: "Raise retrieval threshold and require citation fallback.",
    timeline: "Signal detected → Incident packaged → Owner notified → Review pending",
    outcomeStatus: "Not verified yet"
  },
  "inc-mrm-002": {
    incidentId: "inc-mrm-002",
    title: "Control Exception Requires Approval",
    summary:
      "Control deviation flagged; policy mapping requires owner sign-off before automated routing resumes.",
    systemName: "PEP Screening",
    systemId: "M50",
    ownerTeam: "Model Risk Management",
    assignedReviewer: "Maya Chen",
    severity: "Critical",
    riskCategory: "Governance",
    stage: "Owner Review",
    evidenceItems: ["Policy mapping incomplete", "Human approval required", "Audit trail checkpoint"],
    recommendedAction: "Route exception through governance workflow with audit linkage.",
    timeline: "Signal detected → Incident packaged → Owner notified → Approval pending",
    outcomeStatus: "Not verified yet"
  },
  "inc-mrm-003": {
    incidentId: "inc-mrm-003",
    title: "Groundedness Evidence Review",
    summary:
      "Groundedness evidence stale; source consistency below threshold on regulated FAQ paths.",
    systemName: "Model Risk FAQ",
    systemId: "M46",
    ownerTeam: "Model Risk Management",
    assignedReviewer: "Evan Brooks",
    severity: "Critical",
    riskCategory: "Output Reliability",
    stage: "Owner Review",
    evidenceItems: [
      "Groundedness evidence stale",
      "Source consistency below threshold",
      "Citation rules pending"
    ],
    recommendedAction: "Tighten citation rules for regulated FAQ answers.",
    timeline: "Packaged → Owner notified → Evidence review",
    outcomeStatus: "Not verified yet"
  },
  "inc-mrm-004": {
    incidentId: "inc-mrm-004",
    title: "Baseline Drift Requires Confirmation",
    summary:
      "Monitoring shows gradual drift from approved baseline; confirmation needed before closure.",
    systemName: "NII Sensitivity",
    systemId: "M40",
    ownerTeam: "Model Risk Management",
    assignedReviewer: "Evan Brooks",
    severity: "High",
    riskCategory: "Technology",
    stage: "Packaged",
    evidenceItems: ["Baseline drift detected", "Variance vs approved envelope"],
    recommendedAction: "Re-baseline retrieval metrics and confirm acceptable drift band.",
    timeline: "Signal detected → Packaged → Pending owner triage",
    outcomeStatus: "Not verified yet"
  },
  "inc-sec-001": {
    incidentId: "inc-sec-001",
    title: "Tool Scope Violation on Refund API",
    summary:
      "Automated ticket routing invoked refund tooling outside approved scope; containment awaits approval.",
    systemName: "Ticket Routing Agent",
    systemId: "A12",
    ownerTeam: "Security Operations",
    assignedReviewer: "Nora Patel",
    severity: "Critical",
    riskCategory: "Cyber Risk",
    stage: "Action Approval",
    evidenceItems: [
      "Tool invocation outside approved manifest",
      "Refund API scope mismatch",
      "Containment action pending approval",
      "Traffic sampled for blast radius",
      "Approver checklist attached"
    ],
    recommendedAction: "Approve narrowed tool manifest and redeploy routing policy.",
    timeline: "Signal detected → Incident packaged → Containment proposed → Approval pending",
    outcomeStatus: "Not verified yet"
  },
  "inc-sec-002": {
    incidentId: "inc-sec-002",
    title: "Prompt Injection Attempt Detected",
    summary:
      "Repeated adversarial prompts targeting routing instructions with lateral movement indicators.",
    systemName: "Ticket Routing Agent",
    systemId: "A12",
    ownerTeam: "Security Operations",
    assignedReviewer: "James Kim",
    severity: "High",
    riskCategory: "Cyber Risk",
    stage: "Owner Review",
    evidenceItems: ["Adversarial prompt pattern", "Guardrail hit rate drop", "Session trace captured"],
    recommendedAction: "Isolate prompt boundary and enable refusal escalation.",
    timeline: "Signal detected → Incident packaged → Owner notified → Review pending",
    outcomeStatus: "Not verified yet"
  },
  "inc-sec-003": {
    incidentId: "inc-sec-003",
    title: "Excessive Tool Retry Pattern",
    summary: "Elevated retry counts suggest instability or abuse pattern against tooling endpoints.",
    systemName: "Ticket Routing Agent",
    systemId: "A12",
    ownerTeam: "Security Operations",
    assignedReviewer: "Nora Patel",
    severity: "Medium",
    riskCategory: "Technology Risk",
    stage: "Packaged",
    evidenceItems: ["Retry burst over threshold", "Correlated 503 window"],
    recommendedAction: "Cap retries per session and alert on burst patterns.",
    timeline: "Packaged → Pending triage",
    outcomeStatus: "Not verified yet"
  },
  "inc-plat-001": {
    incidentId: "inc-plat-001",
    title: "Provider Latency Regression",
    summary: "Sustained latency regression vs baseline; rollback candidate under verification.",
    systemName: "Invoice OCR Validation",
    systemId: "M44",
    ownerTeam: "Platform Reliability",
    assignedReviewer: "Daniel Wu",
    severity: "Critical",
    riskCategory: "Technology Risk",
    stage: "Verification",
    evidenceItems: [
      "p95 latency above SLO",
      "Comparison vs last verified window",
      "Provider health check delta",
      "Sampled error budget burn"
    ],
    recommendedAction: "Verify OCR provider rollback and latency recovery vs SLA.",
    timeline: "Signal detected → Packaged → Owner notified → Verification in progress",
    outcomeStatus: "Not verified yet"
  },
  "inc-plat-002": {
    incidentId: "inc-plat-002",
    title: "Fallback Route Misfire",
    summary: "Fallback route fired incorrectly under partial outage; traffic briefly misdirected.",
    systemName: "Invoice OCR Validation",
    systemId: "M44",
    ownerTeam: "Platform Reliability",
    assignedReviewer: "Priya Shah",
    severity: "High",
    riskCategory: "Technology Risk",
    stage: "Action Approval",
    evidenceItems: ["Incorrect fallback target", "Health gate timing issue", "Traffic capture available"],
    recommendedAction: "Approve routing patch and staged rollout to secondary provider.",
    timeline: "Packaged → Approval pending → Rollback staged",
    outcomeStatus: "Not verified yet"
  },
  "inc-m40-3": {
    incidentId: "inc-m40-3",
    title: "Unsupported Claim Rate High",
    summary:
      "Unsupported claim rate exceeded threshold while retrieval confidence dropped below approved baseline.",
    systemName: "NII Sensitivity",
    systemId: "M40",
    ownerTeam: "Model Risk Management",
    assignedReviewer: "Evan Brooks",
    severity: "Critical",
    riskCategory: "Output Reliability",
    stage: "Owner Review",
    evidenceItems: [
      "Unsupported claim rate exceeded threshold",
      "Retrieval confidence below baseline",
      "Missing citation fallback",
      "Similar recurrence detected twice in last 10 days"
    ],
    recommendedAction: "Raise retrieval threshold and require citation fallback.",
    timeline: "Signal detected → Incident packaged → Owner notified → Review pending",
    outcomeStatus: "Not verified yet"
  },
  "inc-m50-1": {
    incidentId: "inc-m50-1",
    title: "PEP Match Escalation Threshold Breach",
    summary:
      "Escalated PEP screening volume exceeded policy thresholds; human approval required before automated routing.",
    systemName: "PEP Screening",
    systemId: "M50",
    ownerTeam: "Model Risk Management",
    assignedReviewer: "Maya Chen",
    severity: "High",
    riskCategory: "Governance",
    stage: "Owner Review",
    evidenceItems: [
      "Escalation threshold breach",
      "Audit trail gap noted",
      "Approval workflow pending"
    ],
    recommendedAction: "Approve escalated review workflow for PEP tier.",
    timeline: "Signal detected → Packaged → Owner notified → Approval pending",
    outcomeStatus: "Not verified yet"
  },
  "inc-m46-1": {
    incidentId: "inc-m46-1",
    title: "Unsupported Claim Rate Elevated on FAQ",
    summary: "Unsupported claims on FAQ path exceeded baseline; retrieval and grounding review required.",
    systemName: "Model Risk FAQ",
    systemId: "M46",
    ownerTeam: "Model Risk Management",
    assignedReviewer: "Evan Brooks",
    severity: "High",
    riskCategory: "Output Reliability",
    stage: "Owner Review",
    evidenceItems: ["Unsupported claim rate elevated", "Retrieval miss rate above baseline", "Citation rules pending"],
    recommendedAction: "Tighten citation rules for regulated answers.",
    timeline: "Packaged → Owner notified → Evidence review",
    outcomeStatus: "Not verified yet"
  },
  "inc-a12-1": {
    incidentId: "inc-a12-1",
    title: "Tool Scope Violation on Refund API",
    summary:
      "Automated ticket routing invoked refund tooling outside approved scope; containment requires approval before reinstatement.",
    systemName: "Ticket Routing Agent",
    systemId: "A12",
    ownerTeam: "Security Operations",
    assignedReviewer: "Nora Patel",
    severity: "Critical",
    riskCategory: "Cyber Risk",
    stage: "Action Approval",
    evidenceItems: [
      "Tool invocation outside approved manifest",
      "Refund API scope mismatch",
      "Containment action pending approval"
    ],
    recommendedAction: "Approve narrowed tool manifest and redeploy routing policy.",
    timeline: "Signal detected → Incident packaged → Containment proposed → Approval pending",
    outcomeStatus: "Not verified yet"
  },
  "inc-m44-1": {
    incidentId: "inc-m44-1",
    title: "OCR Confidence Below Floor on M44",
    summary:
      "Invoice OCR validation dropped below confidence floor on high-volume batch; recurrence checks underway.",
    systemName: "Invoice OCR Validation",
    systemId: "M44",
    ownerTeam: "Platform Reliability",
    assignedReviewer: "Daniel Wu",
    severity: "Critical",
    riskCategory: "Technology Risk",
    stage: "Verification",
    evidenceItems: [
      "Confidence floor breach on batch path",
      "Drift vs last verified baseline",
      "Manual spot-check sample incomplete"
    ],
    recommendedAction: "Verify model calibration and threshold tuning before clearing verification.",
    timeline: "Signal detected → Packaged → Owner notified → Verification in progress",
    outcomeStatus: "Not verified yet"
  }
};

const MOCK_AC_KEY = "fleetrac-mock-action-center-items";

export type MockActionCenterItem = {
  incidentId: string;
  title: string;
  ownerTeam: string;
  createdAt: number;
};

export function pushMockActionCenterItem(item: {
  incidentId: string;
  title: string;
  ownerTeam: string;
}): void {
  if (typeof window === "undefined") return;
  let list: MockActionCenterItem[] = [];
  try {
    const raw = window.sessionStorage.getItem(MOCK_AC_KEY);
    if (raw) list = JSON.parse(raw) as MockActionCenterItem[];
  } catch {
    list = [];
  }
  list.push({ ...item, createdAt: Date.now() });
  try {
    window.sessionStorage.setItem(MOCK_AC_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
