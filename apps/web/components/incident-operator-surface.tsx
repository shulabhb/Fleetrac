"use client";

import Link from "next/link";
import { LayoutGrid, PlayCircle, Plus, Server, ShieldCheck } from "lucide-react";
import {
  appendReturnTo,
  routeToActionsTab,
  routeToControl,
  routes,
  routeToSystem
} from "@/lib/routes";
type Props = {
  incidentId: string;
  systemId: string;
  ruleId: string;
  /** When false, hide New incident / Dashboard (available from app sidebar). Default true. */
  showWorkspaceShortcuts?: boolean;
};

const btn =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900";

/**
 * Minimal operator chrome for incident detail — fast navigation, no duplicate workflow UI.
 */
export function IncidentOperatorSurface({
  incidentId,
  systemId,
  ruleId,
  showWorkspaceShortcuts = true
}: Props) {
  const here = `/incidents/${incidentId}`;

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1 shadow-sm">
      <Link href={routeToSystem(systemId)} className={btn}>
        <Server className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        System
      </Link>
      <Link href={appendReturnTo(routeToControl(ruleId), here)} className={btn}>
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        Control
      </Link>
      <Link
        href={appendReturnTo(routeToActionsTab("pending"), here)}
        className={btn}
      >
        <PlayCircle className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        Actions
      </Link>
      {showWorkspaceShortcuts ? (
        <>
          <span className="ml-auto hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
          <Link
            href={routes.incidents()}
            className={`${btn} text-slate-600 sm:ml-0`}
            title="Open incident queue to triage or file follow-on work"
          >
            <Plus className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            New incident
          </Link>
          <Link href={routes.dashboard()} className={`${btn} hidden md:inline-flex`}>
            <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            Dashboard
          </Link>
        </>
      ) : null}
    </div>
  );
}
