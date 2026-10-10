/** Notification bell types — events from governance API when enabled. */

export type NotificationTarget = "incident-queue" | "action-center" | "evidence";

export type NotificationKind =
  | "decision"
  | "verify"
  | "rollback"
  | "follow_up"
  | "improvement"
  | "severity"
  | "regression"
  | "rejected";

export type NotificationEvent = {
  id: string;
  at: string;
  channel: "Slack" | "Email" | "In-app";
  summary: string;
  ownerTeam: string;
  incidentId?: string;
  target?: NotificationTarget;
  kind?: NotificationKind;
  actionId?: string;
};
