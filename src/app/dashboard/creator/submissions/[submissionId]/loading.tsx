export default function CreatorSubmissionDetailLoading() {
  return (
    <section aria-label="Preparing submission detail" className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 motion-safe:animate-pulse">
      <div className="h-4 w-44 rounded-full bg-cyan-200/20" />
      <div className="mt-3 h-9 w-80 max-w-full rounded-full bg-white/10" />
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="h-20 rounded-xl bg-white/[0.04]" />
        <div className="h-20 rounded-xl bg-white/[0.04]" />
        <div className="h-20 rounded-xl bg-white/[0.04]" />
      </div>
      <div className="mt-6 space-y-4">
        <div className="h-20 rounded-xl bg-white/[0.04]" />
        <div className="h-20 rounded-xl bg-white/[0.04]" />
      </div>
    </section>
  );
}
