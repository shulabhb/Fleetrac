import { getRules } from "@/lib/api";

export default async function RulesPage() {
  const { items } = await getRules();

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Rules</h2>
      <p className="text-slate-600">Active governance rules and threshold logic.</p>
      <div className="space-y-3">
        {items.map((rule: any) => (
          <article key={rule.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{rule.name}</h3>
              <span className="text-xs uppercase tracking-wide text-slate-500">{rule.severity}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{rule.description}</p>
            <p className="mt-2 text-sm">
              Logic: <code>{rule.observed_field}</code> {rule.comparator} <code>{rule.threshold_field}</code>
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
