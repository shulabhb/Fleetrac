export default function ControlDetailLoading() {
  return (
    <section className="space-y-4 animate-pulse">
      <div className="h-4 w-48 rounded bg-slate-100" />
      <div className="h-36 rounded-lg border border-slate-100 bg-slate-50" />
      <div className="h-24 rounded-lg border border-slate-100 bg-slate-50" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="h-40 rounded-lg border border-slate-100 bg-slate-50" />
        <div className="h-40 rounded-lg border border-slate-100 bg-slate-50" />
      </div>
    </section>
  );
}
