export type InvestigationStatus =
  | "draft"
  | "ready_for_review"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "executed"
  | "monitoring_outcome";

export type ConfidenceTier = "low" | "medium" | "high";

export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";

export type TargetType = "incident" | "system" | "control";

export type EvidenceType =
  | "telemetry_snapshot"
  | "similar_incidents"
  | "active_controls"
  | "audit_coverage"
  | "threshold_history"
  | "governance_activity"
  | "recurrence_pattern"
  | "drift_trend"
  | "control_fire_rate";

export type RecommendationType =
  | "retrain_candidate"
  | "tighten_review_gate"
  | "retrieval_freshness_review"
  | "tune_threshold"
  | "route_to_owner"
  | "upstream_data_investigation"
  | "escalate"
  | "rollback_candidate"
  | "increase_audit_sampling"
  | "observe_next_window"
  | "control_tuning"
  | "cluster_escalation";

export type BobEvidence = {
  id: string;
  type: EvidenceType;
  label: string;
  detail: string;
  reference_id?: string | null;
  value?: string | null;
};

export type BobActivityEvent = {
  id: string;
  timestamp: string;
  action: string;
  detail: string;
};

export type BobRecommendation = {
  id: string;
  investigation_id: string;
  type: RecommendationType;
  title: string;
  rationale_summary: string;
  target_type: TargetType;
  target_id: string;
  target_label?: string | null;
  confidence: ConfidenceTier;
  confidence_score: number;
  owner_team: string;
  approval_required: boolean;
  approval_status: ApprovalStatus;
  remediation_type: string;
};

export type BobInvestigation = {
  id: string;
  title: string;
  target_type: TargetType;
  target_id: string;
  target_label: string;
  status: InvestigationStatus;
  confidence: ConfidenceTier;
  confidence_score: number;
  summary: string;
  likely_root_cause: string;
  alternative_hypothesis?: string | null;
  why_it_matters: string;
  suggested_owner: string;
  top_recommendation_id?: string | null;
  recurring_issue_flag: boolean;
  evidence: BobEvidence[];
  activity: BobActivityEvent[];
  recommendations: BobRecommendation[];
  signal_type?: string | null;
  risk_domain?: string | null;
  created_at: string;
  updated_at: string;
  last_bob_run_at: string;
};
