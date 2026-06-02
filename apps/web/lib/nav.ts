import {
  Activity,
  AlertTriangle,
  LayoutDashboard,
  LineChart,
  PlayCircle,
  Server,
  Settings
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

/** Product IA — calm, governance-first navigation (dashboard workflow is primary). */
export const navItems: NavItem[] = [
  { label: "Dashboard", href: routes.dashboard(), icon: LayoutDashboard, loop: "orient" },
  { label: "Live Signals", href: routes.liveSignals(), icon: Activity, loop: "observe" },
  {
    label: "Incident Queue",
    href: routes.incidents(),
    icon: AlertTriangle,
    loop: "investigate"
  },
  { label: "System Registry", href: routes.systems(), icon: Server, loop: "context" },
  { label: "Action Center", href: routes.actions(), icon: PlayCircle, loop: "act" },
  { label: "Evidence Library", href: routes.outcomes(), icon: LineChart, loop: "measure" },
  {
    label: "Settings / Connectors",
    href: routes.settings(),
    icon: Settings,
    loop: "configure"
  }
];
