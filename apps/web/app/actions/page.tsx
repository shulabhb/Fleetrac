import { ActionCenterWorkspace } from "@/components/actions/action-center-workspace";
import type { ActionTab } from "@/components/actions/action-center-workspace";
import { AI_SCOPE_OPTIONS, normalizeAiScope } from "@/lib/ai-scope";

type LegacyTab =
  | "pending"
  | "ready"
  | "blocked"
  | "executed"
  | "rollback"
  | "closed_rejected"
  | "closed";

const VALID_TABS = new Set<string>([
  "pending",
  "ready",
  "closed",
  "blocked",
  "executed",
  "rollback",
  "closed_rejected"
]);

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
  const defaultTab: ActionTab | LegacyTab | undefined =
    requestedTab && VALID_TABS.has(requestedTab)
      ? (requestedTab as ActionTab | LegacyTab)
      : undefined;

  return <ActionCenterWorkspace defaultTab={defaultTab} scopeLabel={scopeLabel} />;
}
