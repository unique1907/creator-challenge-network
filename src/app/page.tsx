import { SectionHeader } from "@/components/ui/section-header";
import {
  challengeTracks,
  MetricCard,
  NetworkPanel,
  platformStats,
  workflowSteps,
} from "@/features/landing";

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-950">
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto grid min-h-[92vh] max-w-7xl content-center gap-12 px-6 py-10 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-10">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Creator Challenge Network
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight text-stone-950 sm:text-6xl lg:text-7xl">
              Challenge rewards for creators, settled with wallet-native USDC.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-650">
              CCN is a hackathon-grade platform for launching creator
              challenges, validating submissions, and preparing programmable
              payouts on Arc through Circle Wallets.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#challenge-flow"
                className="inline-flex h-12 items-center justify-center rounded-md bg-stone-950 px-5 text-sm font-semibold text-white transition hover:bg-stone-800"
              >
                View challenge flow
              </a>
              <a
                href="https://github.com/unique1907/creator-challenge-network"
                className="inline-flex h-12 items-center justify-center rounded-md border border-stone-300 bg-white px-5 text-sm font-semibold text-stone-950 transition hover:bg-stone-100"
              >
                GitHub repository
              </a>
            </div>
          </div>
          <div className="flex items-center">
            <NetworkPanel />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
        <div className="grid gap-4 md:grid-cols-3">
          {platformStats.map((stat) => (
            <MetricCard key={stat.label} stat={stat} />
          ))}
        </div>
      </section>

      <section id="challenge-flow" className="bg-white py-18">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
          <SectionHeader
            eyebrow="Platform thesis"
            title="A practical network for proof-based creator work"
            description="CCN focuses on the core hackathon loop: publish a challenge, collect creator proof, review outcomes, and prepare a settlement roster that can move toward real wallet rails."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {challengeTracks.map((track) => (
              <article
                key={track.title}
                className="rounded-lg border border-stone-200 bg-stone-50 p-6"
              >
                <p className="text-sm font-semibold text-emerald-700">
                  {track.reward}
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-stone-950">
                  {track.title}
                </h3>
                <p className="mt-4 text-sm leading-6 text-stone-650">
                  {track.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
        <SectionHeader
          eyebrow="Sprint zero"
          title="The first build target is deliberately narrow"
          description="The repository starts with a production Next.js foundation and a validated Circle Wallets path, then grows toward creator submissions, review operations, and payout orchestration."
        />

        <div className="mt-10 grid gap-4">
          {workflowSteps.map((step, index) => (
            <article
              key={step.title}
              className="grid gap-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm md:grid-cols-[80px_1fr]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-emerald-700 text-sm font-semibold text-white">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-stone-950">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-650">
                  {step.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
