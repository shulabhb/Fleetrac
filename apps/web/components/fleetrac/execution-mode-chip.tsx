import { Badge } from "@/components/ui/badge";
import type { GovernedExecutionMode } from "@/lib/governed-actions-types";

const LABEL: Record<GovernedExecutionMode, string> = {
  approval_required: "Approval required",
  auto_in_scope: "Auto in scope",
  notify_only: "Notify only"
};

const TONE: Record<GovernedExecutionMode, "neutral" | "info" | "low"> = {
  approval_required: "neutral",
  auto_in_scope: "low",
  notify_only: "info"
};

export function ExecutionModeChip({ mode }: { mode: GovernedExecutionMode }) {
  return (
    <Badge tone={TONE[mode]} size="xs">
      {LABEL[mode]}
    </Badge>
  );
}
