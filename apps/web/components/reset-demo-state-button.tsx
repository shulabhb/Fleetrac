"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { resetDemoState } from "@/lib/demo-state";
import { resetBobState } from "@/lib/bob-state";

export function ResetDemoStateButton() {
  const [done, setDone] = useState(false);

  return (
    <button
      onClick={() => {
        resetDemoState();
        resetBobState();
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className="flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
      title="Reset in-memory demo actions for this browser session"
    >
      <RotateCcw className="h-3.5 w-3.5" />
      {done ? "Demo state reset" : "Reset demo state"}
    </button>
  );
}
