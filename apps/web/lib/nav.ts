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

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  caption?: string;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Incident Queue", href: "/incidents", icon: AlertTriangle },
  { label: "Governance Controls", href: "/controls", icon: ShieldCheck },
  { label: "Systems", href: "/systems", icon: Server },
  { label: "Action Center", href: "/actions", icon: PlayCircle },
  { label: "Outcomes", href: "/outcomes", icon: LineChart },
  { label: "Bob Copilot", href: "/bob", icon: Sparkles },
  { label: "Settings", href: "/settings", icon: Settings }
];
