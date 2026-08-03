import { CCNLogo } from "@/components/ui/ccn-logo";

export default function CreateChallengeLoading() {
  return (
    <main className="min-h-screen bg-[#030a1f] text-white">
      <header className="border-b border-white/10 bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4 sm:px-8 lg:px-10">
          <div className="rounded-md">
            <CCNLogo size="md" priority />
          </div>
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200">
            Preparing draft...
          </span>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-10 sm:px-8 lg:grid-cols-[300px_1fr] lg:px-10">
        <aside className="h-fit rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">
            Create Challenge
          </p>
          <div className="mt-4 space-y-2">
            {["Challenge Details", "Prize & Winners", "Dates & Rules", "Funding", "Publish"].map((label, index) => (
              <div
                key={label}
                className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left ${
                  index === 0 ? "bg-white/10 text-white" : "text-slate-300"
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-xs font-bold">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-sm font-bold">{label}</span>
                  <span className="mt-1 block h-2 w-32 rounded-full bg-white/10" />
                </span>
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-slate-950/40">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-cyan-200">
                Brand flow
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                Challenge Details
              </h1>
            </div>
            <p className="text-xs font-bold text-slate-400">Draft ID: Preparing</p>
          </div>

          <div className="mt-6 rounded-md border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200">
            Status: Preparing draft...
          </div>

          <div className="mt-8 grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="h-20 rounded-md border border-white/10 bg-slate-950/55" />
              <div className="h-20 rounded-md border border-white/10 bg-slate-950/55" />
            </div>
            <div className="h-32 rounded-md border border-white/10 bg-slate-950/55" />
            <div className="h-44 rounded-md border border-dashed border-cyan-200/30 bg-slate-950/45" />
          </div>
        </section>
      </div>
    </main>
  );
}
