export default function CreatorWalletLoading() {
  return (
    <section aria-label="Preparing payout wallet">
      <div className="mb-4">
        <div className="h-4 w-40 rounded-full bg-cyan-200/20 motion-safe:animate-pulse" />
        <div className="mt-3 h-7 w-28 rounded-full bg-white/10 motion-safe:animate-pulse" />
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 motion-safe:animate-pulse">
        <div className="h-6 w-44 rounded-full bg-white/10" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="h-20 rounded-xl bg-white/[0.04]" />
          <div className="h-20 rounded-xl bg-white/[0.04]" />
          <div className="h-20 rounded-xl bg-white/[0.04]" />
          <div className="h-20 rounded-xl bg-white/[0.04]" />
        </div>
      </div>
    </section>
  );
}
