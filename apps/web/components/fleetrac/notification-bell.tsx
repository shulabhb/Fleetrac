"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/cn";
import type { NotificationEvent } from "@/lib/governance-demo-model";

export function NotificationBell({
  events,
  limit = 8
}: {
  events: NotificationEvent[];
  limit?: number;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const slice = events.slice(0, limit);
  const count = events.length;

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  if (!count) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm transition",
          "hover:border-slate-300 hover:bg-slate-50",
          open && "border-slate-300 bg-slate-50"
        )}
        aria-label={`Notifications, ${count} recent`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifications"
      >
        <Bell className="h-4 w-4" aria-hidden />
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-semibold text-white">
          {count > 9 ? "9+" : count}
        </span>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-slate-900">Notifications</p>
            <p className="text-[10px] text-slate-500">Slack, email, and in-app governance events</p>
          </div>
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
            {slice.map((e) => (
              <li key={e.id} className="px-3 py-2.5 text-[12px]">
                <p className="font-medium leading-snug text-slate-800">{e.summary}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {e.channel} · {e.at}
                  {e.ownerTeam ? ` · ${e.ownerTeam}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
