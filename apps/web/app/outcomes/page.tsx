import { SectionTitle } from "@/components/ui/section-title";
import { OutcomesView } from "@/components/operations/outcomes-view";
import { getChanges, getSystems } from "@/lib/api";

export const dynamic = "force-dynamic";

type SearchParams = {
  system?: string;
  tab?: string;
};

export default async function OutcomesPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const systemFilter = params.system ?? null;

  const [changesRes, systemsRes] = await Promise.all([
    getChanges(
      systemFilter ? { target_system_id: systemFilter } : undefined
    ),
    systemFilter
      ? getSystems().catch(() => ({ items: [] as any[] }))
      : Promise.resolve({ items: [] as any[] })
  ]);

  const scopedSystem = systemFilter
    ? systemsRes.items.find((s: any) => s.id === systemFilter)
    : null;

  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow={
          scopedSystem
            ? `System · ${scopedSystem.use_case}`
            : "Post-remediation review"
        }
        title="Outcomes"
        caption={
          scopedSystem
            ? `Measured outcomes of governed changes on ${scopedSystem.use_case}. Expected vs. actual, recurrence, reviewer burden, and next step.`
            : "Measured outcomes of governed changes. Expected vs. actual on monitored metrics, follow-up state, and rollback decisions."
        }
      />
      <OutcomesView
        changes={changesRes.items}
        systemFilter={systemFilter}
      />
    </section>
  );
}
