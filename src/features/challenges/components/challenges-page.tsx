import { ChallengeGrid } from "@/features/challenges/components/challenge-grid";
import type { Challenge } from "@/types/ccn";

type ChallengesPageProps = {
  challenges: Challenge[];
};

export function ChallengesPage({ challenges }: ChallengesPageProps) {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-7xl px-6 py-14 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
            Funded brand challenges
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
            Creative competitions with USDC rewards secured on Arc.
          </h1>
          <p className="mt-5 text-base leading-8 text-slate-300">
            Browse live mock challenges where brands fund one winning creative
            outcome, review submissions blindly, and receive predefined usage
            rights from the selected creator.
          </p>
        </div>

        <div className="mt-10">
          <ChallengeGrid challenges={challenges} />
        </div>
      </section>
    </main>
  );
}
