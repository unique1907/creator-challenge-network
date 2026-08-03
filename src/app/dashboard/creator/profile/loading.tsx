export default function CreatorProfileLoading() {
  return (
    <section aria-label="Preparing Creator profile">
      <div className="mb-4">
        <div className="h-4 w-40 rounded-full bg-cyan-200/20 motion-safe:animate-pulse" />
        <div className="mt-3 h-7 w-32 rounded-full bg-white/10 motion-safe:animate-pulse" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 motion-safe:animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/10" />
            <div className="space-y-3">
              <div className="h-6 w-44 rounded-full bg-white/10" />
              <div className="h-4 w-32 rounded-full bg-white/10" />
            </div>
          </div>
          <div className="mt-6 grid gap-4">
            <div className="h-24 rounded-xl bg-white/[0.04]" />
            <div className="h-14 rounded-xl bg-white/[0.04]" />
            <div className="h-14 rounded-xl bg-white/[0.04]" />
            <div className="h-14 rounded-xl bg-white/[0.04]" />
          </div>
        </div>
        <div className="h-[255px] rounded-2xl border border-white/10 bg-white/[0.04] motion-safe:animate-pulse" />
      </div>
    </section>
  );
}
