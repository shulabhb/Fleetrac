import { ActionCenterView } from "@/components/actions/action-center-view";
import { SectionTitle } from "@/components/ui/section-title";
import { getActions, getChanges } from "@/lib/api";

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
  searchParams?: Promise<{ tab?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const requestedTab = params.tab;
  const defaultTab: Segment | undefined =
    requestedTab && VALID_SEGMENTS.includes(requestedTab as Segment)
      ? (requestedTab as Segment)
      : undefined;

  const [{ items }, changesRes] = await Promise.all([
    getActions(),
    getChanges().catch(() => ({ items: [] }))
  ]);
  return (
    <section className="space-y-5">
      <SectionTitle
        eyebrow="Act · Governed remediation"
        title="Action Center"
        caption="Governed action inbox for approval, blocked decisions, bounded execution, and rollback preparation."
      />
      <ActionCenterView
        actions={items}
        changes={changesRes.items}
        defaultTab={defaultTab}
      />
    </section>
  );
}
