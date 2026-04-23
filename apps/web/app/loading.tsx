function SkeletonLine({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-slate-200/80 ${className}`} />;
}

export default function RootLoading() {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <SkeletonLine className="h-3 w-28" />
        <SkeletonLine className="h-8 w-72" />
        <SkeletonLine className="h-4 w-[32rem] max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-4">
            <SkeletonLine className="h-4 w-2/3" />
            <SkeletonLine className="mt-2 h-3 w-full" />
            <SkeletonLine className="mt-1.5 h-3 w-5/6" />
            <SkeletonLine className="mt-4 h-16 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
