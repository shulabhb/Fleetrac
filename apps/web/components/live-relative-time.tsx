"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Renders “Xm ago” style text and refreshes on an interval so the dashboard
 * queue does not go stale while the tab stays open.
 */
export function LiveRelativeTime({
  value,
  className
}: {
  value: string | number | Date | null | undefined;
  className?: string;
}) {
  const [text, setText] = useState(() => formatRelativeTime(value));

  useEffect(() => {
    const tick = () => setText(formatRelativeTime(value));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [value]);

  return (
    <span className={cn("tabular-nums", className)} suppressHydrationWarning>
      {text}
    </span>
  );
}
