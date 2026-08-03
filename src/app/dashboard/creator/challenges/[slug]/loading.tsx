export default function CreatorChallengeDetailLoading() {
  return (
    <section aria-label="Preparing challenge detail" className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 motion-safe:animate-pulse">
        <div className="mb-6 aspect-[16/7] w-full rounded-xl bg-white/[0.04]" />
        <div className="h-4 w-32 rounded-full bg-cyan-200/20" />
        <div className="mt-3 h-9 w-96 max-w-full rounded-full bg-white/10" />
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="h-20 rounded-xl bg-white/[0.04]" />
          <div className="h-20 rounded-xl bg-white/[0.04]" />
          <div className="h-20 rounded-xl bg-white/[0.04]" />
        </div>
      </div>
      <aside className="space-y-6">
        <div className="h-36 rounded-2xl border border-white/10 bg-white/[0.04] motion-safe:animate-pulse" />
        <div className="h-44 rounded-2xl border border-white/10 bg-white/[0.04] motion-safe:animate-pulse" />
      </aside>
    </section>
  );
}
