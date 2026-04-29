import Link from "next/link";
import { SectionTitle } from "@/components/ui/section-title";
import {
  UsageAnalyticsSurface,
  type UsageRow,
  type UsageSeriesPoint
} from "@/components/usage-analytics-surface";
import { getIncidents, getSystems, getTelemetryEvents } from "@/lib/api";
import { formatInteger } from "@/lib/format";
import {
  AI_SCOPE_OPTIONS,
  normalizeAiScope,
  systemMatchesScope,
  withAiScope
} from "@/lib/ai-scope";
import { routes } from "@/lib/routes";

function stableVarianceSeed(label: string): number {
  return label.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 11;
}

function expectedFromProd(label: string, prod: number): number {
  const seed = stableVarianceSeed(label);
  const ratio = 0.9 + (seed - 5) * 0.015;
  return Math.max(0, prod * ratio);
}

function estimateEventTokens(event: any): number {
  const cost = Number(event.cost_per_1k_requests ?? 0);
  const latency = Number(event.latency_p95_ms ?? 0);
  const riskSignals = Array.isArray(event.risk_signals) ? event.risk_signals.length : 0;
  return Math.max(400, Math.round(cost * 18 + latency * 2 + riskSignals * 120));
}

function toSeries(events: any[]): UsageSeriesPoint[] {
  return events
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((event) => ({
      t: event.timestamp,
      cost: Number(event.cost_per_1k_requests ?? 0),
      tokens: estimateEventTokens(event)
    }));
}

