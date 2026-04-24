function S({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-slate-200/80 ${className}`} />;
}

export default function BobDetailLoading() {
  return (
    <section className="space-y-5">
      <div className="flex min-h-8 items-center justify-between">
        <S className="h-4 w-32" />
        <S className="h-7 w-52" />
      </div>
      <div className="h-7 w-full rounded-md border border-slate-200 bg-white" />
      <div className="relative min-h-[220px] rounded-lg border border-slate-200 bg-white p-5">
        <S className="h-3 w-28" />
        <S className="mt-2 h-8 w-2/3" />
        <S className="mt-2 h-4 w-11/12" />
        <S className="mt-4 h-16 w-full" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-5">
          <div className="h-56 rounded-lg border border-slate-200 bg-white" />
          <div className="h-64 rounded-lg border border-slate-200 bg-white" />
        </div>
        <div className="space-y-5">
          <div className="h-52 rounded-lg border border-slate-200 bg-white" />
          <div className="h-56 rounded-lg border border-slate-200 bg-white" />
        </div>
      </div>
    </section>
  );
}
