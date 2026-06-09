"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import {
  postPitch,
  postScenario,
  postSimulatorPause,
  postSimulatorReset,
  postSimulatorStart,
  postSimulatorStop,
  type SimulatorStatusDTO
} from "@/lib/simulator-api";
import { cn } from "@/lib/cn";

type Props = {
  status: SimulatorStatusDTO | null;
  onRefresh: () => void;
};

function SimButton({
  children,
  disabled,
  onClick,
  variant = "default"
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  variant?: "default" | "primary";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-[11px] font-semibold shadow-sm disabled:opacity-50",
        variant === "primary"
          ? "bg-slate-900 text-white hover:bg-slate-800"
          : "border border-slate-200 bg-white text-slate-800 hover:border-slate-300"
      )}
    >
      {children}
    </button>
  );
}

export function SimulatorControls({ status, onRefresh }: Props) {
  const [busy, setBusy] = useState(false);
  const [scenario, setScenario] = useState("unsupported_claim_spike");
  const [rate, setRate] = useState("5");

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Simulator
      </p>
      <SimButton
        disabled={busy || Boolean(status?.running)}
        onClick={() => run(() => postSimulatorStart({ rate_eps: Number(rate) }))}
      >
        Start
      </SimButton>
      <SimButton disabled={busy} onClick={() => run(() => postSimulatorPause())}>
        Pause
      </SimButton>
      <SimButton disabled={busy} onClick={() => run(() => postSimulatorStop())}>
        Stop
      </SimButton>
      <SimButton disabled={busy} onClick={() => run(() => postSimulatorReset())}>
        Reset
      </SimButton>
      <Select value={rate} onChange={(e) => setRate(e.target.value)} className="w-20">
        <option value="1">1/s</option>
        <option value="5">5/s</option>
        <option value="10">10/s</option>
        <option value="20">20/s</option>
      </Select>
      <Select
        value={scenario}
        onChange={(e) => setScenario(e.target.value)}
        className="min-w-[180px]"
      >
        <option value="unsupported_claim_spike">Unsupported claim spike</option>
        <option value="tool_scope_violation">Tool scope violation</option>
        <option value="remediation_applied">Remediation applied</option>
      </Select>
      <SimButton
        variant="primary"
        disabled={busy}
        onClick={() =>
          run(() =>
            postScenario(
              scenario,
              scenario === "tool_scope_violation"
                ? "sys-agt-cs-002"
                : "sys-agt-treasury-001"
            )
          )
        }
      >
        Trigger scenario
      </SimButton>
      <SimButton
        disabled={busy}
        onClick={() => run(() => postPitch("treasury_unsupported_claim"))}
      >
        Run pitch
      </SimButton>
      {status ? (
        <p className="ml-auto text-[11px] tabular-nums text-slate-500">
          {status.mode} · {status.event_count} events
          {status.last_scenario ? ` · ${status.last_scenario}` : ""}
        </p>
      ) : null}
    </div>
  );
}
