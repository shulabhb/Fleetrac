function S({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-slate-200/80 ${className}`} />;
}

export default function ActionDetailLoading() {
  return (
    <section className="space-y-5">
      <div className="flex min-h-8 items-center justify-between">
        <S className="h-4 w-36" />
        <S className="h-7 w-40" />
      </div>
      <div className="h-7 w-full rounded-md border border-slate-200 bg-white" />
      <div className="space-y-2">
        <S className="h-3 w-24" />
        <S className="h-8 w-2/3" />
      </div>
      <div className="min-h-[240px] rounded-lg border border-slate-200 bg-white p-5">
        <S className="h-5 w-72" />
        <S className="mt-3 h-28 w-full" />
        <S className="mt-3 h-16 w-full" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-5">
          <div className="h-56 rounded-lg border border-slate-200 bg-white" />
          <div className="h-56 rounded-lg border border-slate-200 bg-white" />
        </div>
        <div className="space-y-5">
          <div className="h-60 rounded-lg border border-slate-200 bg-white" />
          <div className="h-52 rounded-lg border border-slate-200 bg-white" />
        </div>
      </div>
    </section>
  );
}
