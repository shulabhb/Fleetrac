/** Dashboard display types — derived from governance API, not mock catalogs. */

export type SlaRiskLevel = "High" | "Medium" | "Low";

export type GovernanceLoopStage = "signal" | "packaged" | "review" | "action" | "verified";

export type OwnerNotificationUIFlag = "Notified" | "Acknowledged" | "Pending" | "Monitoring";

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
  decisionsNeeded: number;
  bottleneck: string;
  oldestEvidenceAge: string;
  governanceStage: GovernanceLoopStage;
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
  systemId: string;
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
  governanceStage: GovernanceLoopStage;
  stageSummary: string;
  archetype?: string;
  lastSignalAt?: string | null;
};

export type OwnerActionPanelCopy = {
  headline: string;
  context: string;
  recommendedAction: string;
  evidenceSummary: string;
};

export type OwnerPriorityQueueRow = {
  systemId: string;
  decisionLine: string;
  assignedMember?: string;
};

export const DEFAULT_OWNER_TEAM = "Model Risk Management";
export const DEFAULT_SYSTEM_ID = "M40";

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

export function ownerActionCopyForTeam(
  ownerTeam: string,
  insight: OwnerInsight
): OwnerActionPanelCopy {
  return {
    headline: insight.nextAction,
    context: `${ownerTeam} · bottleneck ${insight.bottleneck}`,
    recommendedAction:
      insight.decisionsNeeded > 0
        ? "Review queued incidents and route governed actions through Action Center."
        : "Monitor live signals until governance thresholds are breached.",
    evidenceSummary: `${insight.open} open · ${insight.critical} critical · oldest ${insight.oldestEvidenceAge}`
  };
}
