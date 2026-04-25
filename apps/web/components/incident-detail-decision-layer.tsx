"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  Bug,
  ChevronRight,
  FileText,
  HardDrive,
  Radio,
  Sparkles,
  UserCheck,
  Users,
  Wrench
} from "lucide-react";
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
import { cn } from "@/lib/cn";

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

type ResponseCommandTab = "slack" | "jira" | "routing" | "tools";

function slackRecipientRows(
  specialist: string,
  ownerTeam: string,
  channelLabel: string
): { name: string; handle: string; note: string }[] {
  const primary = specialist.includes(" - ")
    ? specialist.split(" - ")[0].trim()
    : specialist.trim();
  return [
    {
      name: primary,
      handle: `@${primary.toLowerCase().replace(/\s+/g, ".")}`,
      note: "Primary responder"
    },
    {
      name: `${ownerTeam || "Owner"} · on-call`,
      handle: "@oncall-governance",
      note: "Pager handoff"
    },
    {
      name: "Fleet liaison",
      handle: "@fleet-liaison",
      note: "Cross-system coordination"
    },
    {
      name: `${channelLabel} subscribers`,
      handle: "channel",
      note: "Thread + desktop push"
    }
  ];
}

function buildSlackDraftBody(params: {
  title: string;
  systemId: string;
  channel: string;
  template: string;
  assignedOwner: string;
  specialist: string;
  escalationLabel: string;
}): string {
  return [
    `*Incident* · ${params.escalationLabel}`,
    `*${params.title}*`,
    "",
    `• *System* \`${params.systemId}\``,
    `• *Owner lane* ${params.assignedOwner}`,
    `• *Responder* ${params.specialist}`,
    `• *Template* ${params.template}`,
    "",
    `_Draft — ready to post to ${params.channel}. Governed remediation remains approval-gated in Action Center._`
  ].join("\n");
}

