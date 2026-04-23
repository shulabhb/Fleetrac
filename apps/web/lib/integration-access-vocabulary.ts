/**
 * Canonical access vocabulary for integrations and admin surfaces.
 * Keep labels aligned across Settings, system views, and policy panels.
 */

import type {
  ConfigAccessLevel,
  IntegrationActionScope,
  TelemetryAvailability
} from "@/lib/operations-types";

/** Observability ingest level — what Fleetrac can read from the integration. */
export function observabilityAccessLabel(
  level: TelemetryAvailability
): string {
  switch (level) {
    case "full":
      return "Full telemetry";
    case "partial":
      return "Partial telemetry";
    case "metadata_only":
      return "Metadata only";
    case "none":
    default:
      return "No telemetry ingest";
  }
}

/** Config / control-plane read model for the integration. */
export function configAccessLabel(access: ConfigAccessLevel): string {
  switch (access) {
    case "read_write":
      return "Read / write (staged)";
    case "read_only":
      return "Read only";
    case "none":
    default:
      return "No config access";
  }
}

/** What governed actions may do through this integration. */
export function actionAccessLabel(scope: IntegrationActionScope): string {
  switch (scope) {
    case "none":
      return "No actions";
    case "read_only":
      return "Read only (no mutations)";
    case "prepare_only":
      return "Prepare only";
    case "approval_gated":
      return "Approval-gated execution";
    case "limited_execution":
      return "Limited auto-execution";
    default:
      return scope;
  }
}

/** Environment scope chips — string env names from API use same vocabulary. */
export function environmentScopeLabel(env: string): string {
  const e = env.toLowerCase();
  if (e === "production") return "Production";
  if (e === "staging") return "Staging";
  if (e === "sandbox") return "Sandbox";
  if (e === "internal_only") return "Internal only";
  return env.replace(/_/g, " ");
}
