"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import { Activity, Bell, Bug, HardDrive, UserCheck, FileText } from "lucide-react";
import { PiFlowArrowBold } from "react-icons/pi";
import { SiJira, SiSlack } from "react-icons/si";
import type { ActivityItem } from "@/components/activity-feed";
import { IncidentDetailActivityFeed } from "@/components/incident-detail-activity-feed";
import { IncidentResponseProgress } from "@/components/incident-response-progress";
import { IncidentWorkflowPanel } from "@/components/incident-workflow-panel";
import { DisclosureSection } from "@/components/shared/disclosure-section";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  INCIDENT_DEMO_EVENT,
  appendIncidentActionLog,
  readDemoState,
  readIncidentOutreachState,
  setIncidentOutreachState,
  type DemoIncidentOutreachState,
  type DemoIncidentAction
} from "@/lib/demo-state";
import { migrateLegacyIncidentStatus } from "@/lib/incident-lifecycle";
import { formatRelativeTime } from "@/lib/format";

type Props = {
  incident: {
    id: string;
    title: string;
    owner_team: string;
    system_id: string;
  };
  initialIncidentStatus: string;
  initialEscalationStatus: string;
  initialReviewRequired: boolean;
  investigationHref: string;
  actionHref: string;
  activityInitialItems: ActivityItem[];
};

type LocalState = {
  incidentStatus: string;
  escalationStatus: string;
  reviewRequired: boolean;
};

type ResponsePayload = {
  action: DemoIncidentAction;
  label: string;
  details: string;
  status: string;
  outreachLabel?: string;
};

const ownerOptions = [
  { value: "Security Operations", detail: "Primary triage and containment" },
  { value: "System owner", detail: "Service context and rollback authority" },
  { value: "Control owner", detail: "Policy and threshold accountability" },
  { value: "On-call engineer", detail: "Runtime investigation and mitigation" },
  { value: "Bob Copilot", detail: "Bounded diagnosis and governed recommendation" }
];

const peopleOptions = [
  "Maya Chen - SOC lead",
  "Jordan Patel - system owner",
  "Avery Brooks - policy owner",
  "Sam Rivera - on-call engineer",
  "Riley Morgan - incident commander"
];

const slackOptions = [
  {
    action: "notify_owner_team_slack" as DemoIncidentAction,
    label: "Owner team",
    channel: "#security-operations",
    template: "Triage summary with recommended action"
  },
  {
    action: "notify_system_owner_slack" as DemoIncidentAction,
    label: "System owner",
    channel: "#m50-pep-screening",
    template: "System impact and requested owner response"
  },
  {
    action: "notify_control_owner_slack" as DemoIncidentAction,
    label: "Control owner",
    channel: "#governance-controls",
    template: "Rule breach, threshold, and audit context"
  },
  {
    action: "notify_on_call_channel_slack" as DemoIncidentAction,
    label: "On-call",
    channel: "#on-call-ai",
    template: "Immediate containment request"
  },
  {
    action: "notify_leadership_channel_slack" as DemoIncidentAction,
    label: "Leadership",
    channel: "#leadership-incidents",
    template: "Escalation brief and approval ask"
  }
];

const jiraTemplates = [
  "Security investigation",
  "Policy control review",
  "Production mitigation",
  "Evidence collection",
  "Leadership escalation"
];

