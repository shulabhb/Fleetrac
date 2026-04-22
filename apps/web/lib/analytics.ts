import type { TrendPoint } from "@/components/charts/trend-chart";

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDayUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function lastNDaysBuckets(n: number, reference: Date = new Date()): Date[] {
  const end = startOfDayUTC(reference);
  return Array.from({ length: n }, (_, i) => new Date(end.getTime() - (n - 1 - i) * DAY_MS));
}

type AggregateOptions = {
  valueFn: (event: any) => number | null;
  reducer?: "avg" | "sum" | "max" | "count" | "minUnder" | "below_threshold_count";
  filter?: (event: any) => boolean;
  days?: number;
  thresholdBelow?: number;
  timestampKey?: string;
};

export function aggregateByDay(events: any[], options: AggregateOptions): TrendPoint[] {
  const {
    valueFn,
    reducer = "avg",
    filter,
    days = 7,
    thresholdBelow,
    timestampKey = "timestamp"
  } = options;
  const buckets = lastNDaysBuckets(days);
  const groups = buckets.map((bucket) => ({
    t: bucket,
    values: [] as number[],
    count: 0
  }));
  const firstBucketTs = buckets[0].getTime();

  for (const event of events ?? []) {
    if (filter && !filter(event)) continue;
    const ts = new Date(event[timestampKey] ?? event.created_at ?? event.timestamp).getTime();
    if (!Number.isFinite(ts)) continue;
    const dayTs = startOfDayUTC(new Date(ts)).getTime();
    if (dayTs < firstBucketTs) continue;
    const bucket = groups.find((g) => g.t.getTime() === dayTs);
    if (!bucket) continue;
    bucket.count += 1;
    const val = valueFn(event);
    if (val == null || Number.isNaN(val)) continue;
    bucket.values.push(val);
  }

  return groups.map((g) => {
    let v: number | null = null;
    if (reducer === "count") v = g.count;
    else if (reducer === "sum") v = g.values.reduce((a, b) => a + b, 0);
    else if (reducer === "max") v = g.values.length ? Math.max(...g.values) : null;
    else if (reducer === "avg")
      v = g.values.length ? g.values.reduce((a, b) => a + b, 0) / g.values.length : null;
    else if (reducer === "below_threshold_count" && thresholdBelow != null) {
      v = g.values.filter((val) => val < thresholdBelow).length;
    }
    return { t: g.t, v };
  });
}

export function percentChange(series: TrendPoint[]): number | null {
  const nums = series.map((p) => (p.v == null ? NaN : p.v)).filter((n) => !Number.isNaN(n));
  if (nums.length < 2) return null;
  const first = nums[0];
  const last = nums[nums.length - 1];
  if (first === 0) return null;
  return ((last - first) / Math.abs(first)) * 100;
}

export function sumSeries(series: TrendPoint[]): number {
  return series.reduce((acc, p) => acc + (p.v ?? 0), 0);
}
