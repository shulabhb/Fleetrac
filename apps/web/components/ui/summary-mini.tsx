export function SummaryMini({
  label,
  value,
  compact = false
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="rounded border border-slate-100 bg-slate-50/50 px-2 py-1.5">
        <p className="text-[10px] leading-tight text-slate-500">{label}</p>
        <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-slate-900">
          {value}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-slate-900">{value}</p>
    </div>
  );
}
