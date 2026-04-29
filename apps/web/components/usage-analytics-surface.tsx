"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { formatInteger, formatMetric, formatShortDateTime } from "@/lib/format";
import { TrendChart } from "@/components/charts/trend-chart";

export type UsageSeriesPoint = {
  t: string;
  cost: number;
  tokens: number;
};

export type UsageRow = {
  id: string;
  label: string;
  expectedCost: number;
  prodCost: number;
  expectedTokens: number;
  prodTokens: number;
  series: UsageSeriesPoint[];
};

type UsageAnalyticsSurfaceProps = {
  modelRows: UsageRow[];
  groupRows: UsageRow[];
  fleetRows: UsageRow[];
  fleetExpectedCost: number;
  fleetProdCost: number;
  fleetProjectedCycleCost: number;
  fleetExpectedTokens: number;
  fleetProdTokens: number;
  fleetProjectedCycleTokens: number;
};

function deltaPct(expected: number, prod: number): number {
  if (!expected) return 0;
  return ((prod - expected) / expected) * 100;
}

function UsageTable({
  title,
  caption,
  rows,
  onOpen
}: {
  title: string;
  caption: string;
  rows: UsageRow[];
  onOpen: (row: UsageRow) => void;
}) {
  return (
    <Card>
      <CardHeader title={title} caption={caption} />
      <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Category</th>
              <th className="px-3 py-2 text-right font-semibold">Expected Cost</th>
              <th className="px-3 py-2 text-right font-semibold">Prod Cost</th>
              <th className="px-3 py-2 text-right font-semibold">Tokens (Prod)</th>
              <th className="px-3 py-2 text-right font-semibold">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => {
              const variance = deltaPct(row.expectedCost, row.prodCost);
              return (
                <tr
                  key={row.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => onOpen(row)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onOpen(row);
                  }}
                  aria-label={`Open detailed usage view for ${row.label}`}
                >
                  <td className="px-3 py-2 text-[13px] font-medium text-slate-900">{row.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    ${formatMetric(row.expectedCost, { digits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                    ${formatMetric(row.prodCost, { digits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                    {formatInteger(Math.round(row.prodTokens))}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums font-semibold ${
                      variance > 0 ? "text-rose-700" : variance < 0 ? "text-emerald-700" : "text-slate-600"
                    }`}
                  >
                    {variance >= 0 ? "+" : ""}
                    {formatMetric(variance, { digits: 1 })}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Click any row to open a detailed chart window.
      </p>
    </Card>
  );
}

export function UsageAnalyticsSurface(props: UsageAnalyticsSurfaceProps) {
  const {
    modelRows,
    groupRows,
    fleetRows,
    fleetExpectedCost,
    fleetProdCost,
    fleetProjectedCycleCost,
    fleetExpectedTokens,
    fleetProdTokens,
    fleetProjectedCycleTokens
  } = props;
  const [selected, setSelected] = useState<UsageRow | null>(null);

  const modalSeries = useMemo(() => selected?.series ?? [], [selected]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader title="Projected end-of-cycle cost" caption="30-day estimate at current run-rate." />
          <p className="mt-2 tabular-nums text-lg font-semibold text-slate-900">
            ${formatMetric(fleetProjectedCycleCost, { digits: 2 })}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Current prod: ${formatMetric(fleetProdCost, { digits: 2 })} · Expected: $
            {formatMetric(fleetExpectedCost, { digits: 2 })}
          </p>
        </Card>
        <Card>
          <CardHeader title="Projected end-of-cycle tokens" caption="Estimated total token volume by cycle end." />
          <p className="mt-2 tabular-nums text-lg font-semibold text-slate-900">
            {formatInteger(Math.round(fleetProjectedCycleTokens))}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Current prod: {formatInteger(Math.round(fleetProdTokens))} · Expected:{" "}
            {formatInteger(Math.round(fleetExpectedTokens))}
          </p>
        </Card>
        <Card>
          <CardHeader title="Token variance" caption="Production token volume vs expected baseline." />
          <p
            className={`mt-2 tabular-nums text-lg font-semibold ${
              deltaPct(fleetExpectedTokens, fleetProdTokens) > 0
                ? "text-rose-700"
                : deltaPct(fleetExpectedTokens, fleetProdTokens) < 0
                  ? "text-emerald-700"
                  : "text-slate-700"
            }`}
          >
            {deltaPct(fleetExpectedTokens, fleetProdTokens) >= 0 ? "+" : ""}
            {formatMetric(deltaPct(fleetExpectedTokens, fleetProdTokens), { digits: 1 })}%
          </p>
          <p className="mt-1 text-xs text-slate-500">Scope-adjusted from active profile filters.</p>
        </Card>
      </div>

      <UsageTable
        title="Model-wise usage"
        caption="Cost and token usage by model. Click row for details."
        rows={modelRows}
        onOpen={setSelected}
      />

      <UsageTable
        title="Group-wise usage"
        caption="Cost and token usage by owner group. Click row for details."
        rows={groupRows}
        onOpen={setSelected}
      />

      <UsageTable
        title="Fleet-wise usage"
        caption="Environment and provider segments. Click row for details."
        rows={fleetRows}
        onOpen={setSelected}
      />

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg border border-slate-300 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{selected.label} · Detailed usage</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Prod cost ${formatMetric(selected.prodCost, { digits: 2 })} · Expected $
                  {formatMetric(selected.expectedCost, { digits: 2 })} · Prod tokens{" "}
                  {formatInteger(Math.round(selected.prodTokens))}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card surface="support">
                <CardHeader title="Cost trend" caption="Observed cost index per telemetry point." />
                <div className="mt-2">
                  <TrendChart
                    data={modalSeries.map((p) => ({ t: p.t, v: p.cost }))}
                    yDigits={2}
                    color="#1f2937"
                    height={220}
                  />
                </div>
              </Card>
              <Card surface="support">
                <CardHeader title="Token trend" caption="Estimated token volume per telemetry point." />
                <div className="mt-2">
                  <TrendChart
                    data={modalSeries.map((p) => ({ t: p.t, v: p.tokens }))}
                    yDigits={0}
                    color="#334155"
                    height={220}
                  />
                </div>
              </Card>
            </div>

            <Card className="mt-4" surface="audit">
              <CardHeader title="Recent points" caption="Most recent telemetry samples for this row." />
              <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold">Timestamp</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Cost</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Tokens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {modalSeries.slice(-8).reverse().map((p, idx) => (
                      <tr key={`${p.t}-${idx}`}>
                        <td className="px-2 py-1.5 text-slate-700">{formatShortDateTime(p.t)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-900">
                          ${formatMetric(p.cost, { digits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-900">
                          {formatInteger(Math.round(p.tokens))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
