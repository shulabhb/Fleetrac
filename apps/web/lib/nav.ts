import {
  Activity,
  AlertTriangle,
  LayoutDashboard,
  PlayCircle,
  Server
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { routes } from "./routes";
import type { GovernanceLoop } from "@/components/layout/governance-page-shell";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  caption?: string;
  loop: GovernanceLoop;
};

/**
 * Primary IA — runtime agent governance loop (Phases A–E).
 *
 * Core loop only:
 *   Overview → Agent Fleet → Runtime Monitor → Risk Queue → Action Center
 *
 * Secondary (sidebar footer / direct URL, not primary nav):
 *   Outcomes (`/outcomes`) — historical evidence / audit search
 *   Settings (`/settings`) — connectors / admin
 *
 * Redirected legacy destinations (see next.config.ts):
 *   /bob, /activity, /controls, /usage → Overview or Agent Fleet
 */
export const navItems: NavItem[] = [
  { label: "Overview", href: routes.dashboard(), icon: LayoutDashboard, loop: "orient" },
  { label: "Agent Fleet", href: routes.systems(), icon: Server, loop: "context" },
  { label: "Runtime Monitor", href: routes.liveSignals(), icon: Activity, loop: "observe" },
  {
    label: "Risk Queue",
    href: routes.incidents(),
    icon: AlertTriangle,
    loop: "investigate"
  },
  { label: "Action Center", href: routes.actions(), icon: PlayCircle, loop: "act" }
];

/** Secondary admin / audit destinations — do not compete with the primary loop. */
export const secondaryNavItems: { label: string; href: string; caption: string }[] = [
  {
    label: "Outcomes Audit",
    href: routes.outcomes(),
    caption: "Verification outcomes · historical lookup"
  },
  {
    label: "Settings",
    href: routes.settings(),
    caption: "Connectors · admin"
  }
];
