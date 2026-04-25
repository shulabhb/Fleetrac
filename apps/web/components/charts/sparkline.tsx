"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useMounted } from "@/lib/use-mounted";

type SparklineProps = {
  points: number[];
  tone?: "accent" | "danger" | "ok" | "warn";
  height?: number;
};

const tones = {
  accent: { stroke: "#0f172a", fill: "rgba(15, 23, 42, 0.08)" },
  danger: { stroke: "#be123c", fill: "rgba(190, 18, 60, 0.08)" },
  ok: { stroke: "#047857", fill: "rgba(4, 120, 87, 0.08)" },
  warn: { stroke: "#b45309", fill: "rgba(180, 83, 9, 0.08)" }
};

export function Sparkline({ points, tone = "accent", height = 44 }: SparklineProps) {
  const mounted = useMounted();
  if (!mounted) {
    return <div style={{ height }} className="w-full rounded-md bg-slate-50/40" aria-hidden />;
  }
  if (!points || points.length < 2) {
    return <div style={{ height }} className="w-full rounded-md bg-slate-50" aria-hidden />;
  }
  const data = points.map((v, i) => ({ i, v }));
  const { stroke, fill } = tones[tone];
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={height}>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${tone}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={1.75}
            fill={`url(#spark-${tone})`}
            isAnimationActive={false}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
