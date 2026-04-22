"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";
import { ResetDemoStateButton } from "@/components/reset-demo-state-button";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-4 pb-4 pt-5">
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
      <nav className="mt-2 flex-1 space-y-0.5 px-2">
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
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
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-3">
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
