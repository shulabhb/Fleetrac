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

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  caption?: string;
};

/** Product IA — calm, governance-first navigation (dashboard workflow is primary). */
export const navItems: NavItem[] = [
  { label: "Dashboard", href: routes.dashboard(), icon: LayoutDashboard },
  { label: "Live Signals", href: routes.liveSignals(), icon: Activity },
  { label: "Incident Queue", href: routes.incidents(), icon: AlertTriangle },
  { label: "System Registry", href: routes.systems(), icon: Server },
  { label: "Action Center", href: routes.actions(), icon: PlayCircle },
  { label: "Evidence Library", href: routes.outcomes(), icon: LineChart },
  { label: "Settings / Connectors", href: routes.settings(), icon: Settings }
];
