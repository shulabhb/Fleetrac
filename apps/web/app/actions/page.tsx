import { ActionCenterView } from "@/components/actions/action-center-view";
import { SectionTitle } from "@/components/ui/section-title";
import { getActions, getChanges, getSystems } from "@/lib/api";
import { AI_SCOPE_OPTIONS, normalizeAiScope, systemMatchesScope } from "@/lib/ai-scope";

type Segment =
  | "pending"
  | "ready"
  | "blocked"
  | "executed"
  | "rollback"
  | "closed_rejected";

const VALID_SEGMENTS: Segment[] = [
  "pending",
  "ready",
  "blocked",
  "executed",
  "rollback",
  "closed_rejected"
];

export default async function ActionCenterPage({
  searchParams
}: {
  searchParams?: Promise<{ tab?: string; scope?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const requestedTab = params.tab;
  const scope = normalizeAiScope(params.scope);
  const scopeLabel =
    AI_SCOPE_OPTIONS.find((opt) => opt.id === scope)?.label ?? "All";
  const defaultTab: Segment | undefined =
    requestedTab && VALID_SEGMENTS.includes(requestedTab as Segment)
      ? (requestedTab as Segment)
      : undefined;

  const [{ items }, changesRes, systemsRes] = await Promise.all([
    getActions(),
    getChanges().catch(() => ({ items: [] })),
    getSystems().catch(() => ({ items: [] as any[] }))
  ]);
  const scopedSystemIds = new Set(
    (systemsRes.items ?? [])
      .filter((system: any) => systemMatchesScope(system, scope))
      .map((system: any) => system.id)
  );
  const filteredActions = (items ?? []).filter(
    (action: any) =>
      !action.target_system_id || scopedSystemIds.has(action.target_system_id)
  );
  const filteredChanges = (changesRes.items ?? []).filter(
    (change: any) =>
      !change.target_system_id || scopedSystemIds.has(change.target_system_id)
  );
  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow="Act · Governed remediation"
        title="Action Center"
        caption={`Governed action inbox for approval, blocked decisions, bounded execution, and rollback preparation. Profile scope: ${scopeLabel}.`}
      />
      <ActionCenterView
        actions={filteredActions}
        changes={filteredChanges}
        defaultTab={defaultTab}
      />
    </section>
  );
}
