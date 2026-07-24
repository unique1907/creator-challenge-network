import Link from "next/link";
import { landingChallenges } from "@/features/landing/data/landing-page";
import { FeaturedChallengeCard } from "./featured-challenge-card";
import { LandingChallengeCard } from "./landing-challenge-card";
import { LandingIcon } from "./landing-icons";
import { LandingMetrics } from "./landing-metrics";
import { ProcessStrip } from "./process-strip";
import { TrustIndicators } from "./trust-indicators";

export function FinalLandingPage() {
  return (
    <main className="bg-slate-50">
      <section className="relative overflow-hidden bg-[#030a1f] pb-24 pt-14 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_30%,rgba(37,99,235,0.18),transparent_34%),radial-gradient(circle_at_72%_22%,rgba(147,51,234,0.2),transparent_30%)]" />
        <div className="absolute bottom-10 left-1/4 h-72 w-[680px] rotate-[-12deg] rounded-full border border-blue-500/25 opacity-70" />
        <div className="absolute bottom-16 left-1/3 h-44 w-[540px] rotate-[-10deg] rounded-full border border-blue-400/25 opacity-50" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <div className="pt-5 lg:pt-8">
            <h1 className="max-w-xl text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Funded creative
              <br />
              challenges.
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-violet-500 bg-clip-text text-transparent">
                Reviewed blind.
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-violet-500 bg-clip-text text-transparent">
                Paid in USDC.
              </span>
            </h1>
            <p className="mt-5 max-w-sm text-base leading-7 text-slate-200">
              Brands launch funded competitions.
              <br />
              Creators submit anonymously.
              <br />
              Winners receive programmable
              <br />
              USDC payouts on Arc.
            </p>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/create-challenge?new=1"
                className="inline-flex h-14 items-center justify-center gap-3 rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-7 text-sm font-bold text-white shadow-xl shadow-blue-950/30 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-200"
              >
                Launch a Challenge
                <LandingIcon name="arrow" className="h-5 w-5" />
              </Link>
              <Link
                href="/challenges"
                className="inline-flex h-14 items-center justify-center rounded-md border border-white/20 bg-white/5 px-7 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-200"
              >
                Explore Challenges
              </Link>
            </div>
            <TrustIndicators />
          </div>

          <div className="lg:pt-3">
            <FeaturedChallengeCard />
          </div>
        </div>
      </section>

      <LandingMetrics />
      <ProcessStrip />

      <section className="mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">
            Active Challenges
          </h2>
          <Link
            href="/create-challenge?new=1"
            className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 transition hover:text-violet-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            View all challenges
            <LandingIcon name="arrow" className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {landingChallenges.map((challenge) => (
            <LandingChallengeCard
              key={`${challenge.brand}-${challenge.title}`}
              challenge={challenge}
            />
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <Link
            href="/challenges"
            className="inline-flex h-12 min-w-80 items-center justify-center gap-3 rounded-md border border-violet-300 bg-white px-6 text-sm font-bold text-violet-700 shadow-sm transition hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            Explore All Challenges
            <LandingIcon name="arrow" className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12 sm:px-8 lg:px-10">
        <div className="relative grid gap-6 overflow-hidden rounded-xl bg-[#050b2a] p-8 text-white shadow-2xl shadow-slate-300/50 md:grid-cols-[1fr_auto_auto] md:items-center">
          <div className="absolute -right-24 bottom-2 h-44 w-[420px] rotate-[-12deg] rounded-full border border-blue-400/15 opacity-55" />
          <div className="absolute -right-10 bottom-8 h-28 w-[320px] rotate-[-10deg] rounded-full border border-violet-400/15 opacity-45" />
          <h2 className="relative z-10 text-3xl font-bold leading-tight">
            Launch the next creative challenge.
            <br />
            Or compete for{" "}
            <span className="text-violet-400">funded rewards.</span>
          </h2>
          <Link
            href="/challenges"
            className="relative z-10 inline-flex h-14 items-center justify-center rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-7 text-sm font-bold text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-200"
          >
            Launch a Challenge
          </Link>
          <Link
            href="/challenges"
            className="relative z-10 inline-flex h-14 items-center justify-center rounded-md border border-white/25 bg-white/5 px-7 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-200"
          >
            Explore Challenges
          </Link>
        </div>
      </section>
    </main>
  );
}
