/** Fixed locale so server-rendered strings match the browser during hydration. */
const DISPLAY_LOCALE = "en-US";

export function formatRelativeTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const abs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return "just now";
  if (abs < hour) return `${Math.round(abs / minute)}m ago`;
  if (abs < day) return `${Math.round(abs / hour)}h ago`;
  if (abs < 7 * day) return `${Math.round(abs / day)}d ago`;
  return date.toLocaleDateString(DISPLAY_LOCALE, { month: "short", day: "numeric" });
}

export function formatShortDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(DISPLAY_LOCALE, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function formatMetric(value: number | null | undefined, opts?: { unit?: string; digits?: number }): string {
  if (value == null || Number.isNaN(value)) return "—";
  const digits = opts?.digits ?? (Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2);
  const formatted = Number(value).toFixed(digits);
  return opts?.unit ? `${formatted}${opts.unit}` : formatted;
}

export function formatInteger(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(DISPLAY_LOCALE).format(Math.round(value));
}
