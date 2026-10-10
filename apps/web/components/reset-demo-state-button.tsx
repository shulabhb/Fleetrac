"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { resetDemoState } from "@/lib/demo-state";
import { resetBobState } from "@/lib/bob-state";
import { resetNotificationState } from "@/lib/notification-state";
import { notifyGovernanceUpdated } from "@/lib/governance-api";

export function ResetDemoStateButton() {
  const [done, setDone] = useState(false);

  return (
    <button
      onClick={() => {
        resetDemoState();
        resetBobState();
        resetNotificationState();
        notifyGovernanceUpdated();
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className="flex w-full items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
      title="Clear this browser session and reset local runtime records"
    >
      <RotateCcw className="h-3.5 w-3.5" />
      {done ? "Workspace reset" : "Reset workspace"}
    </button>
  );
}
