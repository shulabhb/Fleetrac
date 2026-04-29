"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { navItems } from "@/lib/nav";
import { isIncidentDetailPath, routes } from "@/lib/routes";
import { ResetDemoStateButton } from "@/components/reset-demo-state-button";
import { cn } from "@/lib/cn";
import {
  AI_SCOPE_OPTIONS,
  normalizeAiScope,
  withAiScope,
  type AiScopeId
} from "@/lib/ai-scope";

export function Sidebar() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [scope, setScopeState] = useState<AiScopeId>("all");
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const scopeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    setScopeState(normalizeAiScope(qs.get("scope")));
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!scopeMenuRef.current) return;
      if (!scopeMenuRef.current.contains(event.target as Node)) {
        setScopeMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const setScope = (next: string) => {
    const qs = new URLSearchParams(window.location.search);
    if (!next || next === "all") qs.delete("scope");
    else qs.set("scope", next);
    const out = qs.toString();
    setScopeState(normalizeAiScope(next));
    setScopeMenuOpen(false);
    router.replace(out ? `${pathname}?${out}` : pathname, { scroll: false });
  };
  const activeScopeLabel =
    AI_SCOPE_OPTIONS.find((opt) => opt.id === scope)?.label ?? "All";

  return (
    <aside className="flex h-full min-h-0 w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="shrink-0 px-4 pb-4 pt-5">
        <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-[11px] font-bold text-white">
          Ft
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-slate-900">Fleetrac</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            Governance Control Plane
          </p>
        </div>
        </div>
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-2">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
              <span className="h-3 w-3 rounded-full border border-white bg-slate-950" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-extrabold tracking-tight text-slate-950">SHUUU</p>
              <p className="truncate text-[11px] font-medium text-slate-700">AI Ops Lead</p>
            </div>
          </div>
          <div className="relative mt-2" ref={scopeMenuRef}>
            <button
              type="button"
              onClick={() => setScopeMenuOpen((prev) => !prev)}
              className="flex h-8 w-full items-center justify-between rounded-md border border-slate-300 bg-white/95 px-2.5 text-[11px] font-medium tracking-tight text-slate-800 shadow-sm transition hover:border-slate-400"
              aria-haspopup="listbox"
              aria-expanded={scopeMenuOpen}
              aria-label="Active scope"
              title="Active scope"
            >
              <span className="truncate">{activeScopeLabel}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
                  scopeMenuOpen && "rotate-180"
                )}
                aria-hidden
              />
            </button>
            {scopeMenuOpen ? (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                <ul className="max-h-56 overflow-y-auto" role="listbox" aria-label="Scope options">
                  {AI_SCOPE_OPTIONS.map((opt) => (
                    <li key={opt.id}>
                      <button
                        type="button"
                        onClick={() => setScope(opt.id)}
                        className={cn(
                          "flex w-full items-center rounded px-2 py-1.5 text-left text-[11px] font-medium transition",
                          opt.id === scope
                            ? "bg-slate-900 text-white"
                            : "text-slate-700 hover:bg-slate-100"
                        )}
                        role="option"
                        aria-selected={opt.id === scope}
                      >
                        {opt.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <nav className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2">
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          const incidentTriageDock =
            item.href === routes.incidents() && isIncidentDetailPath(pathname);
          const href = withAiScope(item.href, scope);
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition",
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-white" : "text-slate-400 group-hover:text-slate-700"
                )}
              />
              <span className="min-w-0 flex-1 font-medium">{item.label}</span>
              {incidentTriageDock ? (
                <span
                  className={cn(
                    "shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                    active ? "bg-white/15 text-white" : "bg-slate-200 text-slate-600"
                  )}
                  title="Open queue is shown beside the nav"
                >
                  Triage
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-slate-200 p-3">
        <div className="mb-2 flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-medium text-slate-700">Demo environment</span>
          <span className="ml-auto text-[10px] text-slate-400">mock data</span>
        </div>
        <ResetDemoStateButton />
      </div>
    </aside>
  );
}
