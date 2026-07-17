import Link from "next/link";
import { SectionHeader } from "@/components/ui/section-header";
import { ChallengeGrid, challenges } from "@/features/challenges";
import {
  challengeTracks,
  MetricCard,
  NetworkPanel,
  platformStats,
  workflowSteps,
} from "@/features/landing";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="border-b border-white/10 bg-slate-950">
        <div className="mx-auto grid min-h-[92vh] max-w-7xl content-center gap-12 px-6 py-10 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-10">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
              DeFi / Programmable Money
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Funded creative challenges with one winner and Arc-secured USDC.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              CCN lets brands publish funded creative competitions, review
              completed submissions blindly, and award the escrowed USDC reward
              to the single winning creator who transfers predefined usage
              rights.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/challenges"
                className="inline-flex h-12 items-center justify-center rounded-md bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Browse challenges
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex h-12 items-center justify-center rounded-md border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                How it works
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

      <section className="bg-slate-900 py-18">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
          <SectionHeader
            eyebrow="Live mock challenges"
            title="Three funded competition formats for Checkpoint 2"
            description="Each challenge has a brand sponsor, defined usage rights, blind review, and a USDC reward model secured on Arc for one selected winning submission."
          />
          <div className="mt-10">
            <ChallengeGrid challenges={challenges} />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-slate-950 py-18">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
          <SectionHeader
            eyebrow="Platform thesis"
            title="A focused competition flow for brand-funded creative work"
            description="Brands define the brief and lock the reward, creators submit finished work, the brand reviews without creator identity bias, and only the winning submission receives the reward and transfers the agreed usage rights."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {challengeTracks.map((track) => (
              <article
                key={track.title}
                className="rounded-lg border border-white/10 bg-white/[0.045] p-6"
              >
                <p className="text-sm font-semibold text-cyan-200">
                  {track.reward}
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-white">
                  {track.title}
                </h3>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  {track.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
        <SectionHeader
          eyebrow="Public experience"
          title="Built for premium brand-funded creative competitions"
          description="Sprint 2 turns the foundation into a working public challenge experience with realistic mock data and reusable components ready for future submission and review flows."
        />

        <div className="mt-10 grid gap-4">
          {workflowSteps.map((step, index) => (
            <article
              key={step.title}
              className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-sm md:grid-cols-[80px_1fr]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-teal-300 text-sm font-semibold text-slate-950">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
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
