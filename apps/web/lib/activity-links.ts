import type { ActivityItem } from "@/components/activity-feed";
import { routeToBobForTarget, routeToControl, routeToIncident, routeToSystem } from "@/lib/routes";

/**
 * Canonical deep-link resolver for governance activity entries.
 * Returns null when we cannot infer a safe destination.
 */
export function activityHrefFor(item: ActivityItem): string | null {
  if (!item.targetId) return null;
  if (item.action?.startsWith("bob.") && item.targetType === "control") {
    return routeToBobForTarget("control", item.targetId);
  }
  if (item.action?.startsWith("bob.") && item.targetType === "incident") {
    return routeToBobForTarget("incident", item.targetId);
  }
  if (item.targetId.startsWith("inc_")) return routeToIncident(item.targetId);
  if (item.targetId.startsWith("sys_")) return routeToSystem(item.targetId);
  if (item.targetId.startsWith("rule_")) return routeToControl(item.targetId);
  return null;
}
