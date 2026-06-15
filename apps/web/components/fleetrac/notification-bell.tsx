"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Share2, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { NotificationEvent } from "@/lib/governance-notification-types";
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  readNotificationState
} from "@/lib/notification-state";
import {
  routeToEvidenceLibraryIncidentRecord,
  routeToIncidentsOwnerQueue,
  routes
} from "@/lib/routes";

function hrefForNotification(
  event: NotificationEvent,
  scopeHref: (path: string) => string
): string {
  const target = event.target ?? "incident-queue";
  if (target === "action-center") {
    const qs = new URLSearchParams({ tab: "pending" });
    if (event.incidentId) qs.set("action", event.incidentId);
    return scopeHref(`${routes.actions()}?${qs.toString()}`);
  }
  if (target === "evidence" && event.incidentId) {
    return scopeHref(
      routeToEvidenceLibraryIncidentRecord(event.incidentId, event.ownerTeam)
    );
  }
  if (event.incidentId) {
    return scopeHref(routeToIncidentsOwnerQueue(event.ownerTeam, event.incidentId));
  }
  return scopeHref(routeToIncidentsOwnerQueue(event.ownerTeam));
}

function openLabelFor(event: NotificationEvent): string {
  switch (event.target ?? "incident-queue") {
    case "action-center":
      return "Open Action Center";
    case "evidence":
      return "Open evidence record";
    default:
      return "Open Incident Queue";
  }
}

export function NotificationBell({
  events,
  limit = 12,
  scopeHref = (path) => path
}: {
  events: NotificationEvent[];
  limit?: number;
  scopeHref?: (path: string) => string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uiState, setUiState] = useState(readNotificationState);
  const [toast, setToast] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(() => setUiState(readNotificationState()), []);

  useEffect(() => {
    reload();
    window.addEventListener("fleetrac-notifications-updated", reload);
    return () => window.removeEventListener("fleetrac-notifications-updated", reload);
  }, [reload]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const visible = useMemo(() => {
    const deleted = new Set(uiState.deletedIds);
    return events.filter((e) => !deleted.has(e.id)).slice(0, limit);
  }, [events, uiState.deletedIds, limit]);

  const unreadCount = useMemo(() => {
    const read = new Set(uiState.readIds);
    return visible.filter((e) => !read.has(e.id)).length;
  }, [visible, uiState.readIds]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const openNotification = useCallback(
    (event: NotificationEvent) => {
      markNotificationRead(event.id);
      reload();
      setOpen(false);
      router.push(hrefForNotification(event, scopeHref));
    },
    [router, scopeHref, reload]
  );

  const shareNotification = useCallback(
    async (event: NotificationEvent) => {
      const path = hrefForNotification(event, scopeHref);
      const url =
        typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
      try {
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({
            title: "Fleetrac notification",
            text: event.summary,
            url
          });
          showToast("Shared");
          return;
        }
        await navigator.clipboard.writeText(url);
        showToast("Link copied");
      } catch {
        showToast("Could not share");
      }
    },
    [scopeHref, showToast]
  );

  const removeNotification = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      deleteNotification(id);
      reload();
      showToast("Notification removed");
    },
    [reload, showToast]
  );

  const markAllRead = useCallback(() => {
    markAllNotificationsRead(visible.map((e) => e.id));
    reload();
    showToast("All marked read");
  }, [visible, reload, showToast]);

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
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications, none unread"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifications"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
            <div>
              <p className="text-[11px] font-semibold text-slate-900">Notifications</p>
              <p className="text-[10px] text-slate-500">
                {unreadCount > 0
                  ? `${unreadCount} unread · click to open`
                  : "All caught up · click to open"}
              </p>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
              >
                <CheckCheck className="h-3 w-3" aria-hidden />
                Mark all read
              </button>
            ) : null}
          </div>

          {visible.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-slate-500">
              No notifications in this session.
            </p>
          ) : (
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {visible.map((event) => {
                const isRead = uiState.readIds.includes(event.id);
                return (
                  <li key={event.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openNotification(event)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openNotification(event);
                        }
                      }}
                      className={cn(
                        "group flex w-full cursor-pointer gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50",
                        !isRead && "bg-sky-50/40"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                          isRead ? "bg-transparent" : "bg-sky-500"
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-[12px] leading-snug",
                            isRead ? "font-medium text-slate-700" : "font-semibold text-slate-900"
                          )}
                        >
                          {event.summary}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {event.channel} · {event.at}
                          {event.ownerTeam ? ` · ${event.ownerTeam}` : ""}
                        </p>
                        <p className="mt-1 text-[10px] font-medium text-slate-600 opacity-0 transition group-hover:opacity-100">
                          {openLabelFor(event)} →
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        <button
                          type="button"
                          title="Share link"
                          aria-label="Share notification"
                          onClick={(e) => {
                            e.stopPropagation();
                            void shareNotification(event);
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          aria-label="Delete notification"
                          onClick={(e) => removeNotification(event.id, e)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        {!isRead ? (
                          <button
                            type="button"
                            title="Mark read"
                            aria-label="Mark as read"
                            onClick={(e) => {
                              e.stopPropagation();
                              markNotificationRead(event.id);
                              reload();
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {toast ? (
        <div
          className="fixed bottom-4 right-4 z-[120] rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-800 shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
