function SkeletonRow() {
  return <div className="h-[74px] border-b border-white/10 bg-white/[0.03] motion-safe:animate-pulse last:border-b-0" />;
}

export default function CreatorSubmissionsLoading() {
  return (
    <section aria-label="Preparing Creator submissions">
      <div className="mb-4">
        <div className="h-4 w-40 rounded-full bg-cyan-200/20 motion-safe:animate-pulse" />
        <div className="mt-3 h-7 w-48 rounded-full bg-white/10 motion-safe:animate-pulse" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </section>
  );
}
