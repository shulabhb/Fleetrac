"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

export type BarListItem = {
  label: string;
  value: number;
  href?: string;
  hint?: string;
};

type BarListProps = {
  items: BarListItem[];
  max?: number;
  tone?: "accent" | "danger" | "warn" | "ok";
  valueFormatter?: (value: number) => string;
  showPercent?: boolean;
  className?: string;
};

const toneBar: Record<string, string> = {
  accent: "bg-slate-800",
  danger: "bg-rose-600",
  warn: "bg-amber-500",
  ok: "bg-emerald-600"
};

export function BarList({
  items,
  max,
  tone = "accent",
  valueFormatter,
  showPercent,
  className
}: BarListProps) {
  if (!items.length) {
    return <p className="text-sm text-slate-500">No data in this window.</p>;
  }
  const total = items.reduce((sum, i) => sum + i.value, 0);
  const upper = max ?? Math.max(...items.map((i) => i.value), 1);
  const format = valueFormatter ?? ((v: number) => String(v));
  const sorted = [...items].sort((a, b) => b.value - a.value);

  return (
    <ul className={cn("space-y-2", className)}>
      {sorted.map((item) => {
        const pct = Math.max(4, (item.value / upper) * 100);
        const sharePct = total > 0 ? Math.round((item.value / total) * 100) : 0;
        const Row = (
          <div className="group">
            <div className="flex items-baseline justify-between gap-3">
              <span
                className="truncate text-xs font-medium text-slate-700 group-hover:text-slate-900"
                title={item.label}
              >
                {item.label}
              </span>
              <span className="flex items-baseline gap-1.5 text-xs">
                <span className="tabular-nums font-semibold text-slate-900">
                  {format(item.value)}
                </span>
                {showPercent && total > 0 ? (
                  <span className="tabular-nums text-[11px] text-slate-400">
                    {sharePct}%
                  </span>
                ) : null}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  toneBar[tone]
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            {item.hint ? (
              <p className="mt-0.5 text-[11px] text-slate-500">{item.hint}</p>
            ) : null}
          </div>
        );
        return (
          <li key={item.label}>
            {item.href ? (
              <Link
                href={item.href}
                className="block rounded-md px-1 py-0.5 hover:bg-slate-50"
              >
                {Row}
              </Link>
            ) : (
              <div className="px-1 py-0.5">{Row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
