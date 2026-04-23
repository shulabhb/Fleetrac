function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-slate-200/80 ${className}`} />;
}

export default function ControlsLoading() {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <Bar className="h-3 w-24" />
        <Bar className="h-8 w-72" />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <Bar className="h-8 w-full" />
      </div>
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <Bar key={i} className="h-10 w-full" />
        ))}
      </div>
    </section>
  );
}
