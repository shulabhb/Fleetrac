import type {
  ConfigAccessLevel,
  IntegrationActionScope,
  TelemetryAvailability
} from "@/lib/operations-types";
import {
  actionAccessLabel,
  configAccessLabel,
  observabilityAccessLabel
} from "@/lib/integration-access-vocabulary";
import { cn } from "@/lib/cn";

/**
 * Single calm row for the three canonical access dimensions — replaces a stack
 * of equal-weight badges on dense operator surfaces.
 */
export function IntegrationAccessStrip({
  telemetry,
  config,
  action,
  className,
  dense
}: {
  telemetry: TelemetryAvailability;
  config: ConfigAccessLevel;
  action: IntegrationActionScope;
  className?: string;
  dense?: boolean;
}) {
  const text = dense ? "text-[11px]" : "text-[12px]";
  return (
    <div
      className={cn(
        "flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-slate-600",
        text,
        className
      )}
    >
      <span>
        <span className="font-medium text-slate-500">Observability</span>{" "}
        <span className="text-slate-800">{observabilityAccessLabel(telemetry)}</span>
      </span>
      <span className="text-slate-300">·</span>
      <span>
        <span className="font-medium text-slate-500">Config</span>{" "}
        <span className="text-slate-800">{configAccessLabel(config)}</span>
      </span>
      <span className="text-slate-300">·</span>
      <span>
        <span className="font-medium text-slate-500">Actions</span>{" "}
        <span className="text-slate-800">{actionAccessLabel(action)}</span>
      </span>
    </div>
  );
}
