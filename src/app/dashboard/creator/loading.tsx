function SkeletonCard({ className = "" }: { className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.04] p-5 motion-safe:animate-pulse ${className}`} />;
}

export default function CreatorDashboardLoading() {
  return (
    <section aria-label="Preparing Creator overview" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="min-w-0 space-y-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(380px,1fr)_minmax(420px,600px)] xl:items-end">
          <div>
            <div className="h-4 w-36 rounded-full bg-violet-300/20 motion-safe:animate-pulse" />
            <div className="mt-3 h-9 w-80 max-w-full rounded-full bg-white/10 motion-safe:animate-pulse" />
            <div className="mt-3 h-4 w-96 max-w-full rounded-full bg-white/10 motion-safe:animate-pulse" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <SkeletonCard className="h-[86px]" />
            <SkeletonCard className="h-[86px]" />
            <SkeletonCard className="h-[86px]" />
          </div>
        </div>
        <SkeletonCard className="h-[205px]" />
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <SkeletonCard className="h-[282px]" />
          <SkeletonCard className="h-[282px]" />
          <SkeletonCard className="h-[282px]" />
        </div>
        <SkeletonCard className="h-[210px]" />
      </div>
      <aside className="space-y-5 xl:sticky xl:top-4 xl:self-start">
        <SkeletonCard className="h-[255px]" />
        <SkeletonCard className="h-[300px]" />
        <SkeletonCard className="h-[170px]" />
      </aside>
    </section>
  );
}
