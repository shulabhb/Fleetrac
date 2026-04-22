import { CheckCircle2, Eye, Plug2, ShieldCheck, ShieldOff } from "lucide-react";
import type { AccessPolicy } from "@/lib/action-types";
import { BobOperatingModeBadge, actionTypeLabel } from "./index";
import { humanizeLabel } from "@/lib/present";

/**
 * Structured Access & Action Policy panel for System Detail. Shows what
 * Fleetrac/Bob can see, prepare and execute on the system — the first-class
 * governance contract customers can read without guesswork.
 */
export function AccessPolicyPanel({ policy }: { policy: AccessPolicy }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <div>
          <p className="label-eyebrow">Access & Action Policy</p>
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">
            What Fleetrac and Bob are allowed to do on this system
          </h3>
        </div>
        <BobOperatingModeBadge mode={policy.bob_operating_mode} />
      </header>

      {/* Access-level summary strip (enterprise credibility) */}
      <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 text-xs md:grid-cols-3 lg:grid-cols-6">
        <AccessCell label="Telemetry" value={humanizeLabel(policy.telemetry_level)} />
        <AccessCell label="Config" value={humanizeLabel(policy.config_access)} />
        <AccessCell label="Logs" value={humanizeLabel(policy.logs_access)} />
        <AccessCell label="Actions" value={humanizeLabel(policy.action_level)} />
        <AccessCell
          label="Environment"
          value={humanizeLabel(policy.environment)}
        />
        <AccessCell
          label="Integration"
          value={policy.integration_mode}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 px-5 py-4 md:grid-cols-2">
        <PolicyList
          icon={<Eye className="h-3.5 w-3.5 text-slate-500" />}
          title="Observability access"
          items={policy.observability_access}
        />
        <PolicyList
          icon={<Plug2 className="h-3.5 w-3.5 text-slate-500" />}
          title="Integration access"
          items={policy.integration_access}
        />
        <PolicyList
          icon={<ShieldCheck className="h-3.5 w-3.5 text-slate-500" />}
          title="Approval policy"
          items={policy.approval_policy}
        />
        <PolicyList
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
          title="Allowed actions"
          items={policy.allowed_actions.map((a) => actionTypeLabel(a))}
        />
        <PolicyList
          icon={<ShieldOff className="h-3.5 w-3.5 text-rose-600" />}
          title="Restricted actions"
          items={policy.restricted_actions}
          tone="restricted"
        />
        <PolicyList
          icon={<ShieldCheck className="h-3.5 w-3.5 text-slate-500" />}
          title="Execution boundary"
          items={policy.execution_boundary}
        />
      </div>

      <footer className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
        Primary approver:{" "}
        <span className="font-medium text-slate-700">
          {policy.primary_approver}
        </span>
        {policy.secondary_approver ? (
          <>
            {" · "}Secondary:{" "}
            <span className="font-medium text-slate-700">
              {policy.secondary_approver}
            </span>
          </>
        ) : null}
      </footer>
    </section>
  );
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
  items,
  tone = "default"
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone?: "default" | "restricted";
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {title}
      </p>
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
