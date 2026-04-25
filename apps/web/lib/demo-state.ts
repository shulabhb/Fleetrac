import { migrateLegacyIncidentStatus } from "@/lib/incident-lifecycle";

export type DemoIncidentState = {
  incidentStatus: string;
  escalationStatus: string;
  reviewRequired: boolean;
};

const STORAGE_KEY = "fleetrac_demo_incident_state_v1";
const ACTION_LOG_KEY = "fleetrac_demo_incident_action_log_v1";
const OUTREACH_KEY = "fleetrac_demo_incident_outreach_v1";
export const INCIDENT_DEMO_EVENT = "fleetrac:incident-demo-updated";

export type DemoIncidentAction =
  | "confirm_incident"
  | "mark_false_positive"
  | "escalate_incident"
  | "resolve_incident"
  | "owner_assigned"
  | "bob_queue_assigned"
  | "specialist_assigned"
  | "notify_owner_team_slack"
  | "notify_system_owner_slack"
  | "notify_control_owner_slack"
  | "notify_on_call_channel_slack"
  | "notify_leadership_channel_slack"
  | "create_jira_notify_owner_team"
  | "create_jira_ticket"
  | "schedule_auto_followup"
  | "draft_escalation_message"
  | "bridge_opened"
  | "tool_logs_opened"
  | "tool_debugger_opened"
  | "tool_traces_opened"
  | "tool_metrics_opened"
  | "tool_cloud_console_opened"
  | "tool_runbook_opened";

export type DemoIncidentOutreachState = {
  incidentId: string;
  label: string;
  details: string;
  timestamp: string;
};

export type DemoIncidentActionEntry = {
  id: string;
  incidentId: string;
  action: DemoIncidentAction;
  details: string;
  timestamp: string;
};

export function readDemoState(): Record<string, DemoIncidentState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, DemoIncidentState>;
    const next: Record<string, DemoIncidentState> = {};
    for (const [id, row] of Object.entries(parsed)) {
      next[id] = {
        ...row,
        incidentStatus: migrateLegacyIncidentStatus(row.incidentStatus)
      };
    }
    return next;
  } catch {
    return {};
  }
}

export function writeDemoState(state: Record<string, DemoIncidentState>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function setIncidentDemoState(incidentId: string, state: DemoIncidentState) {
  const current = readDemoState();
  current[incidentId] = state;
  writeDemoState(current);
  emitIncidentDemoEvent();
}

export function resetDemoState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(ACTION_LOG_KEY);
  window.localStorage.removeItem(OUTREACH_KEY);
  emitIncidentDemoEvent();
}

export function readIncidentActionLog(): DemoIncidentActionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACTION_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function appendIncidentActionLog(entry: DemoIncidentActionEntry) {
  if (typeof window === "undefined") return;
  const next = [entry, ...readIncidentActionLog()].slice(0, 100);
  window.localStorage.setItem(ACTION_LOG_KEY, JSON.stringify(next));
  emitIncidentDemoEvent();
}

export function readIncidentOutreachState(): Record<string, DemoIncidentOutreachState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OUTREACH_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function setIncidentOutreachState(incidentId: string, state: DemoIncidentOutreachState) {
  if (typeof window === "undefined") return;
  const current = readIncidentOutreachState();
  current[incidentId] = state;
  window.localStorage.setItem(OUTREACH_KEY, JSON.stringify(current));
  emitIncidentDemoEvent();
}

function emitIncidentDemoEvent() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INCIDENT_DEMO_EVENT));
}
