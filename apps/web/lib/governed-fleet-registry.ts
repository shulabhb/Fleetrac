/**
 * Fleet scope constants — operational system rows come from GET /governance/systems.
 */

export const GOVERNED_FLEET_SYSTEM_COUNT = 10;

export const GOVERNED_FLEET_SYSTEMS_SUB =
  "10 agentic workflows · multi-cloud telemetry";

/** Resolve display id (e.g. M40) to canonical system id when only display is known. */
export function canonicalSystemIdForDisplay(displayId: string): string {
  return displayId;
}
