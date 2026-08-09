import Link from "next/link";
import type { Challenge } from "@/types/ccn";
import type { PublicAuthState } from "@/types/public-auth";
import { FeaturedChallengeCard } from "./featured-challenge-card";
import { LandingAudienceSection } from "./landing-audience-section";
import { LandingChallengeCard } from "./landing-challenge-card";
import { LandingIcon } from "./landing-icons";
import { LandingMetrics } from "./landing-metrics";
import { ProcessStrip } from "./process-strip";

type LandingAction = {
  href: string;
  label: string;
  variant: "primary" | "secondary" | "text";
};

function landingActions(authState: PublicAuthState): LandingAction[] {
  if (authState.kind === "brand") {
    if (!authState.onboardingComplete) {
      return [
        { href: "/challenges", label: "Explore Live Challenges", variant: "primary" },
        { href: "/auth/onboarding/brand", label: "Start a Business Challenge", variant: "secondary" },
      ];
    }
    return [
      { href: "/challenges", label: "Explore Live Challenges", variant: "primary" },
      { href: "/create-challenge?new=1", label: "Start a Business Challenge", variant: "secondary" },
      { href: "/auth/sign-up?role=creator", label: "Join as a Creator", variant: "text" },
    ];
  }

  if (authState.kind === "creator") {
    if (!authState.onboardingComplete) {
      return [
        {
          href: "/auth/onboarding/creator?next=%2Fdashboard%2Fcreator",
          label: "Continue Creator Setup",
          variant: "primary",
        },
      ];
    }
    return [
      { href: "/challenges", label: "Explore Live Challenges", variant: "primary" },
      { href: "/auth/sign-up?role=brand", label: "Start a Business Challenge", variant: "secondary" },
      { href: "/dashboard/creator", label: "Join as a Creator", variant: "text" },
    ];
  }

  return [
    { href: "/challenges", label: "Explore Live Challenges", variant: "primary" },
    { href: "/auth/sign-up?role=brand", label: "Start a Business Challenge", variant: "secondary" },
    { href: "/auth/sign-up?role=creator", label: "Join as a Creator", variant: "text" },
  ];
}

function actionClassName(variant: LandingAction["variant"]) {
  if (variant === "primary") {
    return "inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-5 text-[13px] font-bold text-white shadow-lg shadow-blue-950/25 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-200";
  }
  if (variant === "secondary") {
    return "inline-flex h-11 items-center justify-center rounded-md border border-white/20 bg-white/5 px-5 text-[13px] font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-200";
  }
  return "mt-4 inline-flex rounded-md text-[13px] font-bold text-cyan-200 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200";
}

export function FinalLandingPage({
  authState = { kind: "anonymous" },
  featuredChallenges,
  liveHomepageChallenges,
  liveHomepageStatus = "ready",
  currentTimeIso,
}: {
  authState?: PublicAuthState;
  featuredChallenges?: Challenge[];
  liveHomepageChallenges?: Challenge[];
  liveHomepageStatus?: "ready" | "error";
  currentTimeIso: string;
}) {
  const actions = landingActions(authState);
  const buttonActions = actions.filter((action) => action.variant !== "text");
  const featuredList = featuredChallenges ?? [];
  const liveChallenges = liveHomepageChallenges ?? [];
  const heroChallenge = featuredList[0] ?? null;

  return (
    <main className="bg-slate-50">
      <section className="bg-[#030a1f] pb-16 pt-12 text-white">
        <div className="mx-auto grid max-w-7xl items-start gap-12 px-6 sm:px-8 lg:grid-cols-[1fr_1fr] lg:gap-14 lg:px-10">
          <div>
            <p className="inline-flex rounded-md border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 font-mono text-[11px] font-medium text-cyan-100">
              Funded. Fair. On-chain.
            </p>
            <h1 className="mt-4 max-w-[620px] text-5xl font-bold leading-[1.06] tracking-[-0.015em] text-white sm:text-[52px] lg:text-[56px]" style={{ fontFamily: "\"Space Grotesk\", Arial, Helvetica, sans-serif" }}>
              Discover the World&apos;s Best Ideas.
            </h1>
            <div className="relative mt-5 inline-block max-w-xl pb-3">
              <p className="text-2xl font-bold leading-tight text-cyan-200 sm:text-[28px]" style={{ fontFamily: "\"Space Grotesk\", Arial, Helvetica, sans-serif" }}>
                Turn business problems into winning solutions.
              </p>
              <svg className="pointer-events-none absolute -bottom-1 left-0 h-3 w-full text-violet-400" viewBox="0 0 420 18" fill="none" aria-hidden="true" preserveAspectRatio="none">
                <path d="M4 12C78 4 150 7 214 10.5C284 14.5 350 13 416 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <p className="mt-5 max-w-[540px] text-[15.5px] leading-[1.55] text-slate-300">
              Launch a business challenge, receive solutions from a global network of AI-augmented creators, and reward the best outcome.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:gap-3.5">
              {buttonActions.map((action) => (
                <Link key={action.href} href={action.href} className={actionClassName(action.variant)}>
                  {action.label}
                  {action.variant === "primary" ? <LandingIcon name="arrow" className="h-4 w-4" /> : null}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <FeaturedChallengeCard challenge={heroChallenge} />
          </div>
        </div>
      </section>

      <LandingMetrics />
      <ProcessStrip />

      <section id="live-business-challenges" className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Live Business Challenges</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Funded business challenges open for solution proposals and verified outcomes.
            </h2>
          </div>
          <Link
            href="/challenges"
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[11px] border border-violet-400/45 bg-violet-50/70 px-4 text-[13px] font-semibold text-violet-800 transition-colors hover:border-violet-500/70 hover:bg-violet-100/80 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-slate-50"
          >
            View all challenges
            <LandingIcon name="arrow" className="h-4 w-4 text-violet-700" />
          </Link>
        </div>

        {liveHomepageStatus === "error" ? (
          <div className="rounded-2xl border border-amber-200 bg-white p-8 shadow-lg shadow-slate-200/70">
            <h3 className="text-2xl font-black text-slate-950">Live challenges are temporarily unavailable</h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              We could not load verified public challenge data. Please refresh shortly.
            </p>
          </div>
        ) : liveChallenges.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {liveChallenges.map((challenge) => (
              <LandingChallengeCard
                key={challenge.slug}
                challenge={challenge}
                currentTimeIso={currentTimeIso}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/70">
            <h3 className="text-2xl font-black text-slate-950">No live Business Challenges yet</h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Funded challenges will appear here after the Brand locks the reward and publishes the challenge.
            </p>
            <Link href={authState.kind === "brand" && authState.onboardingComplete ? "/create-challenge?new=1" : "/auth/sign-up?role=brand"} className="mt-5 inline-flex h-11 items-center rounded-md bg-violet-700 px-5 text-sm font-bold text-white transition hover:bg-violet-800">
              Start a Business Challenge
            </Link>
          </div>
        )}
      </section>

      <LandingAudienceSection authState={authState} />
    </main>
  );
}
