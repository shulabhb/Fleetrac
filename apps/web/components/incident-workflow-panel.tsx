"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Flag,
  MessageSquareShare,
  ShieldCheck,
  XCircle
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import {
  appendIncidentActionLog,
  setIncidentOutreachState,
  readDemoState,
  setIncidentDemoState,
  type DemoIncidentAction
} from "@/lib/demo-state";
import {
  migrateLegacyIncidentStatus,
  type IncidentLifecycleStatus
} from "@/lib/incident-lifecycle";
import { humanizeLabel, lifecycleBadgeClasses } from "@/lib/present";

type WorkflowPanelProps = {
  incidentId: string;
  incidentTitle: string;
  ownerTeam: string;
  initialIncidentStatus: string;
  initialEscalationStatus: string;
  initialReviewRequired: boolean;
  /** Omit outer Card when nested inside another surface (e.g. incident detail). */
  embedded?: boolean;
  onActionComplete?: (next: {
    action: DemoIncidentAction;
    incidentStatus: string;
    escalationStatus: string;
    reviewRequired: boolean;
    timestamp: string;
  }) => void;
  onOutreachComplete?: (next: {
    action: DemoIncidentAction;
    label: string;
    details: string;
    timestamp: string;
  }) => void;
};

export function IncidentWorkflowPanel({
  incidentId,
  incidentTitle,
  ownerTeam,
  initialIncidentStatus,
  initialEscalationStatus,
  initialReviewRequired,
  embedded = false,
  onActionComplete,
  onOutreachComplete
}: WorkflowPanelProps) {
  const saved = typeof window !== "undefined" ? readDemoState()[incidentId] : undefined;
  const [incidentStatus, setIncidentStatus] = useState<IncidentLifecycleStatus>(
    migrateLegacyIncidentStatus(saved?.incidentStatus ?? initialIncidentStatus)
  );
  const [escalationStatus, setEscalationStatus] = useState(
    saved?.escalationStatus ?? initialEscalationStatus
  );
  const [reviewRequired, setReviewRequired] = useState(
    saved?.reviewRequired ?? initialReviewRequired
  );
  const [pendingAction, setPendingAction] = useState<DemoIncidentAction | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [outreachOpen, setOutreachOpen] = useState(false);

  const helperText = useMemo(() => {
    if (incidentStatus === "closed") return "Closed in this demo session.";
    if (incidentStatus === "pending") return "Awaiting reviewer decision or verification.";
    if (escalationStatus === "escalated") return "Escalated to leadership workflow.";
    return "Active triage — command lane in progress.";
  }, [incidentStatus, escalationStatus]);

  const apply = async (
    action: DemoIncidentAction,
    patch: {
      incidentStatus: IncidentLifecycleStatus;
      escalationStatus: string;
      reviewRequired: boolean;
      details: string;
      confirmation: string;
    }
  ) => {
    setPendingAction(action);
    await new Promise((r) => setTimeout(r, 220));
    const timestamp = new Date().toISOString();
    const nextState = {
      incidentStatus: patch.incidentStatus,
      escalationStatus: patch.escalationStatus,
      reviewRequired: patch.reviewRequired
    };
    setIncidentStatus(nextState.incidentStatus);
    setEscalationStatus(nextState.escalationStatus);
    setReviewRequired(nextState.reviewRequired);
    setIncidentDemoState(incidentId, nextState);
    appendIncidentActionLog({
      id: `demo_${incidentId}_${Date.now()}`,
      incidentId,
      action,
      details: patch.details,
      timestamp
    });
    setLastResult(patch.confirmation);
    setPendingAction(null);
    onActionComplete?.({ action, ...nextState, timestamp });
  };

  const outreachActions: {
    action: DemoIncidentAction;
    label: string;
    details: string;
    confirmation: string;
  }[] = [
    {
      action: "notify_owner_team_slack",
      label: "Send Slack alert to owner team",
      details: `Slack alert sent to ${ownerTeam} for incident "${incidentTitle}".`,
      confirmation: "Slack alert sent to owner team."
    },
    {
      action: "notify_system_owner_slack",
      label: "Send Slack alert to system owner",
      details: `Slack alert sent to system owner for incident "${incidentTitle}".`,
      confirmation: "Slack alert sent to system owner."
    },
    {
      action: "notify_control_owner_slack",
      label: "Send Slack alert to control owner",
      details: `Slack alert sent to control owner for incident "${incidentTitle}".`,
      confirmation: "Slack alert sent to control owner."
    },
    {
      action: "create_jira_notify_owner_team",
      label: "Create Jira ticket and notify owner team",
      details: `Jira ticket drafted and ${ownerTeam} notified for "${incidentTitle}".`,
      confirmation: "Jira draft created and owner team notified."
    },
    {
      action: "draft_escalation_message",
      label: "Draft escalation message",
      details: `Escalation message drafted for leadership review on "${incidentTitle}".`,
      confirmation: "Escalation message drafted."
    }
  ];

  const runOutreach = async (choice: (typeof outreachActions)[number]) => {
    setPendingAction(choice.action);
    setOutreachOpen(false);
    await new Promise((r) => setTimeout(r, 180));
    const timestamp = new Date().toISOString();
    appendIncidentActionLog({
      id: `demo_outreach_${incidentId}_${Date.now()}`,
      incidentId,
      action: choice.action,
      details: choice.details,
      timestamp
    });
    setIncidentOutreachState(incidentId, {
      incidentId,
      label: choice.label,
      details: choice.details,
      timestamp
    });
    setLastResult(choice.confirmation);
    setPendingAction(null);
    onOutreachComplete?.({
      action: choice.action,
      label: choice.label,
      details: choice.details,
      timestamp
    });
  };

  const body = (
    <>
      <div
        className={`grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 ${embedded ? "" : "mt-3"}`}
      >
        <ActionButton
          icon={ShieldCheck}
          label="Confirm incident"
          hint="Acknowledge and route to reviewer queue"
          tone="primary"
          disabled={pendingAction !== null}
          loading={pendingAction === "confirm_incident"}
          onClick={() =>
            apply("confirm_incident", {
              incidentStatus: "pending",
              escalationStatus: "pending",
              reviewRequired: true,
              details: `Operator acknowledged "${incidentTitle}" and routed to review for ${ownerTeam}.`,
              confirmation: "Incident confirmed and routed into review."
            })
          }
        />
        <ActionButton
          icon={XCircle}
          label="Mark false positive"
          hint="Close incident with no remediation"
          tone="neutral"
          disabled={pendingAction !== null}
          loading={pendingAction === "mark_false_positive"}
          onClick={() =>
            apply("mark_false_positive", {
              incidentStatus: "closed",
              escalationStatus: "not_escalated",
              reviewRequired: false,
              details: `Operator marked "${incidentTitle}" as false positive; incident closed without remediation.`,
              confirmation: "Incident closed as false positive."
            })
          }
        />
        <ActionButton
          icon={Flag}
          tone="warn"
          label="Escalate"
          hint="Promote to leadership escalation path"
          disabled={pendingAction !== null}
          loading={pendingAction === "escalate_incident"}
          onClick={() =>
            apply("escalate_incident", {
              incidentStatus: "open",
              escalationStatus: "escalated",
              reviewRequired: true,
              details: `Operator escalated "${incidentTitle}" for leadership review and incident command attention.`,
              confirmation: "Incident escalated to leadership workflow."
            })
          }
        />
        <ActionButton
          icon={CheckCircle2}
          label="Resolve"
          hint="Log mitigation and close incident"
          tone="ok"
          disabled={pendingAction !== null}
          loading={pendingAction === "resolve_incident"}
          onClick={() =>
            apply("resolve_incident", {
              incidentStatus: "closed",
              escalationStatus: "not_escalated",
              reviewRequired: false,
              details: `Operator resolved "${incidentTitle}" with mitigation logged for ${ownerTeam}.`,
              confirmation: "Mitigation logged. Incident closed."
            })
          }
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-2.5 py-2">
        <div>
          <p className="text-xs font-medium text-slate-700">Operational outreach</p>
          <p className="text-[10px] text-slate-500">Quick notify actions; detailed Slack and Jira routing sits below.</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setOutreachOpen((v) => !v)}
            disabled={pendingAction !== null}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MessageSquareShare className="h-3.5 w-3.5" />
            Notify
            <ChevronDown className="h-3 w-3" />
          </button>
          {outreachOpen ? (
            <div className="absolute right-0 z-20 mt-1.5 w-[280px] rounded-md border border-slate-200 bg-white p-1.5 shadow-lg">
              {outreachActions.map((choice) => (
                <button
                  key={choice.action}
                  onClick={() => runOutreach(choice)}
                  className="block w-full rounded px-2 py-1.5 text-left text-[11px] text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  {choice.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-2 rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-[11px] text-slate-600">
        Current state:{" "}
        <span className={cn("font-medium", lifecycleBadgeClasses(incidentStatus))}>
          {humanizeLabel(incidentStatus)}
        </span>{" "}
        · Last action: {lastResult ?? "none"} · {reviewRequired ? "Review required" : "Review not required"}
      </div>
    </>
  );

  if (embedded) {
    return <div className="space-y-3">{body}</div>;
  }

  return (
    <Card surface="decision" className="border-indigo-200">
      <CardHeader
        title="Incident triage"
        caption="Apply the triage decision. Changes are bounded to this demo session."
      />
      {body}
    </Card>
  );
}

function ActionButton({
  icon: Icon,
  label,
  hint,
  onClick,
  disabled,
  loading,
  tone = "neutral"
}: {
  icon: typeof ShieldCheck;
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: "primary" | "neutral" | "warn" | "ok";
}) {
  const toneCls =
    tone === "primary"
      ? "border-indigo-300 bg-indigo-600 text-white hover:border-indigo-400 hover:bg-indigo-700"
      : tone === "warn"
        ? "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400"
        : tone === "ok"
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-400"
          : "border-slate-300 bg-white text-slate-800 hover:border-slate-400";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group inline-flex min-h-[54px] w-full items-start gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition hover:shadow-sm",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none",
        toneCls
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-[12px] font-semibold">{label}</p>
        <p
          className={cn(
            "line-clamp-1 text-[10px]",
            tone === "primary"
              ? "text-indigo-100"
              : "text-slate-600 group-hover:text-slate-700"
          )}
        >
          {hint}
        </p>
        {loading ? (
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide">Applying...</p>
        ) : null}
      </div>
    </button>
  );
}
