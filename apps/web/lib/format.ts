/** Fixed locale so server-rendered strings match the browser during hydration. */
const DISPLAY_LOCALE = "en-US";

/** API datetimes are UTC. Values without a zone were being read as local time. */
export function parseApiTimestamp(value: string | number | Date): Date {
  if (typeof value === "number" || value instanceof Date) return new Date(value);
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmed)) {
    return new Date(`${trimmed.replace(" ", "T")}Z`);
  }
  return new Date(trimmed);
}

export function formatRelativeTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const date = parseApiTimestamp(value);
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
  const date = parseApiTimestamp(value);
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
