"use client";

import { useState } from "react";
import { resetDemoState } from "@/lib/demo-state";

export function ResetDemoStateButton() {
  const [done, setDone] = useState(false);

  return (
    <button
      onClick={() => {
        resetDemoState();
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="mt-6 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
      title="Reset in-memory demo actions for this browser session"
    >
      {done ? "Demo State Reset" : "Reset Demo State"}
    </button>
  );
}
