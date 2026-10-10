import {
  AlertTriangle,
  ClipboardList,
  Code2,
  LayoutDashboard,
  Library,
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

/**
 * Sidebar order. One stacked list.
 * Code Investigations is a blank route until that workflow exists.
 * Evidence Library and Outcomes Audit both open `/outcomes` today.
 * Runtime Monitor stays at `/live-signals` and is not in this list.
 */
export const navItems: NavItem[] = [
  { label: "Overview", href: routes.dashboard(), icon: LayoutDashboard, loop: "orient" },
  { label: "Risk Queue", href: routes.incidents(), icon: AlertTriangle, loop: "investigate" },
  { label: "Agent Fleet", href: routes.systems(), icon: Server, loop: "context" },
  {
    label: "Code Investigations",
    href: routes.codeInvestigations(),
    icon: Code2,
    loop: "investigate"
  },
  { label: "Evidence Library", href: routes.outcomes(), icon: Library, loop: "measure" },
  { label: "Action Center", href: routes.actions(), icon: PlayCircle, loop: "act" },
  {
    label: "Outcomes Audit",
    href: `${routes.outcomes()}?surface=audit`,
    icon: ClipboardList,
    loop: "measure"
  },
  { label: "Settings", href: routes.settings(), icon: Settings, loop: "configure" }
];
