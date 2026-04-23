"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TrendChart, type TrendPoint } from "@/components/charts/trend-chart";
import { cn } from "@/lib/cn";

export type AnalyticsView = {
  id: string;
  label: string;
  caption: string;
  info: string;
  data: TrendPoint[];
  threshold?: number | null;
  thresholdLabel?: string;
  unit?: string;
  summary?: string;
  color?: string;
  yDigits?: number;
};

type AnalyticsStripProps = {
  views: AnalyticsView[];
  defaultViewId?: string;
};

/**
 * Fleet Analytics chart module. The header is intentionally restrained:
 * one eyebrow (the product concept), one dynamic title (the active view),
 * one quiet caption, and a row of segmented-button tabs. The plot area is
 * kept clean so the trend itself is the signal.
 */
export function AnalyticsStrip({ views, defaultViewId }: AnalyticsStripProps) {
  const [activeId, setActiveId] = useState(defaultViewId ?? views[0]?.id);
  const active = views.find((v) => v.id === activeId) ?? views[0];
  if (!active) return null;

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="label-eyebrow">Fleet analytics</p>
            <InfoTooltip
              content={active.info}
              ariaLabel={`About ${active.label}`}
            />
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="text-sm font-semibold text-slate-900">
              {active.label}
            </h3>
            {active.summary ? (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-700">
                {active.summary}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">{active.caption}</p>
        </div>
        <div
          role="tablist"
          aria-label="Fleet analytics views"
          className="flex flex-wrap items-center gap-1"
        >
          {views.map((view) => (
            <button
              key={view.id}
              role="tab"
              aria-selected={view.id === active.id}
              onClick={() => setActiveId(view.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[11px] font-medium transition",
                view.id === active.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              )}
              type="button"
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-2 pb-2 pt-1">
        <TrendChart
          data={active.data}
          threshold={active.threshold ?? undefined}
          thresholdLabel={active.thresholdLabel}
          unit={active.unit}
          color={active.color ?? "#0f172a"}
          height={200}
          yDigits={active.yDigits ?? 2}
        />
      </div>
    </Card>
  );
}
