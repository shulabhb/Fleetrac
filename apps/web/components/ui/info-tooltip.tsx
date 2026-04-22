"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type InfoTooltipProps = {
  content: ReactNode;
  className?: string;
  ariaLabel?: string;
};

export function InfoTooltip({ content, className, ariaLabel = "More information" }: InfoTooltipProps) {
  return (
    <Tooltip.Provider delayDuration={120} skipDelayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30",
              className
            )}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={6}
            className="max-w-xs rounded-md bg-slate-900 px-2.5 py-2 text-xs leading-relaxed text-slate-100 shadow-lg data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in"
          >
            {content}
            <Tooltip.Arrow className="fill-slate-900" width={10} height={5} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
