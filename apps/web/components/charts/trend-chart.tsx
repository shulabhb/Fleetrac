"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatShortDateTime } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";

export type TrendPoint = { t: string | number | Date; v: number | null };

type TrendChartProps = {
  data: TrendPoint[];
  height?: number;
  unit?: string;
  threshold?: number | null;
  thresholdLabel?: string;
  domain?: [number | "auto", number | "auto"];
  color?: string;
  yTicks?: number;
  showXAxis?: boolean;
  yDigits?: number;
};

export function TrendChart({
  data,
  height = 180,
  unit,
  threshold,
  thresholdLabel,
  domain = ["auto", "auto"],
  color = "#0f172a",
  showXAxis = true,
  yDigits = 2
}: TrendChartProps) {
  const mounted = useMounted();
  const safe = (data ?? []).filter((p) => p.v != null) as { t: string | number | Date; v: number }[];
  if (!mounted) {
    return <div style={{ height }} className="w-full rounded-md bg-slate-50/40" aria-hidden />;
  }
  if (safe.length < 2) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400"
        style={{ height }}
      >
        Not enough telemetry points to render a trend yet.
      </div>
    );
  }
  const formatted = safe.map((p) => ({
    ts: new Date(p.t).getTime(),
    label: formatShortDateTime(p.t),
    v: p.v
  }));

  return (
    <div style={{ width: "100%", minWidth: 0, height, minHeight: height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={formatted} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eef2f6" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            domain={["dataMin", "dataMax"]}
            hide={!showXAxis}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) =>
              new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })
            }
            minTickGap={28}
          />
          <YAxis
            width={36}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            domain={domain}
            tickFormatter={(v) => {
              const num = Number(v);
              if (Number.isNaN(num)) return `${v}`;
              return Math.abs(num) >= 1000 ? num.toFixed(0) : num.toFixed(yDigits);
            }}
          />
          <Tooltip
            cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }}
            contentStyle={{
              background: "#0f172a",
              border: "none",
              borderRadius: 6,
              color: "#f8fafc",
              fontSize: 12,
              padding: "6px 10px"
            }}
            labelFormatter={(value) => formatShortDateTime(new Date(value as number))}
            formatter={(value) => {
              const num = typeof value === "number" ? value : Number(value);
              const display = Number.isFinite(num) ? num.toFixed(yDigits) : value;
              return [`${display}${unit ?? ""}`, "Value"];
            }}
          />
          {threshold != null ? (
            <ReferenceLine
              y={threshold}
              stroke="#e11d48"
              strokeDasharray="4 3"
              strokeWidth={1.25}
              label={{
                value: thresholdLabel ?? `Threshold ${threshold}${unit ?? ""}`,
                position: "insideTopRight",
                fill: "#be123c",
                fontSize: 10
              }}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.75}
            dot={false}
            activeDot={{ r: 3, fill: color, stroke: "#fff", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
