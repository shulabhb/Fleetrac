import type { ActivityItem } from "@/components/activity-feed";
import { routeToControl, routeToIncident, routeToSystem, routes } from "@/lib/routes";

/**
 * Canonical deep-link resolver for governance activity entries.
 * Returns null when we cannot infer a safe destination.
 * Legacy bob.* actions route into Risk Detail / Agent Fleet — not a Bob destination.
 */
export function activityHrefFor(item: ActivityItem): string | null {
  if (!item.targetId) return null;
  if (item.action?.startsWith("bob.") && item.targetType === "control") {
    return routeToControl(item.targetId);
  }
  if (item.action?.startsWith("bob.") && item.targetType === "incident") {
    return routeToIncident(item.targetId);
  }
  if (item.targetId.startsWith("inc-") || item.targetId.startsWith("inc_")) {
    return routeToIncident(item.targetId);
  }
  if (item.targetId.startsWith("sys-") || item.targetId.startsWith("sys_")) {
    return routeToSystem(item.targetId);
  }
  if (item.targetId.startsWith("rule_")) return routeToControl(item.targetId);
  if (item.targetType === "incident") return routeToIncident(item.targetId);
  if (item.targetType === "system") return routeToSystem(item.targetId);
  return routes.dashboard();
}
