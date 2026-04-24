function S({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-slate-200/80 ${className}`} />;
}

export default function SystemDetailLoading() {
  return (
    <section className="space-y-5">
      <div className="flex min-h-8 items-center">
        <S className="h-4 w-28" />
      </div>
      <div className="min-h-[240px] rounded-lg border border-slate-200 bg-white p-5">
        <S className="h-3 w-20" />
        <S className="mt-2 h-8 w-2/3" />
        <S className="mt-4 h-16 w-full" />
        <S className="mt-4 h-24 w-full" />
      </div>
      <div className="h-40 rounded-lg border border-slate-200 bg-white" />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <div className="h-56 rounded-lg border border-slate-200 bg-white" />
          <div className="h-56 rounded-lg border border-slate-200 bg-white" />
          <div className="h-48 rounded-lg border border-slate-200 bg-white" />
        </div>
        <div className="space-y-5">
          <div className="h-52 rounded-lg border border-slate-200 bg-white" />
          <div className="h-56 rounded-lg border border-slate-200 bg-white" />
        </div>
      </div>
    </section>
  );
}