export default async function UsagePage({
  searchParams
}: {
  searchParams?: Promise<{ scope?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const scope = normalizeAiScope(sp.scope);
  const scopeLabel =
    AI_SCOPE_OPTIONS.find((opt) => opt.id === scope)?.label ?? "All";

  const [systemsRes, incidentsRes, telemetryRes] = await Promise.all([
    getSystems(),
    getIncidents(),
    getTelemetryEvents("?limit=700")
  ]);

  const systems = (systemsRes.items ?? []).filter((s: any) => systemMatchesScope(s, scope));
  const systemIds = new Set(systems.map((s: any) => s.id));
  const incidents = (incidentsRes.items ?? []).filter((i: any) => systemIds.has(i.system_id));
  const telemetry = (telemetryRes.items ?? []).filter((t: any) => systemIds.has(t.system_id));

  const telemetryBySystem = telemetry.reduce((map: Map<string, any[]>, event: any) => {
    const key = String(event.system_id);
    const next = map.get(key) ?? [];
    next.push(event);
    map.set(key, next);
    return map;
  }, new Map<string, any[]>());

  const modelRows: UsageRow[] = Array.from(
    telemetry.reduce((map: Map<string, any[]>, t: any) => {
      const key = t.model_name || "Unknown model";
      const next = map.get(key) ?? [];
      next.push(t);
      map.set(key, next);
      return map;
    }, new Map<string, any[]>())
  )
    .map(([label, events]) => {
      const prodCost = events.reduce((acc, event) => acc + Number(event.cost_per_1k_requests ?? 0), 0);
      const prodTokens = events.reduce((acc, event) => acc + estimateEventTokens(event), 0);
      return {
        id: `model_${label}`,
        label,
        prodCost,
        expectedCost: expectedFromProd(label, prodCost),
        prodTokens,
        expectedTokens: expectedFromProd(`${label}_tokens`, prodTokens),
        series: toSeries(events)
      };
    })
    .sort((a, b) => b.prodCost - a.prodCost)
    .slice(0, 8);

  const groupRows: UsageRow[] = Array.from(
    incidents.reduce((map: Map<string, any[]>, i: any) => {
      const owner = i.owner_team || "Unassigned";
      const eventSlice = (telemetryBySystem.get(i.system_id) ?? []).slice(0, 6);
      const next = map.get(owner) ?? [];
      next.push(...eventSlice);
      map.set(owner, next);
      return map;
    }, new Map<string, any[]>())
  )
    .map(([label, events]) => {
      const prodCost = events.reduce((acc, event) => acc + Number(event.cost_per_1k_requests ?? 0), 0);
      const prodTokens = events.reduce((acc, event) => acc + estimateEventTokens(event), 0);
      return {
        id: `group_${label}`,
        label,
        prodCost,
        expectedCost: expectedFromProd(label, prodCost),
        prodTokens,
        expectedTokens: expectedFromProd(`${label}_tokens`, prodTokens),
        series: toSeries(events)
      };
    })
    .sort((a, b) => b.prodCost - a.prodCost)
    .slice(0, 8);

  const fleetRows: UsageRow[] = [
    ...Array.from(
      telemetry.reduce((map: Map<string, any[]>, t: any) => {
        const system = systems.find((s: any) => s.id === t.system_id);
        const env = system?.environment ? `Environment: ${system.environment}` : "Environment: unknown";
        const next = map.get(env) ?? [];
        next.push(t);
        map.set(env, next);
        return map;
      }, new Map<string, any[]>())
    ).map(([label, events]) => {
      const prodCost = events.reduce((acc, event) => acc + Number(event.cost_per_1k_requests ?? 0), 0);
      const prodTokens = events.reduce((acc, event) => acc + estimateEventTokens(event), 0);
      return {
        id: `fleet_${label}`,
        label,
        prodCost,
        expectedCost: expectedFromProd(label, prodCost),
        prodTokens,
        expectedTokens: expectedFromProd(`${label}_tokens`, prodTokens),
        series: toSeries(events)
      };
    }),
    ...Array.from(
      telemetry.reduce((map: Map<string, any[]>, t: any) => {
        const lower = String(t.model_name ?? "").toLowerCase();
        const provider = lower.includes("gpt")
          ? "Provider: OpenAI"
          : lower.includes("claude")
            ? "Provider: Anthropic"
            : lower.includes("gemini")
              ? "Provider: Google"
              : "Provider: Other";
        const next = map.get(provider) ?? [];
        next.push(t);
        map.set(provider, next);
        return map;
      }, new Map<string, any[]>())
    ).map(([label, events]) => {
      const prodCost = events.reduce((acc, event) => acc + Number(event.cost_per_1k_requests ?? 0), 0);
      const prodTokens = events.reduce((acc, event) => acc + estimateEventTokens(event), 0);
      return {
        id: `fleet_${label}`,
        label,
        prodCost,
        expectedCost: expectedFromProd(label, prodCost),
        prodTokens,
        expectedTokens: expectedFromProd(`${label}_tokens`, prodTokens),
        series: toSeries(events)
      };
    })
  ]
    .sort((a, b) => b.prodCost - a.prodCost)
    .slice(0, 10);

  const fleetProdCost = telemetry.reduce(
    (acc, event) => acc + Number(event.cost_per_1k_requests ?? 0),
    0
  );
  const fleetExpectedCost = expectedFromProd("fleet", fleetProdCost);
  const fleetProdTokens = telemetry.reduce((acc, event) => acc + estimateEventTokens(event), 0);
  const fleetExpectedTokens = expectedFromProd("fleet_tokens", fleetProdTokens);
  const telemetryStart = telemetry.reduce(
    (min, event) => Math.min(min, new Date(event.timestamp).getTime()),
    Number.POSITIVE_INFINITY
  );
  const telemetryEnd = telemetry.reduce(
    (max, event) => Math.max(max, new Date(event.timestamp).getTime()),
    0
  );
  const observedDays = Math.max(1, (telemetryEnd - telemetryStart) / (1000 * 60 * 60 * 24));
  const cycleDays = 30;
  const fleetProjectedCycleCost = (fleetProdCost / observedDays) * cycleDays;
  const fleetProjectedCycleTokens = (fleetProdTokens / observedDays) * cycleDays;

  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow="Measure · cost governance"
        title="Usage"
        caption={`Profile scope: ${scopeLabel} · ${formatInteger(systems.length)} systems · ${formatInteger(incidents.length)} incidents in view.`}
        actions={
          <Link
            href={withAiScope(routes.dashboard(), scope)}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
          >
            Back to dashboard →
          </Link>
        }
      />
      <UsageAnalyticsSurface
        modelRows={modelRows}
        groupRows={groupRows}
        fleetRows={fleetRows}
        fleetExpectedCost={fleetExpectedCost}
        fleetProdCost={fleetProdCost}
        fleetProjectedCycleCost={fleetProjectedCycleCost}
        fleetExpectedTokens={fleetExpectedTokens}
        fleetProdTokens={fleetProdTokens}
        fleetProjectedCycleTokens={fleetProjectedCycleTokens}
      />
    </section>
  );
}
