import Link from "next/link";
import type { CreateChallengeDraftSummary } from "@/services/create-challenge/create-challenge-store.server";

function formatEdited(value: string) {
  if (!value) return "Not saved yet";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function BrandDashboard({ drafts }: { drafts: CreateChallengeDraftSummary[] }) {
  const draftChallenges = drafts.filter((draft) => draft.publicationStatus !== "live");
  const liveChallenges = drafts.filter((draft) => draft.publicationStatus === "live");

  return (
    <main className="min-h-screen bg-[#030a1f] text-white">
      <section className="mx-auto max-w-6xl px-6 py-12 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-cyan-200">
              Brand workspace
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">Welcome</h1>
          </div>
          <Link
            href="/create-challenge?new=1"
            className="rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-5 py-3 text-sm font-bold"
          >
            Create New Challenge
          </Link>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-bold">Draft Challenges</h2>
            {draftChallenges.length ? (
              <div className="mt-4 space-y-3">
                {draftChallenges.map((draft) => (
                  <div key={draft.draftId} className="rounded-md border border-white/10 bg-slate-950/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-white">{draft.title}</p>
                        <p className="mt-1 text-sm text-slate-300">
                          {draft.brandName} - Last edited {formatEdited(draft.updatedAt)}
                        </p>
                      </div>
                      <Link
                        href={`/create-challenge?draftId=${encodeURIComponent(draft.draftId)}`}
                        className="rounded-md border border-cyan-200/40 px-4 py-2 text-sm font-bold text-cyan-100"
                      >
                        Continue Draft
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-300">
                No active draft needs attention.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-bold">New Challenge</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Start with clean details, clean dates, and a new prize pool.
            </p>
            <Link
              href="/create-challenge?new=1"
              className="mt-5 inline-flex rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-5 py-3 text-sm font-bold"
            >
              Create New Challenge
            </Link>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-5 lg:col-span-2">
            <h2 className="text-lg font-bold">Live Challenges</h2>
            {liveChallenges.length ? (
              <div className="mt-4 space-y-3">
                {liveChallenges.map((draft) => (
                  <p key={draft.draftId} className="text-sm leading-6 text-slate-300">
                    {draft.title}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-300">
                No live Brand-created challenge yet.
              </p>
            )}
            <p className="mt-4 text-xs text-slate-400">
              Payment status is shown inside each draft.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
