import type { ActivityItem } from "@/components/activity-feed";
import type { DemoIncidentActionEntry } from "@/lib/demo-state";

/**
 * Maps demo session log entries to canonical activity keys for labels and icons.
 */
export function mapDemoIncidentEntryToActivityItem(
  entry: DemoIncidentActionEntry,
  incidentId: string
): ActivityItem {
  let action: string;
  switch (entry.action) {
    case "confirm_incident":
      action = "incident.review_required";
      break;
    case "mark_false_positive":
      action = "incident.false_positive";
      break;
    case "escalate_incident":
      action = "incident.escalated";
      break;
    case "resolve_incident":
      action = "incident.mitigated";
      break;
    case "owner_assigned":
    case "specialist_assigned":
      action = "owner.assigned";
      break;
    case "bob_queue_assigned":
      action = "routing.bob_queue";
      break;
    case "notify_owner_team_slack":
    case "notify_system_owner_slack":
    case "notify_control_owner_slack":
    case "notify_on_call_channel_slack":
    case "notify_leadership_channel_slack":
      action = "outreach.slack";
      break;
    case "create_jira_notify_owner_team":
    case "create_jira_ticket":
      action = "outreach.jira";
      break;
    case "schedule_auto_followup":
      action = "followup.scheduled";
      break;
    case "draft_escalation_message":
      action = "incident.escalated";
      break;
    case "bridge_opened":
      action = "bridge.opened";
      break;
    case "tool_logs_opened":
      action = "tool.logs.opened";
      break;
    case "tool_debugger_opened":
      action = "tool.debugger.opened";
      break;
    case "tool_traces_opened":
      action = "tool.traces.opened";
      break;
    case "tool_metrics_opened":
      action = "tool.metrics.opened";
      break;
    case "tool_cloud_console_opened":
      action = "tool.cloud_console.opened";
      break;
    case "tool_runbook_opened":
      action = "tool.runbook.opened";
      break;
    default:
      action = "incident.review_required";
  }
  return {
    id: entry.id,
    action,
    details: entry.details,
    timestamp: entry.timestamp,
    targetId: incidentId,
    targetType: "incident",
    actor: "operator.session"
  };
}

export function mergeIncidentDetailActivity(
  incidentId: string,
  initialItems: ActivityItem[],
  demoEntries: DemoIncidentActionEntry[]
): ActivityItem[] {
  const mapped = demoEntries
    .filter((e) => e.incidentId === incidentId)
    .map((e) => mapDemoIncidentEntryToActivityItem(e, incidentId));
  return [...mapped, ...initialItems];
}
