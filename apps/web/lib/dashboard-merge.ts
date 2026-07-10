import type {
  DashboardSummaryDTO,
  GovernanceSystemsResponseDTO,
  NotificationDTO,
  OwnerQueueResponseDTO,
  OwnerQueueRowDTO
} from "@/lib/governance-api";
import { PRIMARY_OWNER_TEAMS } from "@/lib/governance-api";
import type {
  GovernedSystem,
  GovernanceLoopStage,
  OwnerInsight,
  OwnerTeamDetails,
  SlaRiskLevel
} from "@/lib/dashboard-types";

function capitalizeWord(value: string): string {
  if (!value) return value;
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatAgeLabel(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const days = Math.max(0, Math.floor((Date.now() - then) / 86400000));
  return days === 0 ? "Today" : `${days}d`;
}

function lifecycleToGovernanceStage(lifecycle: string): GovernanceLoopStage {
  const s = lifecycle.toLowerCase();
  if (s.includes("closed") || s.includes("verification")) return "verified";
  if (s.includes("action") || s.includes("remediation")) return "action";
  if (s.includes("owner") || s.includes("review")) return "review";
  if (s.includes("packaged")) return "packaged";
  return "signal";
}

function severityToStatus(severity: string): GovernedSystem["status"] {
  const s = severity.toLowerCase();
  if (s === "critical") return "Critical";
  if (s === "high") return "High";
  if (s === "medium") return "Medium";
  return "Low";
}

function severityToSla(severity: string, openCount: number): SlaRiskLevel {
  const s = severity.toLowerCase();
  if (s === "critical" || openCount >= 3) return "High";
  if (s === "high") return "Medium";
  return "Low";
}

function categoryToRisk(category: string): GovernedSystem["primaryRisk"] {
  const c = category.toLowerCase();
  if (c.includes("output")) return "Output Reliability";
  if (c.includes("cyber") || c.includes("security")) return "Cyber Risk";
  if (c.includes("govern")) return "Governance";
  return "Technology Risk";
}

export function buildOwnerInsightsFromApi(
  queues: Record<string, OwnerQueueResponseDTO | null>,
  dashboard: DashboardSummaryDTO | null
): OwnerInsight[] {
  return PRIMARY_OWNER_TEAMS.map((team) => {
    const items = (queues[team]?.items ?? []).filter((row) => row.lifecycle !== "Closed");
    const critical = items.filter((row) => row.severity.toLowerCase() === "critical").length;
    const bottleneckRow =
      items.find((row) => row.lifecycle === "Owner Review") ??
      items.find((row) => row.lifecycle === "Action Approval") ??
      items[0];
    const bottleneck = bottleneckRow?.lifecycle ?? "Monitoring";
    const stage = lifecycleToGovernanceStage(bottleneck);
    const oldest = items
      .map((row) => row.opened_at)
      .sort()[0];
    const byCategory = items.reduce(
      (acc, row) => {
        const key = row.classification_category.toLowerCase();
        if (key.includes("output")) acc.outputReliability += 1;
        else if (key.includes("cyber") || key.includes("security")) acc.cyber += 1;
        else if (key.includes("govern")) acc.governance += 1;
        else acc.technology += 1;
        return acc;
      },
      { technology: 0, outputReliability: 0, cyber: 0, governance: 0 }
    );

    return {
      ownerTeam: team,
      open: items.length,
      critical,
      decisionsNeeded:
        items.filter((row) =>
          ["Owner Review", "Action Approval"].includes(row.lifecycle)
        ).length || (dashboard?.owner_open_counts[team] ?? 0),
      bottleneck,
      oldestEvidenceAge: oldest ? formatAgeLabel(oldest) : "—",
      governanceStage: stage,
      stageSummary: `${items.length} open · ${critical} critical · bottleneck ${bottleneck}`,
      riskBreakdown: byCategory,
      slaRisk: severityToSla(bottleneckRow?.severity ?? "medium", items.length),
      nextAction: bottleneckRow
        ? `Review ${bottleneckRow.title.slice(0, 48)}`
        : "Monitor queue"
    };
  });
}

export function buildGovernedSystemsFromApi(
  systemsApi: GovernanceSystemsResponseDTO | null,
  queues: Record<string, OwnerQueueResponseDTO | null>
): GovernedSystem[] {
  const fromQueues = _governedSystemsWithIncidents(queues);
  const byDisplayId = new Map(fromQueues.map((row) => [row.id, row]));

  return (systemsApi?.items ?? []).map((sys) => {
    const existing = byDisplayId.get(sys.display_system_id);
    if (existing) return existing;
    return _idleSystemFromApi(sys);
  });
}

/** @deprecated use buildGovernedSystemsFromApi */
export function buildGovernedSystemsFromQueues(
  queues: Record<string, OwnerQueueResponseDTO | null>
): GovernedSystem[] {
  return buildGovernedSystemsFromApi(null, queues);
}

function _platformLabel(platform: string): string {
  const p = platform.toLowerCase();
  if (p === "aws") return "AWS";
  if (p === "azure") return "Azure";
  if (p === "gcp") return "GCP";
  return platform || "Multi-cloud";
}

function _idleSystemFromApi(sys: GovernanceSystemsResponseDTO["items"][number]): GovernedSystem {
  return {
    id: sys.display_system_id,
    systemId: sys.system_id,
    name: sys.system_name_alias ?? sys.system_name,
    type: "Agentic workflow",
    platform: _platformLabel(sys.platform),
    ownerTeam: sys.owner_team,
    businessFunction: sys.archetype,
    primaryRisk: "Technology Risk",
    status: sys.open_incidents > 0 ? "Medium" : "Low",
    openIncidents: sys.open_incidents,
    criticalIncidents: 0,
    evidenceAge: sys.last_signal_at ? formatAgeLabel(sys.last_signal_at) : "—",
    dataSensitivity: "Internal",
    nextAction: sys.open_incidents > 0 ? "Owner review" : "Monitoring",
    governanceStage: sys.open_incidents > 0 ? "review" : "signal",
    stageSummary: sys.open_incidents > 0 ? `${sys.open_incidents} open` : "No open incidents",
    archetype: sys.archetype,
    lastSignalAt: sys.last_signal_at
  };
}

function _governedSystemsWithIncidents(
  queues: Record<string, OwnerQueueResponseDTO | null>
): GovernedSystem[] {
  const bySystem = new Map<string, OwnerQueueRowDTO[]>();

  for (const queue of Object.values(queues)) {
    for (const row of queue?.items ?? []) {
      if (row.lifecycle === "Closed") continue;
      const key = row.display_system_id;
      const list = bySystem.get(key) ?? [];
      list.push(row);
      bySystem.set(key, list);
    }
  }

  return [...bySystem.entries()].map(([systemId, rows]) => {
    const first = rows[0]!;
    const critical = rows.filter((r) => r.severity.toLowerCase() === "critical").length;
    const maxSeverity = rows.reduce((max, r) => {
      const rank = { critical: 4, high: 3, medium: 2, low: 1 };
      const s = r.severity.toLowerCase();
      const score = rank[s as keyof typeof rank] ?? 1;
      return score > max.score ? { severity: s, score } : max;
    }, { severity: "low", score: 0 });

    return {
      id: systemId,
      systemId: first.system_id,
      name: first.system_name_alias ?? first.system_name,
      type: "Agentic workflow" as const,
      platform: "Multi-cloud",
      ownerTeam: first.owner_team,
      businessFunction: first.classification_category,
      primaryRisk: categoryToRisk(first.classification_category),
      status: severityToStatus(maxSeverity.severity),
      openIncidents: rows.length,
      criticalIncidents: critical,
      evidenceAge: formatAgeLabel(first.opened_at),
      dataSensitivity: critical > 0 ? ("Critical" as const) : ("Internal" as const),
      nextAction: first.lifecycle === "Owner Review" ? "Owner review" : first.lifecycle,
      governanceStage: lifecycleToGovernanceStage(first.lifecycle),
      stageSummary: `${rows.length} open · ${first.lifecycle}`
    };
  });
}

export function buildRemediationEvidenceSummaryFromApi(
  dashboard: DashboardSummaryDTO | null
) {
  return {
    underMonitoring: dashboard?.verification_count ?? 0,
    improvementObserved: dashboard?.verification_improved ?? 0,
    followUpRequired: dashboard?.verification_follow_up ?? 0,
    rollbackCandidates: dashboard?.verification_rollback ?? 0,
    closedNoMaterial: Math.max(
      0,
      (dashboard?.verification_count ?? 0) - (dashboard?.verification_improved ?? 0)
    ),
    footer: "Live verification outcomes from governed actions and simulator pipeline."
  };
}

export function buildGovernanceLoopFromApi(dashboard: DashboardSummaryDTO | null) {
  return {
    investigations: {
      open: dashboard?.active_incidents ?? 0,
      awaitingApproval: dashboard?.actions_awaiting_approval ?? 0,
      pendingRecommendations: dashboard?.decisions_needed ?? 0,
      recurring: 0
    },
    verification: {
      recurrenceReduced: dashboard?.verification_improved ?? 0,
      improvement: dashboard?.verification_improved ?? 0,
      followUp: dashboard?.verification_follow_up ?? 0,
      rollback: dashboard?.verification_rollback ?? 0
    }
  };
}

export function highestRiskOwnerTeamFromInsights(insights: OwnerInsight[]): string {
  const rank: Record<SlaRiskLevel, number> = { High: 3, Medium: 2, Low: 1 };
  const sorted = [...insights].sort((a, b) => {
    const sr = rank[b.slaRisk] - rank[a.slaRisk];
    if (sr !== 0) return sr;
    if (b.critical !== a.critical) return b.critical - a.critical;
    return b.open - a.open;
  });
  return sorted[0]?.ownerTeam ?? "Model Risk Management";
}

export function buildOwnerPackageMetaFromApi(
  ownerTeam: string,
  queues: Record<string, OwnerQueueResponseDTO | null>,
  insights: OwnerInsight[]
) {
  const insight = insights.find((row) => row.ownerTeam === ownerTeam);
  const queue = queues[ownerTeam]?.items ?? [];
  const lead = queue[0]?.reviewer ?? "—";
  const members = [...new Set(queue.map((row) => row.reviewer).filter(Boolean))] as string[];
  return {
    teamLead: lead,
    handoff: queue.length ? "Synced · Live" : "Monitoring",
    reviewers: members.length ? members.join(", ") : "—",
    evidenceStatus: "Synced" as const,
    lastUpdated: "Live",
    insight
  };
}

export function buildOwnerTeamDetailsFromApi(
  ownerTeam: string,
  queues: Record<string, OwnerQueueResponseDTO | null>,
  insights: OwnerInsight[]
): OwnerTeamDetails {
  const meta = buildOwnerPackageMetaFromApi(ownerTeam, queues, insights);
  const members =
    meta.reviewers === "—" ? [] : meta.reviewers.split(", ").filter(Boolean);
  return {
    teamName: ownerTeam,
    teamLead: meta.teamLead,
    leadRole: "Owner",
    leadEmail: "",
    members,
    notificationStatus: meta.handoff.startsWith("Synced") ? "Notified" : "Monitoring",
    lastNotifiedAt: meta.lastUpdated,
    evidencePackStatus: meta.evidenceStatus === "Synced" ? "Sent" : "Not generated",
    pendingAssignments: meta.insight?.decisionsNeeded ?? 0,
    evidencePackId: `ep-${ownerTeam.toLowerCase().replace(/\s+/g, "-")}`
  };
}

export function riskMixLabelFromInsight(insight: OwnerInsight | undefined): string {
  if (!insight) return "—";
  const parts: string[] = [];
  if (insight.riskBreakdown.outputReliability) {
    parts.push(`Output Reliability ${insight.riskBreakdown.outputReliability}`);
  }
  if (insight.riskBreakdown.governance) {
    parts.push(`Governance ${insight.riskBreakdown.governance}`);
  }
  if (insight.riskBreakdown.technology) {
    parts.push(`Technology ${insight.riskBreakdown.technology}`);
  }
  if (insight.riskBreakdown.cyber) {
    parts.push(`Cyber ${insight.riskBreakdown.cyber}`);
  }
  return parts.length ? parts.join(" · ") : "—";
}

export function buildOwnerFleetracAnalysisFromApi(
  ownerTeam: string,
  evidenceByAlias: Record<string, import("@/lib/governance-api").EvidenceRecordDTO | null>
): { summary: string; recommendedOwnerAction: string } | null {
  for (const dto of Object.values(evidenceByAlias)) {
    if (!dto || dto.owner_team !== ownerTeam) continue;
    const analysis = dto.fleetrac_analysis;
    if (!analysis) continue;
    return {
      summary: analysis.summary,
      recommendedOwnerAction: analysis.recommended_actions[0] ?? analysis.policy_notes
    };
  }
  return null;
}
