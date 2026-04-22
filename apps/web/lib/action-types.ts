export type ActionSourceType =
  | "incident"
  | "system"
  | "control"
  | "bob_investigation";

export type ActionType =
  | "open_ticket"
  | "create_followup_review"
  | "assign_owner"
  | "draft_runbook"
  | "request_review"
  | "schedule_monitoring_window"
  | "prepare_threshold_change"
  | "prepare_control_split"
  | "prepare_config_suggestion"
  | "prepare_routing_change"
  | "prepare_review_gate_tightening"
  | "prepare_fallback_activation"
  | "request_rollback"
  | "request_workflow_pause"
  | "request_traffic_reroute"
  | "request_model_disablement"
  | "request_emergency_review_path"
  | "prepare_auto_remediation_candidate";

export type ApprovalState =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected"
  | "escalated";

export type ExecutionState =
  | "drafted"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "prepared"
  | "ready_to_execute"
  | "executed"
  | "monitoring_outcome"
  | "closed"
  | "reverted"
  | "follow_up_required";

export type MonitoringStatus =
  | "not_applicable"
  | "monitoring_next_window"
  | "awaiting_telemetry"
  | "no_meaningful_change"
  | "improvement_observed"
  | "regression_detected"
  | "rollback_recommended"
  | "reviewer_signoff_pending";

export type RiskLevel = "low" | "medium" | "high";

export type ExecutionMode =
  | "manual_handoff"
  | "bob_prepares"
  | "approval_gated"
  | "auto_within_bounds";

export type BlastRadius =
  | "single_system"
  | "workflow_slice"
  | "system_fleet"
  | "non_customer_facing"
  | "staging_only"
  | "reversible_only";

export type SuggestedBy = "bob" | "human" | "mixed";

export type Action = {
  id: string;
  title: string;
  action_type: ActionType;
  source_type: ActionSourceType;
  source_id: string;
  bob_investigation_id: string | null;
  recommendation_id: string | null;
  target_system_id: string | null;
  target_system_name: string | null;
  related_incident_id: string | null;
  related_control_id: string | null;
  suggested_by: SuggestedBy;
  action_scope: string;
  recommended_owner: string;
  required_approver: string;
  approval_policy: string;
  approval_status: ApprovalState;
  execution_status: ExecutionState;
  execution_mode: ExecutionMode;
  reversible: boolean;
  blast_radius: BlastRadius;
  risk_level: RiskLevel;
  confidence: "low" | "medium" | "high";
  confidence_score: number;
  allowed_by_policy: boolean;
  blocked_reason: string | null;
  prepared_change_summary: string;
  execution_notes: string | null;
  monitoring_status: MonitoringStatus;
  monitoring_note: string | null;
  rejection_reason: string | null;
  alternative_suggestion: string | null;
  created_at: string;
  updated_at: string;
  executed_at: string | null;
  monitored_until: string | null;
};

export type BobOperatingMode =
  | "observe_only"
  | "recommend_only"
  | "prepare_actions"
  | "approval_gated_execution"
  | "limited_auto_execution";

export type TelemetryLevel = "full" | "partial" | "metrics_only" | "logs_only";
export type ConfigAccess = "read_only" | "read_write" | "none";
export type LogsAccess = "connected" | "partial" | "unavailable";
export type ActionLevel =
  | "none"
  | "prepare_only"
  | "approval_gated"
  | "limited_execution";

export type AccessPolicy = {
  system_id: string;
  bob_operating_mode: BobOperatingMode;
  telemetry_level: TelemetryLevel;
  config_access: ConfigAccess;
  logs_access: LogsAccess;
  action_level: ActionLevel;
  integration_mode: string;
  environment: "production" | "staging" | "internal_only" | "sandbox";
  observability_access: string[];
  integration_access: string[];
  approval_policy: string[];
  allowed_actions: ActionType[];
  restricted_actions: string[];
  execution_boundary: string[];
  primary_approver: string;
  secondary_approver: string | null;
  updated_at: string;
};
