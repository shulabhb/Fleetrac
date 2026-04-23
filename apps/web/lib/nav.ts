import {
  AlertTriangle,
  LayoutDashboard,
  LineChart,
  PlayCircle,
  Server,
  Settings,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { routes } from "./routes";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  caption?: string;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: routes.dashboard(), icon: LayoutDashboard },
  { label: "Incident Queue", href: routes.incidents(), icon: AlertTriangle },
  { label: "Governance Controls", href: routes.controls(), icon: ShieldCheck },
  { label: "Systems", href: routes.systems(), icon: Server },
  { label: "Action Center", href: routes.actions(), icon: PlayCircle },
  { label: "Outcomes", href: routes.outcomes(), icon: LineChart },
  { label: "Bob Copilot", href: routes.bob(), icon: Sparkles },
  { label: "Settings", href: routes.settings(), icon: Settings }
];
