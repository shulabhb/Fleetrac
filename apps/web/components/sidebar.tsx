"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { navItems } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { normalizeAiScope, withAiScope, type AiScopeId } from "@/lib/ai-scope";

export function Sidebar() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [scope, setScopeState] = useState<AiScopeId>("all");

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    setScopeState(normalizeAiScope(qs.get("scope")));
  }, [pathname, searchParams]);

  return (
    <aside className="flex h-full min-h-0 w-60 shrink-0 flex-col bg-[#0e2438] text-slate-100">
      <div className="shrink-0 px-4 pb-4 pt-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/15 text-[12px] font-bold text-emerald-300 ring-1 ring-emerald-400/30">
            Ft
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white">Fleetrac</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
              Agent governance
            </p>
          </div>
        </div>
      </div>
      <nav className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2">
        {navItems.map((item) => {
          const path = item.href.split("?")[0] ?? item.href;
          const onOutcomes = pathname === "/outcomes" || pathname.startsWith("/outcomes/");
          const auditSurface = searchParams.get("surface") === "audit";
          const active = path === "/outcomes"
            ? onOutcomes && (item.label === "Outcomes Audit" ? auditSurface : !auditSurface)
            : pathname === path || (path !== "/" && pathname.startsWith(path));
          const Icon = item.icon;
          const href = withAiScope(item.href, scope);
          return (
            <Link
              key={item.label}
              href={href}
              className={cn(
                "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition",
                active
                  ? "bg-white/10 text-white"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-emerald-300" : "text-slate-400 group-hover:text-slate-200"
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{item.label}</span>
                {active ? (
                  <span
                    className={cn(
                      "block text-[10px] font-medium capitalize",
                      active ? "text-white/70" : "text-slate-400"
                    )}
                  >
                    {item.loop}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
