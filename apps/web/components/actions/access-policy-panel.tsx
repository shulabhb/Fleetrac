import {
  CheckCircle2,
  Eye,
  FileClock,
  Lock,
  Plug2,
  ShieldCheck,
  ShieldOff,
  Target,
  Undo2
} from "lucide-react";
import type { AccessPolicy } from "@/lib/action-types";
import { BobOperatingModeBadge, actionTypeLabel } from "./index";
import { humanizeLabel } from "@/lib/present";

/**
 * Access & Action Policy panel for System Detail.
 *
 * Buyer-facing trust artifact. Answers "what is this AI actually allowed to
 * do here?" in layers: Trust summary → permission grid → Access column
 * (what Bob can see) → Actions column (what Bob can propose, and with what
 * bounds) → approver footer.
 */
export function AccessPolicyPanel({ policy }: { policy: AccessPolicy }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <div>
          <p className="label-eyebrow">Access & action policy</p>
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">
            Governance contract for this system
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            What Bob can see, what Bob can propose, and what approval is
            required before anything executes.
          </p>
        </div>
        <BobOperatingModeBadge mode={policy.bob_operating_mode} />
      </header>

      {/* Trust summary — the governance contract, at a glance. */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
        <TrustChip
          tone={
            policy.telemetry_level === "metrics_only" || policy.telemetry_level === "logs_only"
              ? "neutral"
              : "ok"
          }
          icon={<Eye className="h-3 w-3" />}
        >
          {telemetryAccessLabel(policy.telemetry_level)}
        </TrustChip>
        <TrustChip
          tone={
            policy.action_level === "limited_execution" ? "warn" : "ok"
          }
          icon={<Lock className="h-3 w-3" />}
        >
          {actionLevelLabel(policy.action_level)}
        </TrustChip>
        <TrustChip tone="ok" icon={<ShieldCheck className="h-3 w-3" />}>
          Approval-gated
        </TrustChip>
        <TrustChip tone="ok" icon={<Target className="h-3 w-3" />}>
          Bounded execution
        </TrustChip>
        <TrustChip tone="ok" icon={<Undo2 className="h-3 w-3" />}>
          Reversible by default
        </TrustChip>
        <TrustChip tone="ok" icon={<FileClock className="h-3 w-3" />}>
          Audit-linked
        </TrustChip>
      </div>

      {/* Access / permission grid */}
      <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 text-xs md:grid-cols-3 lg:grid-cols-6">
        <AccessCell label="Telemetry" value={humanizeLabel(policy.telemetry_level)} />
        <AccessCell label="Config" value={humanizeLabel(policy.config_access)} />
        <AccessCell label="Logs" value={humanizeLabel(policy.logs_access)} />
        <AccessCell
          label="Actions"
          value={actionLevelLabel(policy.action_level)}
        />
        <AccessCell
          label="Environment"
          value={humanizeLabel(policy.environment)}
        />
        <AccessCell label="Integration" value={policy.integration_mode} />
      </div>

      {/* Access column (read) */}
      <div className="px-5 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Access · what Bob can see
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 px-5 pt-2 md:grid-cols-2">
        <PolicyList
          icon={<Eye className="h-3.5 w-3.5 text-slate-500" />}
          title="Observability"
          caption="Signals, traces, and metrics Bob can read."
          items={policy.observability_access}
        />
        <PolicyList
          icon={<Plug2 className="h-3.5 w-3.5 text-slate-500" />}
          title="Integrations"
          caption="Connection surface Bob reads and prepares against."
          items={policy.integration_access}
        />
      </div>

      {/* Actions column (write) */}
      <div className="mt-4 border-t border-slate-100 px-5 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Actions · what Bob can propose
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 px-5 py-4 md:grid-cols-2">
        <PolicyList
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
          title="Allowed actions"
          caption="Action types Bob may prepare here."
          items={policy.allowed_actions.map((a) => actionTypeLabel(a))}
        />
        <PolicyList
          icon={<ShieldOff className="h-3.5 w-3.5 text-rose-600" />}
          title="Restricted actions"
          caption="Never permitted on this system."
          items={policy.restricted_actions}
          tone="restricted"
        />
        <PolicyList
          icon={<ShieldCheck className="h-3.5 w-3.5 text-slate-500" />}
          title="Approval policy"
          caption="Who must approve before a change may execute."
          items={policy.approval_policy}
        />
        <PolicyList
          icon={<Target className="h-3.5 w-3.5 text-slate-500" />}
          title="Execution boundary"
          caption="Scope that bounds any executed change."
          items={policy.execution_boundary}
        />
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
        <span>
          <span className="text-slate-400">Primary approver · </span>
          <span className="font-medium text-slate-700">
            {policy.primary_approver}
          </span>
          {policy.secondary_approver ? (
            <>
              <span className="mx-2 text-slate-300">|</span>
              <span className="text-slate-400">Secondary · </span>
              <span className="font-medium text-slate-700">
                {policy.secondary_approver}
              </span>
            </>
          ) : null}
        </span>
        <span className="text-slate-400">
          Approval-gated, policy-checked, and audit-linked.
        </span>
      </footer>
    </section>
  );
}

type TrustTone = "ok" | "warn" | "neutral";

function TrustChip({
  tone,
  icon,
  children
}: {
  tone: TrustTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 " +
        cls
      }
    >
      {icon}
      {children}
    </span>
  );
}

function telemetryAccessLabel(level: string): string {
  switch (level) {
    case "full":
      return "Full telemetry";
    case "partial":
      return "Partial telemetry";
    case "metadata_only":
      return "Metadata only";
    case "none":
      return "No telemetry";
    default:
      return humanizeLabel(level);
  }
}

function actionLevelLabel(level: string): string {
  switch (level) {
    case "none":
      return "No actions";
    case "read_only":
      return "Read only";
    case "prepare_only":
      return "Prepare only";
    case "approval_gated":
      return "Approval-gated";
    case "limited_execution":
      return "Limited execution";
    default:
      return humanizeLabel(level);
  }
}

function AccessCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium text-slate-800">
        {value}
      </p>
    </div>
  );
}

function PolicyList({
  icon,
  title,
  caption,
  items,
  tone = "default"
}: {
  icon: React.ReactNode;
  title: string;
  caption?: string;
  items: string[];
  tone?: "default" | "restricted";
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {title}
      </p>
      {caption ? (
        <p className="mt-0.5 text-[11px] text-slate-500">{caption}</p>
      ) : null}
      <ul className="mt-1.5 space-y-1 text-xs text-slate-700">
        {items.map((item) => (
          <li
            key={item}
            className={
              "flex items-start gap-1.5 " +
              (tone === "restricted" ? "text-slate-600" : "text-slate-700")
            }
          >
            <span
              aria-hidden
              className={
                "mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full " +
                (tone === "restricted" ? "bg-rose-400" : "bg-slate-400")
              }
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
