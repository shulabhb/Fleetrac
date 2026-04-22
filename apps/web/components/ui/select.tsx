"use client";

import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "h-8 min-w-[8rem] rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 shadow-sm",
        "focus:border-slate-400 focus:outline-none",
        "hover:border-slate-300",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
