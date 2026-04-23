function S({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-slate-200/80 ${className}`} />;
}

export default function SettingsLoading() {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <S className="h-3 w-24" />
        <S className="h-8 w-56" />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <div className="flex gap-2">
          <S className="h-8 w-28" />
          <S className="h-8 w-32" />
          <S className="h-8 w-28" />
          <S className="h-8 w-32" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-3">
            <S className="h-4 w-40" />
            <S className="mt-2 h-3 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
