import type { ActionType } from "@/lib/action-types";
import { actionTypeLabel } from "./action-badges";

export * from "./action-badges";

export function ActionTypeChip({
  type,
  className
}: {
  type: ActionType;
  className?: string;
}) {
  return (
    <span
      className={
        "inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200 " +
        (className ?? "")
      }
    >
      {actionTypeLabel(type)}
    </span>
  );
}
