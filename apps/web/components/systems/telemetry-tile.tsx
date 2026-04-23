import { TrendChart } from "@/components/charts/trend-chart";
import { formatMetric } from "@/lib/format";

type TelemetryTileProps = {
  label: string;
  /**
   * Threshold-style helper line, e.g. "Review above 0.25" or "SLA at 1500 ms".
   * Presented as a quiet governance-threshold tagline under the metric label.
   */
  threshold?: string;
  data: { t: string | number | Date; v: number | null }[];
  thresholdValue?: number;
  thresholdLabel?: string;
  color: string;
  unit?: string;
  yDigits?: number;
};

/**
 * Canonical telemetry tile for the System Detail Telemetry Trends block.
 *
 *   [LABEL]                           [last value]
 *   threshold tagline                 (right-aligned, tabular)
 *   ───── trend chart ─────
 *
 * Intentionally restrained; this is evidence, not decoration. Headline metric
 * is visually dominant; threshold copy sits directly under the label so the
 * governance rule is always adjacent to the reading.
 */
export function TelemetryTile({
  label,
  threshold,
  data,
  thresholdValue,
  thresholdLabel,
  color,
  unit,
  yDigits
}: TelemetryTileProps) {
  const values = data.map((d) => d.v).filter((v): v is number => v != null);
  const last = values[values.length - 1];
  const overThreshold =
    thresholdValue != null && last != null
      ? // For audit-coverage-style floors the threshold logic is inverted; we
        // lean conservative here and only emphasize when values clearly cross
        // the line in the direction of risk, ignoring the floor case.
        unit === "%" && label.toLowerCase().includes("audit")
        ? last < thresholdValue
        : last > thresholdValue
      : false;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          {threshold ? (
            <p className="mt-0.5 text-[11px] text-slate-500">{threshold}</p>
          ) : null}
        </div>
        <p
          className={`shrink-0 tabular-nums text-lg font-semibold ${
            overThreshold ? "text-rose-700" : "text-slate-900"
          }`}
        >
          {last != null ? formatMetric(last, { digits: yDigits, unit }) : "—"}
        </p>
      </div>
      <div className="mt-2">
        <TrendChart
          data={data}
          threshold={thresholdValue}
          thresholdLabel={thresholdLabel}
          color={color}
          unit={unit}
          height={92}
          showXAxis={false}
          yDigits={yDigits}
        />
      </div>
    </div>
  );
}
