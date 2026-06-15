import type { NotificationEvent } from "@/lib/governance-notification-types";

export function NotificationTimeline({
  events,
  limit = 3
}: {
  events: NotificationEvent[];
  limit?: number;
}) {
  const slice = events.slice(0, limit);
  if (!slice.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Recent notifications
      </p>
      <ul className="mt-2 divide-y divide-slate-100">
        {slice.map((e) => (
          <li key={e.id} className="py-2 text-[12px]">
            <p className="font-medium text-slate-800">{e.summary}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {e.channel} · {e.at}
              {e.ownerTeam ? ` · ${e.ownerTeam}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
