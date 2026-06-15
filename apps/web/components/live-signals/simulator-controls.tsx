"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { GOVERNED_FLEET_SYSTEMS } from "@/lib/governed-fleet-registry";
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

const SCENARIO_SYSTEM: Record<string, string> = {
  unsupported_claim_spike: "sys-agt-treasury-001",
  tool_scope_violation: "sys-agt-phish-008",
  provider_latency_regression: "sys-agt-cs-002",
  remediation_applied: "sys-agt-treasury-001"
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
  const [seed, setSeed] = useState("42");
  const [systemScope, setSystemScope] = useState<string>("all");

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const continuousSystems =
    systemScope === "all" ? undefined : [systemScope];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Simulator
      </p>
      <SimButton
        disabled={busy || Boolean(status?.running)}
        onClick={() =>
          run(() =>
            postSimulatorStart({
              rate_eps: Number(rate),
              systems: continuousSystems,
              seed: Number(seed)
            })
          )
        }
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
      <input
        type="number"
        min={0}
        value={seed}
        onChange={(e) => setSeed(e.target.value)}
        className="w-16 rounded-md border border-slate-200 px-2 py-1.5 text-[11px]"
        title="RNG seed"
        aria-label="Simulator seed"
      />
      <Select
        value={systemScope}
        onChange={(e) => setSystemScope(e.target.value)}
        className="min-w-[140px]"
      >
        <option value="all">All 10 systems</option>
        {GOVERNED_FLEET_SYSTEMS.map((s) => (
          <option key={s.systemId} value={s.systemId}>
            {s.displayId}
          </option>
        ))}
      </Select>
      <Select
        value={scenario}
        onChange={(e) => setScenario(e.target.value)}
        className="min-w-[200px]"
      >
        <option value="unsupported_claim_spike">Unsupported claim spike</option>
        <option value="tool_scope_violation">Tool scope violation</option>
        <option value="provider_latency_regression">Provider latency regression</option>
        <option value="remediation_applied">Remediation applied</option>
      </Select>
      <SimButton
        variant="primary"
        disabled={busy}
        onClick={() =>
          run(() => postScenario(scenario, SCENARIO_SYSTEM[scenario] ?? "sys-agt-treasury-001"))
        }
      >
        Trigger scenario
      </SimButton>
      <SimButton
        disabled={busy}
        onClick={() => run(() => postPitch("treasury_unsupported_claim"))}
      >
        Pitch M40
      </SimButton>
      <SimButton
        disabled={busy}
        onClick={() => run(() => postPitch("security_tool_scope"))}
      >
        Pitch phish
      </SimButton>
      <SimButton
        disabled={busy}
        onClick={() => run(() => postPitch("cs_latency_regression"))}
      >
        Pitch latency
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
