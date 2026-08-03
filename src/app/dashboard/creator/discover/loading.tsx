function SkeletonCard() {
  return <div className="h-[285px] rounded-2xl border border-white/10 bg-white/[0.04] p-5 motion-safe:animate-pulse" />;
}

export default function CreatorDiscoverLoading() {
  return (
    <section aria-label="Preparing challenge discovery">
      <div className="mb-4">
        <div className="h-4 w-40 rounded-full bg-cyan-200/20 motion-safe:animate-pulse" />
        <div className="mt-3 h-7 w-56 rounded-full bg-white/10 motion-safe:animate-pulse" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </section>
  );
}