function buildJiraDraft(params: {
  template: string;
  title: string;
  systemId: string;
  assignedOwner: string;
  specialist: string;
  priority: string;
}): { summary: string; description: string; labels: string[]; issueType: string } {
  const summary = `[${params.template}] ${params.title.slice(0, 72)}${params.title.length > 72 ? "…" : ""}`;
  const description = [
    `h2. Context`,
    `System: {{${params.systemId}}}`,
    `Owner: ${params.assignedOwner}`,
    `Responder: ${params.specialist}`,
    "",
    `h2. Acceptance`,
    "- Link Fleetrac incident and any Bob investigation",
    "- Document blast radius and rollback posture",
    "",
    `_Generated draft — policy-checked workflow applies._`
  ].join("\n");
  return {
    summary,
    description,
    labels: ["fleetrac", "governance", params.template.toLowerCase().replace(/\s+/g, "-")],
    issueType: params.template === "Leadership escalation" ? "Escalation" : "Task"
  };
}

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
  const [commandTab, setCommandTab] = useState<ResponseCommandTab>("slack");

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
  const slackRecipients = slackRecipientRows(
    specialist,
    incident.owner_team ?? "",
    selectedSlack.label
  );
  const slackDraftBody = buildSlackDraftBody({
    title: incident.title,
    systemId: incident.system_id,
    channel: selectedSlack.channel,
    template: selectedSlack.template,
    assignedOwner,
    specialist,
    escalationLabel: jiraPriorityLabel
  });
  const jiraDraft = buildJiraDraft({
    template: jiraTemplate,
    title: incident.title,
    systemId: incident.system_id,
    assignedOwner,
    specialist,
    priority: jiraPriorityLabel
  });

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
            caption="Tabbed session console — draft Slack and Jira payloads here; demo-only sends, governed execution in Action Center."
            action={<PiFlowArrowBold className="h-4 w-4 text-slate-500" />}
          />
          {actionToast ? (
            <div className="mt-2 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-medium text-indigo-900">
              {actionToast}
            </div>
          ) : null}

          {/* Mini-window: fixed viewport height so layout stays stable across tabs */}
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white shadow-[0_1px_0_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.04]">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-950/[0.03] px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Session console
                </p>
                <p className="truncate text-[11px] text-slate-600" title={statusSummary}>
                  {statusSummary}
                </p>
              </div>
              <span className="shrink-0 rounded border border-slate-200/80 bg-white px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
                LIVE
              </span>
            </div>

            <div className="flex gap-0.5 border-b border-slate-200/80 bg-slate-100/90 p-1">
              <CommandTabButton
                active={commandTab === "slack"}
                onClick={() => setCommandTab("slack")}
                icon={SiSlack}
                label="Slack"
                accent="slack"
              />
              <CommandTabButton
                active={commandTab === "jira"}
                onClick={() => setCommandTab("jira")}
                icon={SiJira}
                label="Jira"
                accent="jira"
              />
              <CommandTabButton
                active={commandTab === "routing"}
                onClick={() => setCommandTab("routing")}
                icon={Radio}
                label="Routing"
                accent="neutral"
              />
              <CommandTabButton
                active={commandTab === "tools"}
                onClick={() => setCommandTab("tools")}
                icon={Wrench}
                label="Tools"
                accent="neutral"
              />
            </div>

            <div className="min-h-[288px] max-h-[min(42vh,20rem)] overflow-y-auto overscroll-contain px-3 py-3">
              {commandTab === "slack" ? (
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Destination
                    </span>
                    <Select
                      value={slackTarget}
                      onChange={(e) => setSlackTarget(e.target.value)}
                      className="h-8 w-full"
                    >
                      {slackOptions.map((option) => (
                        <option key={option.channel} value={option.channel}>
                          {option.label} · {option.channel}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Recipients (model)
                    </span>
                    <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                      {slackRecipients.map((row, idx) => (
                        <li
                          key={`${row.name}-${idx}`}
                          className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-2 py-1.5 shadow-sm"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#4A154B]/10 text-[10px] font-bold text-[#4A154B]">
                            {row.name.slice(0, 1)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-medium text-slate-900">{row.name}</p>
                            <p className="truncate font-mono text-[10px] text-slate-500">{row.handle}</p>
                            <p className="text-[9px] text-slate-400">{row.note}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-[#1a1d21] shadow-inner">
                    <div className="flex items-center gap-2 border-b border-white/10 px-2.5 py-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400/90" aria-hidden />
                      <span className="font-mono text-[10px] text-slate-400">
                        Draft · {selectedSlack.channel}
                      </span>
                    </div>
                    <div className="border-l-2 border-[#611f69] bg-[#222529] px-3 py-2">
                      <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-100">
                        {slackDraftBody}
                      </pre>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <SmallButton
                      icon={SiSlack}
                      label="Send to channel"
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
                  </div>
                </div>
              ) : null}

              {commandTab === "jira" ? (
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Template
                    </span>
                    <Select
                      value={jiraTemplate}
                      onChange={(e) => setJiraTemplate(e.target.value)}
                      className="h-8 w-full"
                    >
                      {jiraTemplates.map((template) => (
                        <option key={template}>{template}</option>
                      ))}
                    </Select>
                  </label>
                  <div className="space-y-2 rounded-lg border border-[#0052CC]/25 bg-gradient-to-br from-sky-50/80 to-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                        {jiraDraft.issueType}
                      </span>
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                        {jiraPriorityLabel}
                      </span>
                      {jiraDraft.labels.map((lb) => (
                        <span
                          key={lb}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-medium text-slate-600"
                        >
                          {lb}
                        </span>
                      ))}
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Summary
                      </span>
                      <p className="mt-0.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-medium text-slate-900">
                        {jiraDraft.summary}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Description
                      </span>
                      <div className="mt-0.5 max-h-36 overflow-y-auto rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-[11px] leading-snug text-slate-700">
                        {jiraDraft.description}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Options: create the ticket only, or create and notify the Slack destination
                      configured in the Slack tab ({selectedSlack.channel}).
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <SmallButton
                      icon={SiJira}
                      label="Create ticket"
                      tone="jira"
                      onClick={() => createJira(false)}
                    />
                    <SmallButton
                      icon={SiSlack}
                      label="Create + Slack"
                      tone="slack"
                      onClick={() => createJira(true)}
                    />
                  </div>
                </div>
              ) : null}

              {commandTab === "routing" ? (
                <RoutingTabContent
                  incidentTitle={incident.title}
                  incidentOwnerTeam={incident.owner_team}
                  investigationHref={investigationHref}
                  responseLane={responseLane}
                  setResponseLane={setResponseLane}
                  assignedOwner={assignedOwner}
                  setAssignedOwner={setAssignedOwner}
                  specialist={specialist}
                  setSpecialist={setSpecialist}
                  runResponseAction={runResponseAction}
                  lastOutreach={lastOutreach}
                  onGoSlack={() => setCommandTab("slack")}
                  onGoJira={() => setCommandTab("jira")}
                />
              ) : null}

              {commandTab === "tools" ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-600">
                    Observability shortcuts — same session logging as before.
                  </p>
                  <ToolRow>
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
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-200/80 bg-slate-50/80 px-2.5 py-1.5">
              <p className="truncate text-[10px] text-slate-500">
                Last step · {latestStatus}
              </p>
              <p className="mt-0.5 text-[9px] leading-snug text-slate-400">
                Bob is bounded, policy-checked, approval-gated, and audit-linked; governed execution
                only through Action Center.
              </p>
            </div>
          </div>
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

function RoutingTabContent({
  incidentTitle,
  incidentOwnerTeam,
  investigationHref,
  responseLane,
  setResponseLane,
  assignedOwner,
  setAssignedOwner,
  specialist,
  setSpecialist,
  runResponseAction,
  lastOutreach,
  onGoSlack,
  onGoJira
}: {
  incidentTitle: string;
  incidentOwnerTeam: string;
  investigationHref: string;
  responseLane: "fleet" | "bob";
  setResponseLane: (v: "fleet" | "bob") => void;
  assignedOwner: string;
  setAssignedOwner: (v: string) => void;
  specialist: string;
  setSpecialist: (v: string) => void;
  runResponseAction: (p: ResponsePayload) => void;
  lastOutreach: DemoIncidentOutreachState | null;
  onGoSlack: () => void;
  onGoJira: () => void;
}) {
  const ownerMeta =
    ownerOptions.find((o) => o.value === assignedOwner) ?? ownerOptions[0];
  const responderShort = specialist.includes(" - ")
    ? specialist.split(" - ")[0].trim()
    : specialist.trim();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-3 py-2.5 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Live routing map
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-800">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              responseLane === "fleet"
                ? "bg-slate-900 text-white"
                : "bg-indigo-600 text-white"
            )}
          >
            {responseLane === "fleet" ? "Fleet lane" : "Bob lane"}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          <span className="font-semibold text-slate-900">{assignedOwner}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          <span className="text-slate-700">{responderShort}</span>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
          {responseLane === "fleet"
            ? "Human fleet owns acknowledgement, comms, and bridge — Bob stays optional for analysis."
            : "Bob prepares bounded findings; fleet still approves governed changes in Action Center."}
        </p>
      </div>

      <section className="space-y-2" aria-labelledby="routing-step-1">
        <RoutingStepHeading
          id="routing-step-1"
          step={1}
          title="Choose response lane"
          hint="Pick who drives the incident thread — you can switch later."
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            role="radio"
            aria-checked={responseLane === "fleet"}
            onClick={() => {
              setResponseLane("fleet");
              const owner = incidentOwnerTeam?.trim() || "Security Operations";
              setAssignedOwner(owner);
              runResponseAction({
                action: "owner_assigned",
                label: `Response lane: fleet · ${owner}`,
                details: `Human fleet ownership confirmed for "${incidentTitle}" (${owner}).`,
                status: `Response assigned to fleet · ${owner}`
              });
            }}
            className={cn(
              "rounded-lg border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
              responseLane === "fleet"
                ? "border-slate-900 bg-slate-900 text-white shadow-md ring-1 ring-slate-900/20"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
            )}
          >
            <div className="flex items-center gap-2">
              <Users
                className={cn(
                  "h-4 w-4 shrink-0",
                  responseLane === "fleet" ? "text-white" : "text-slate-500"
                )}
              />
              <span className="text-[12px] font-bold">Fleet response</span>
            </div>
            <p
              className={cn(
                "mt-1.5 text-[10px] leading-relaxed",
                responseLane === "fleet" ? "text-slate-200" : "text-slate-500"
              )}
            >
              SOC / owner teams run Slack, bridge, and human decisions. Aligns with{" "}
              <span className="font-medium">{incidentOwnerTeam || "catalog owner"}</span>.
            </p>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={responseLane === "bob"}
            onClick={() => {
              setResponseLane("bob");
              setAssignedOwner("Bob Copilot");
              runResponseAction({
                action: "bob_queue_assigned",
                label: "Response lane: Bob Copilot",
                details: `Incident "${incidentTitle}" routed to Bob's bounded investigation queue; recommendations remain policy-checked and approval-gated.`,
                status: "Response assigned to Bob queue (bounded)"
              });
            }}
            className={cn(
              "rounded-lg border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
              responseLane === "bob"
                ? "border-indigo-600 bg-indigo-600 text-white shadow-md ring-1 ring-indigo-500/25"
                : "border-indigo-100 bg-indigo-50/40 hover:border-indigo-200 hover:bg-indigo-50"
            )}
          >
            <div className="flex items-center gap-2">
              <Sparkles
                className={cn(
                  "h-4 w-4 shrink-0",
                  responseLane === "bob" ? "text-white" : "text-indigo-600"
                )}
              />
              <span className="text-[12px] font-bold">Bob-assisted</span>
            </div>
            <p
              className={cn(
                "mt-1.5 text-[10px] leading-relaxed",
                responseLane === "bob" ? "text-indigo-100" : "text-indigo-900/80"
              )}
            >
              Route triage through Bob&apos;s bounded queue — still approval-gated and audit-linked for
              actions.
            </p>
          </button>
        </div>
      </section>

      <section className="space-y-2 border-t border-slate-100 pt-3" aria-labelledby="routing-step-2">
        <RoutingStepHeading
          id="routing-step-2"
          step={2}
          title="Assign accountability"
          hint="Accountable owner signs off scope; use catalog default or reassign."
        />
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Owner lane
          </span>
          <div className="flex flex-wrap items-stretch gap-2">
            <Select
              value={assignedOwner}
              onChange={(e) => {
                const owner = e.target.value;
                setAssignedOwner(owner);
                runResponseAction({
                  action: "owner_assigned",
                  label: `Owner assigned: ${owner}`,
                  details: `Incident "${incidentTitle}" assigned to ${owner}.`,
                  status: `Assigned owner: ${owner}`
                });
              }}
              className="h-9 min-w-[12rem] flex-1"
            >
              {ownerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value}
                </option>
              ))}
            </Select>
            <button
              type="button"
              onClick={() => {
                setAssignedOwner("On-call engineer");
                setSpecialist("Sam Rivera - on-call engineer");
                runResponseAction({
                  action: "owner_assigned",
                  label: "Assigned to current operator",
                  details: `Incident "${incidentTitle}" assigned to current operator.`,
                  status: "Assigned owner: current operator"
                });
              }}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
            >
              <UserCheck className="h-3.5 w-3.5 text-slate-500" />
              I&apos;m on point
            </button>
          </div>
          <p className="text-[10px] leading-snug text-slate-500">{ownerMeta.detail}</p>
        </label>
      </section>

      <section className="space-y-2 border-t border-slate-100 pt-3" aria-labelledby="routing-step-3">
        <RoutingStepHeading
          id="routing-step-3"
          step={3}
          title="Name the coordinator"
          hint="Who runs the bridge and follow-ups — distinct from owner sign-off."
        />
        <div className="flex flex-wrap items-stretch gap-2">
          <label className="min-w-0 flex-1 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Active responder
            </span>
            <Select
              value={specialist}
              onChange={(e) => {
                const person = e.target.value;
                setSpecialist(person);
                runResponseAction({
                  action: "specialist_assigned",
                  label: `Responder assigned: ${person}`,
                  details: `Incident "${incidentTitle}" assigned to ${person} for response coordination.`,
                  status: `Responder selected: ${person}`
                });
              }}
              className="h-9 w-full"
            >
              {peopleOptions.map((person) => (
                <option key={person}>{person}</option>
              ))}
            </Select>
          </label>
          <div className="flex shrink-0 flex-col justify-end">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Analysis
            </span>
            <Link
              href={investigationHref}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 text-[11px] font-semibold text-indigo-900 transition hover:border-indigo-300 hover:bg-indigo-100"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Open Bob
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-2 border-t border-slate-100 pt-3" aria-labelledby="routing-step-4">
        <RoutingStepHeading
          id="routing-step-4"
          step={4}
          title="Lock coordination"
          hint="Confirm routing for the audit trail, then spin up a bridge if needed."
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <SmallButton
            icon={Bell}
            label="Confirm owner in audit trail"
            onClick={() =>
              runResponseAction({
                action: "owner_assigned",
                label: `Owner confirmed: ${assignedOwner}`,
                details: `Ownership confirmed as ${assignedOwner} for "${incidentTitle}".`,
                status: `Owner confirmed: ${assignedOwner}`
              })
            }
          />
          <SmallButton
            icon={PiFlowArrowBold}
            label="Open war-room bridge"
            onClick={() =>
              runResponseAction({
                action: "bridge_opened",
                label: "Incident bridge opened",
                details: `Incident bridge opened for "${incidentTitle}" with ${assignedOwner} and ${specialist}.`,
                status: "Incident bridge opened",
                outreachLabel: "Incident bridge opened"
              })
            }
          />
        </div>
      </section>

      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Next in workflow
        </p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onGoSlack}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-800 shadow-sm transition hover:border-slate-300"
          >
            <SiSlack className="h-3.5 w-3.5 text-[#4A154B]" />
            Draft Slack notify
            <ChevronRight className="h-3 w-3 opacity-50" />
          </button>
          <button
            type="button"
            onClick={onGoJira}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-800 shadow-sm transition hover:border-slate-300"
          >
            <SiJira className="h-3.5 w-3.5 text-[#0052CC]" />
            Open Jira draft
            <ChevronRight className="h-3 w-3 opacity-50" />
          </button>
        </div>
      </div>

      {lastOutreach ? (
        <p className="text-[10px] text-slate-500">
          <span className="font-medium text-slate-600">Last outreach:</span> {lastOutreach.label} ·{" "}
          {formatRelativeTime(lastOutreach.timestamp)}
        </p>
      ) : (
        <p className="text-[10px] text-slate-400">No outreach logged yet this session.</p>
      )}
    </div>
  );
}

function RoutingStepHeading({
  id,
  step,
  title,
  hint
}: {
  id: string;
  step: number;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex gap-2">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white"
        aria-hidden
      >
        {step}
      </span>
      <div className="min-w-0">
        <h3 id={id} className="text-[11px] font-bold text-slate-900">
          {title}
        </h3>
        <p className="text-[10px] leading-relaxed text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

function CommandTabButton({
  active,
  onClick,
  icon: Icon,
  label,
  accent
}: {
  active: boolean;
  onClick: () => void;
  icon: ComponentType<{ className?: string }>;
  label: string;
  accent: "slack" | "jira" | "neutral";
}) {
  const surface =
    accent === "slack" && active
      ? "border-[#4A154B]/40 bg-[#4A154B] text-white shadow-md shadow-[#4A154B]/25"
      : accent === "jira" && active
        ? "border-[#0052CC]/40 bg-[#0052CC] text-white shadow-md shadow-sky-600/20"
        : active
          ? "border-slate-300 bg-white text-slate-900 shadow-sm"
          : "border-transparent text-slate-500 hover:bg-white/70 hover:text-slate-800";
  const iconClass =
    active && accent === "slack"
      ? "text-white"
      : active && accent === "jira"
        ? "text-white"
        : active
          ? "text-slate-700"
          : accent === "slack"
            ? "text-[#4A154B]"
            : accent === "jira"
              ? "text-[#0052CC]"
              : "text-slate-400";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md border px-1.5 py-1.5 text-[10px] font-semibold transition sm:text-[11px] ${surface}`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} />
      <span className="truncate">{label}</span>
    </button>
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