export function IncidentDetailDecisionLayer({
  incident,
  initialIncidentStatus,
  initialEscalationStatus,
  initialReviewRequired,
  investigationHref,
  actionHref,
  activityInitialItems
}: Props) {
  const [localState, setLocalState] = useState<LocalState>({
    incidentStatus: migrateLegacyIncidentStatus(initialIncidentStatus),
    escalationStatus: initialEscalationStatus,
    reviewRequired: initialReviewRequired
  });
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [lastOutreach, setLastOutreach] = useState<DemoIncidentOutreachState | null>(null);
  const [assignedOwner, setAssignedOwner] = useState(
    incident.owner_team?.trim() || "Security Operations"
  );
  const [responseLane, setResponseLane] = useState<"fleet" | "bob">("fleet");
  const [specialist, setSpecialist] = useState("Maya Chen - SOC lead");
  const [slackTarget, setSlackTarget] = useState(slackOptions[0].channel);
  const [jiraTemplate, setJiraTemplate] = useState(jiraTemplates[0]);
  const [latestStatus, setLatestStatus] = useState("No response actions taken yet");

  useEffect(() => {
    const sync = () => {
      const stored = readDemoState()[incident.id];
      if (stored) setLocalState(stored);
      const outreach = readIncidentOutreachState()[incident.id] ?? null;
      setLastOutreach(outreach);
    };
    sync();
    window.addEventListener(INCIDENT_DEMO_EVENT, sync as EventListener);
    return () => window.removeEventListener(INCIDENT_DEMO_EVENT, sync as EventListener);
  }, [incident.id]);

  const selectedSlack = slackOptions.find((item) => item.channel === slackTarget) ?? slackOptions[0];

  const responderShort =
    specialist.includes(" - ") ? specialist.split(" - ")[0].trim() : specialist;
  const jiraPriorityLabel = localState.escalationStatus === "escalated" ? "P1" : "P2";
  const statusSummary = `Owner: ${assignedOwner} · Responder: ${responderShort} · Slack: ${selectedSlack.channel} · Jira: ${jiraPriorityLabel}`;

  const notifySuccess = (message: string) => {
    setActionToast(message);
    window.setTimeout(() => setActionToast(null), 2600);
  };

  const runResponseAction = (payload: ResponsePayload) => {
    const timestamp = new Date().toISOString();
    appendIncidentActionLog({
      id: `demo_live_${incident.id}_${Date.now()}`,
      incidentId: incident.id,
      action: payload.action,
      details: payload.details,
      timestamp
    });
    if (payload.outreachLabel) {
      const outreach = {
        incidentId: incident.id,
        label: payload.outreachLabel,
        details: payload.details,
        timestamp
      };
      setIncidentOutreachState(incident.id, outreach);
      setLastOutreach(outreach);
    }
    setLatestStatus(payload.status);
    notifySuccess(payload.status);
  };

  const onActionComplete = (next: {
    action: DemoIncidentAction;
    incidentStatus: string;
    escalationStatus: string;
    reviewRequired: boolean;
  }) => {
    setLocalState({
      incidentStatus: migrateLegacyIncidentStatus(next.incidentStatus),
      escalationStatus: next.escalationStatus,
      reviewRequired: next.reviewRequired
    });
    const messages: Partial<Record<DemoIncidentAction, string>> = {
      confirm_incident: "Operator command accepted: incident acknowledged and routed to review.",
      mark_false_positive: "Operator command accepted: false positive recorded and incident closed.",
      escalate_incident: "Operator command accepted: escalation path activated.",
      resolve_incident: "Operator command accepted: mitigation logged and incident closed."
    };
    const message = messages[next.action] ?? "Operator command accepted.";
    setActionToast(message);
    setLatestStatus(message);
    window.setTimeout(() => setActionToast(null), 2600);
  };

  const createJira = (notify = false) => {
    const key = jiraTemplate === "Leadership escalation" ? "GOV-911" : "GOV-142";
    runResponseAction({
      action: notify ? "create_jira_notify_owner_team" : "create_jira_ticket",
      label: notify ? `Jira ${key} + Slack` : `Jira ${key} created`,
      details: `${jiraTemplate} Jira ticket ${key} prepared for "${incident.title}" with owner ${assignedOwner}${notify ? ` and Slack notice to ${selectedSlack.channel}` : ""}.`,
      status: notify
        ? `Jira ${key} created and ${selectedSlack.channel} notified`
        : `Jira ${key} created from ${jiraTemplate.toLowerCase()} template`,
      outreachLabel: notify ? `Jira ${key} created and ${selectedSlack.label} notified` : undefined
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card surface="decision" className="border-slate-200 bg-white ring-1 ring-slate-900/5">
          <CardHeader
            title="Response command center"
            caption="Session actions are demo-only; governed execution stays approval-gated in Action Center."
            action={<PiFlowArrowBold className="h-4 w-4 text-slate-500" />}
          />
          {actionToast ? (
            <div className="mt-2 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-medium text-indigo-900">
              {actionToast}
            </div>
          ) : null}

          <p className="mt-3 text-[12px] leading-relaxed text-slate-800">{statusSummary}</p>
          <p className="mt-1 text-[10px] text-slate-500">Last session step · {latestStatus}</p>

          <details className="mt-3 rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2">
            <summary className="cursor-pointer text-[11px] font-medium text-slate-700 hover:text-slate-900">
              Change routing targets
            </summary>
            <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setResponseLane("fleet");
                    const owner = incident.owner_team?.trim() || "Security Operations";
                    setAssignedOwner(owner);
                    runResponseAction({
                      action: "owner_assigned",
                      label: `Response lane: fleet · ${owner}`,
                      details: `Human fleet ownership confirmed for "${incident.title}" (${owner}).`,
                      status: `Response assigned to fleet · ${owner}`
                    });
                  }}
                  className={`inline-flex h-8 items-center rounded-md border px-2.5 text-[11px] font-semibold transition ${
                    responseLane === "fleet"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                  }`}
                >
                  Fleet owner
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResponseLane("bob");
                    setAssignedOwner("Bob Copilot");
                    runResponseAction({
                      action: "bob_queue_assigned",
                      label: "Response lane: Bob Copilot",
                      details: `Incident "${incident.title}" routed to Bob’s bounded investigation queue; recommendations remain policy-checked and approval-gated.`,
                      status: "Response assigned to Bob queue (bounded)"
                    });
                  }}
                  className={`inline-flex h-8 items-center rounded-md border px-2.5 text-[11px] font-semibold transition ${
                    responseLane === "bob"
                      ? "border-indigo-700 bg-indigo-700 text-white"
                      : "border-indigo-200 bg-indigo-50 text-indigo-900 hover:border-indigo-300"
                  }`}
                >
                  Bob queue
                </button>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Assign owner
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={assignedOwner}
                      onChange={(e) => {
                        const owner = e.target.value;
                        setAssignedOwner(owner);
                        runResponseAction({
                          action: "owner_assigned",
                          label: `Owner assigned: ${owner}`,
                          details: `Incident "${incident.title}" assigned to ${owner}.`,
                          status: `Assigned owner: ${owner}`
                        });
                      }}
                      className="h-8 w-full"
                    >
                      {ownerOptions.map((option) => (
                        <option key={option.value}>{option.value}</option>
                      ))}
                    </Select>
                    <SmallButton
                      icon={UserCheck}
                      label="Assign to me"
                      onClick={() => {
                        setAssignedOwner("On-call engineer");
                        setSpecialist("Sam Rivera - on-call engineer");
                        runResponseAction({
                          action: "owner_assigned",
                          label: "Assigned to current operator",
                          details: `Incident "${incident.title}" assigned to current operator.`,
                          status: "Assigned owner: current operator"
                        });
                      }}
                    />
                  </div>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Named responder
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={specialist}
                      onChange={(e) => {
                        const person = e.target.value;
                        setSpecialist(person);
                        runResponseAction({
                          action: "specialist_assigned",
                          label: `Responder assigned: ${person}`,
                          details: `Incident "${incident.title}" assigned to ${person} for response coordination.`,
                          status: `Responder selected: ${person}`
                        });
                      }}
                      className="h-8 w-full"
                    >
                      {peopleOptions.map((person) => (
                        <option key={person}>{person}</option>
                      ))}
                    </Select>
                    <Link
                      href={investigationHref}
                      className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md border border-indigo-200 bg-indigo-50 px-2 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-100"
                    >
                      Route to Bob
                    </Link>
                  </div>
                </label>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <Select
                  value={slackTarget}
                  onChange={(e) => setSlackTarget(e.target.value)}
                  className="h-8 min-w-[200px] flex-1"
                >
                  {slackOptions.map((option) => (
                    <option key={option.channel} value={option.channel}>
                      {option.label} · {option.channel}
                    </option>
                  ))}
                </Select>
                <Select
                  value={jiraTemplate}
                  onChange={(e) => setJiraTemplate(e.target.value)}
                  className="h-8 min-w-[200px] flex-1"
                >
                  {jiraTemplates.map((template) => (
                    <option key={template}>{template}</option>
                  ))}
                </Select>
              </div>
              {lastOutreach ? (
                <p className="text-[10px] text-slate-500">
                  Last outreach: {lastOutreach.label} · {formatRelativeTime(lastOutreach.timestamp)}
                </p>
              ) : null}
            </div>
          </details>

          <div className="mt-4 flex flex-wrap gap-1.5">
            <SmallButton
              icon={SiSlack}
              label="Send Slack"
              tone="slack"
              onClick={() =>
                runResponseAction({
                  action: selectedSlack.action,
                  label: `Slack sent: ${selectedSlack.channel}`,
                  details: `Slack alert delivered to ${selectedSlack.channel} for "${incident.title}" using ${selectedSlack.template.toLowerCase()} template.`,
                  status: `Slack alert sent to ${selectedSlack.channel}`,
                  outreachLabel: `Slack alert to ${selectedSlack.label}`
                })
              }
            />
            <SmallButton icon={SiJira} label="Create Jira" tone="jira" onClick={() => createJira(false)} />
            <SmallButton
              icon={Bell}
              label="Assign owner"
              onClick={() =>
                runResponseAction({
                  action: "owner_assigned",
                  label: `Owner confirmed: ${assignedOwner}`,
                  details: `Ownership confirmed as ${assignedOwner} for "${incident.title}".`,
                  status: `Owner confirmed: ${assignedOwner}`
                })
              }
            />
            <SmallButton
              icon={PiFlowArrowBold}
              label="Open bridge"
              onClick={() =>
                runResponseAction({
                  action: "bridge_opened",
                  label: "Incident bridge opened",
                  details: `Incident bridge opened for "${incident.title}" with ${assignedOwner} and ${specialist}.`,
                  status: "Incident bridge opened",
                  outreachLabel: "Incident bridge opened"
                })
              }
            />
          </div>

          <ToolRow className="mt-4">
            <ToolLauncher
              icon={HardDrive}
              label="Logs"
              onClick={() =>
                runResponseAction({
                  action: "tool_logs_opened",
                  label: "Open logs",
                  details: `Operator opened logs view for "${incident.title}".`,
                  status: "Opened logs view"
                })
              }
            />
            <ToolLauncher
              icon={Bug}
              label="Debugger"
              onClick={() =>
                runResponseAction({
                  action: "tool_debugger_opened",
                  label: "Open debugger",
                  details: `Operator opened debugger for "${incident.title}".`,
                  status: "Opened debugger"
                })
              }
            />
            <ToolLauncher
              icon={Activity}
              label="Traces"
              onClick={() =>
                runResponseAction({
                  action: "tool_traces_opened",
                  label: "Open traces",
                  details: `Operator opened traces view for "${incident.title}".`,
                  status: "Opened traces view"
                })
              }
            />
            <ToolLauncher
              icon={FileText}
              label="Runbook"
              onClick={() =>
                runResponseAction({
                  action: "tool_runbook_opened",
                  label: "Open runbook",
                  details: `Operator opened incident runbook for "${incident.title}".`,
                  status: "Opened runbook"
                })
              }
            />
          </ToolRow>
          <p className="mt-3 text-[10px] text-slate-500">
            Bob is bounded and policy-aware; governed execution only through Action Center.
          </p>
        </Card>

        <Card surface="support" className="border-slate-200 bg-white lg:min-h-0">
          <CardHeader
            title="Recent activity"
            caption="Audit plus this session’s response commands — newest first."
          />
          <IncidentResponseProgress incidentStatus={localState.incidentStatus} />
          <div className="mt-3 max-h-[min(42vh,22rem)] overflow-y-auto pr-0.5">
            <IncidentDetailActivityFeed
              incidentId={incident.id}
              initialItems={activityInitialItems}
              compact
              newestFirst
              limit={14}
            />
          </div>
        </Card>
      </div>

      <DisclosureSection
        defaultOpen={false}
        eyebrow="Lifecycle"
        title="Lifecycle triage"
        summary="Acknowledge, escalate, resolve, or close — demo session state only."
        bodyClassName="pt-3"
      >
        <IncidentWorkflowPanel
          incidentId={incident.id}
          incidentTitle={incident.title}
          ownerTeam={incident.owner_team}
          initialIncidentStatus={initialIncidentStatus}
          initialEscalationStatus={initialEscalationStatus}
          initialReviewRequired={initialReviewRequired}
          embedded
          onActionComplete={onActionComplete}
          onOutreachComplete={(next) => {
            setActionToast(`Outreach sent: ${next.label}.`);
            setLastOutreach({
              incidentId: incident.id,
              label: next.label,
              details: next.details,
              timestamp: next.timestamp
            });
            setLatestStatus(`Outreach sent: ${next.label}.`);
            window.setTimeout(() => setActionToast(null), 2600);
          }}
        />
      </DisclosureSection>
    </div>
  );
}

function ToolRow({
  title,
  children,
  className
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-md border border-slate-200 bg-white px-2 py-1.5 ${className ?? ""}`}>
      {title ? (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">{children}</div>
        </>
      ) : (
        <div className="flex flex-wrap gap-1.5">{children}</div>
      )}
    </div>
  );
}

function SmallButton({
  icon: Icon,
  label,
  onClick,
  tone = "neutral"
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "slack" | "jira";
}) {
  const toneClass =
    tone === "slack"
      ? "border-[#4A154B]/35 bg-[#4A154B] text-white hover:border-[#4A154B] hover:bg-[#3E1140]"
      : tone === "jira"
        ? "border-[#0052CC]/35 bg-[#0052CC] text-white hover:border-[#0052CC] hover:bg-[#0047B3]"
        : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50";
  const iconTone = tone === "neutral" ? "text-slate-500" : "text-white";
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition ${toneClass}`}
    >
      <Icon className={`h-3.5 w-3.5 ${iconTone}`} />
      {label}
    </button>
  );
}

function ToolLauncher({
  icon: Icon,
  label,
  onClick
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
    >
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      {label}
    </button>
  );
}
