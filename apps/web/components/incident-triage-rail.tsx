import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { humanizeLabel } from "@/lib/present";
import { appendReturnTo, routeToIncident, routes } from "@/lib/routes";
import { cn } from "@/lib/cn";

type IncidentLike = {
  id: string;
  title: string;
  system_name?: string;
  system_id: string;
  severity: string;
  incident_status: string;
  created_at: string;
};

/** Shown in shell triage column and loading states. */
export const INCIDENT_TRIAGE_DOCK_CAPTION =
  "Same open queue as Incident Queue (default filters). Session overlay applied.";

/**
 * Ranked incident links — used in-page or in the app-shell triage dock next to {@link Sidebar}.
 */
export function IncidentTriageRail({
  activeIncidentId,
  incidents,
  returnTo,
  variant = "page",
  showAllIncidentsLink = false
}: {
  activeIncidentId: string;
  incidents: IncidentLike[];
  returnTo: string;
  variant?: "page" | "dock";
  showAllIncidentsLink?: boolean;
}) {
  const dock = variant === "dock";

  return (
    <nav
      aria-label="Incident queue beside detail"
      className={cn(
        "flex min-h-0 flex-col",
        dock
          ? "h-full border-0 bg-transparent shadow-none"
          : "rounded-lg border border-slate-200 bg-white shadow-sm"
      )}
    >
      <div className={cn("shrink-0 border-slate-100 px-3 py-2", dock ? "border-b" : "border-b")}>
        {dock ? (
          <>
            <p className="text-[10px] leading-snug text-slate-500">{INCIDENT_TRIAGE_DOCK_CAPTION}</p>
            {showAllIncidentsLink ? (
              <Link
                href={routes.incidents()}
                className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                title="Open full incident queue"
              >
                All incidents
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              </Link>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              Rapid triage
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
              Same queue on every incident detail — pin + urgency order.
            </p>
            {showAllIncidentsLink ? (
              <Link
                href={routes.incidents()}
                className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                All incidents
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              </Link>
            ) : null}
          </>
        )}
      </div>
      <ul
        className={cn(
          "space-y-0.5 overflow-y-auto p-2",
          dock ? "min-h-0 flex-1" : "max-h-[min(70vh,28rem)] md:max-h-[calc(100vh-6rem)]"
        )}
      >
        {incidents.map((item) => {
          const active = item.id === activeIncidentId;
          return (
            <li key={item.id}>
              <Link
                href={appendReturnTo(routeToIncident(item.id), returnTo)}
                className={`block rounded-md border px-2.5 py-2 text-left transition ${
                  active
                    ? "border-indigo-400 bg-indigo-50 shadow-sm"
                    : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-start gap-1.5">
                  <span
                    className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                      item.severity === "high"
                        ? "bg-rose-500"
                        : item.severity === "medium"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    aria-hidden
                  />
                  <span
                    className={`line-clamp-2 text-[11px] font-semibold leading-snug ${
                      active ? "text-indigo-950" : "text-slate-900"
                    }`}
                  >
                    {item.title}
                  </span>
                </span>
                <span className="mt-1 block truncate text-[10px] text-slate-500">
                  {item.system_name ?? item.system_id}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                  <span className="truncate">
                    {humanizeLabel(item.severity)} · {humanizeLabel(item.incident_status)}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-400">
                    {formatRelativeTime(item.created_at)}
                  </span>
                </span>
                {active ? (
                  <span className="mt-1 inline-block text-[9px] font-semibold uppercase tracking-wide text-indigo-700">
                    Viewing
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
