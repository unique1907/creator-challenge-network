import Link from "next/link";
import { landingChallenges } from "@/features/landing/data/landing-page";
import type { Challenge } from "@/types/ccn";
import type { PublicAuthState } from "@/types/public-auth";
import { FeaturedChallengeCard } from "./featured-challenge-card";
import { LandingChallengeCard } from "./landing-challenge-card";
import { LandingIcon } from "./landing-icons";
import { LandingMetrics } from "./landing-metrics";
import { ProcessStrip } from "./process-strip";
import { TrustIndicators } from "./trust-indicators";

type LandingAction = {
  href: string;
  label: string;
  variant: "primary" | "secondary" | "text";
};

function landingActions(authState: PublicAuthState): LandingAction[] {
  if (authState.kind === "brand") {
    if (!authState.onboardingComplete) {
      return [{ href: "/auth/onboarding/brand", label: "Continue Brand Setup", variant: "primary" }];
    }
    return [
      { href: "/create-challenge?new=1", label: "Launch a Challenge", variant: "primary" },
      { href: "/dashboard", label: "Go to Brand Workspace", variant: "secondary" },
      { href: "/challenges", label: "Explore Challenges", variant: "text" },
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
      { href: "/challenges", label: "Explore Challenges", variant: "primary" },
      { href: "/dashboard/creator", label: "Go to Creator Workspace", variant: "secondary" },
    ];
  }

  return [
    { href: "/challenges", label: "Explore Challenges", variant: "primary" },
    { href: "/auth/sign-up?role=brand", label: "Start a Challenge", variant: "secondary" },
    { href: "/auth/sign-up?role=creator", label: "Join as a Creator", variant: "text" },
  ];
}

function actionClassName(variant: LandingAction["variant"]) {
  if (variant === "primary") {
    return "inline-flex h-14 items-center justify-center gap-3 rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-7 text-sm font-bold text-white shadow-xl shadow-blue-950/30 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-200";
  }
  if (variant === "secondary") {
    return "inline-flex h-14 items-center justify-center rounded-md border border-white/20 bg-white/5 px-7 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-200";
  }
  return "mt-4 inline-flex rounded-md text-sm font-bold text-cyan-200 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200";
}

function finalCtaPanels(authState: PublicAuthState) {
  const brandPanel = {
    id: "brand",
    eyebrow: "For brands",
    title: "Launch a funded challenge and review the strongest ideas blindly.",
    body: "Define the brief, lock the prize pool, publish the challenge, score anonymous entries, and settle the winner through the verified workflow.",
    href: authState.kind === "brand" && !authState.onboardingComplete ? "/auth/onboarding/brand" : "/create-challenge?new=1",
    label: authState.kind === "brand" && !authState.onboardingComplete ? "Continue Brand Setup" : "Start a Challenge",
    className: "border-b border-white/10 p-8 lg:border-b-0 lg:border-r lg:p-10",
    linkClassName: "mt-6 inline-flex h-12 items-center justify-center gap-3 rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-6 text-sm font-bold text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-200",
  };
  const creatorPanel = {
    id: "creator",
    eyebrow: "For creators",
    title: "Discover open briefs, submit original work, and track rewards.",
    body: "Enter through Creator Workspace, set up payout readiness, submit before deadline, and follow the outcome from review to reward status.",
    href: authState.kind === "creator" && !authState.onboardingComplete ? "/auth/onboarding/creator?next=%2Fdashboard%2Fcreator" : "/dashboard/creator",
    label: authState.kind === "creator" && !authState.onboardingComplete ? "Continue Creator Setup" : "Go to Creator Workspace",
    className: "p-8 lg:p-10",
    linkClassName: "mt-6 inline-flex h-12 items-center justify-center gap-3 rounded-md border border-white/20 bg-white/5 px-6 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-200",
  };

  if (authState.kind === "brand") return [brandPanel];
  if (authState.kind === "creator") return [creatorPanel];
  return [
    { ...brandPanel, href: "/auth/sign-up?role=brand" },
    { ...creatorPanel, href: "/auth/sign-up?role=creator", label: "Join as a Creator" },
  ];
}

export function FinalLandingPage({
  authState = { kind: "anonymous" },
  featuredChallenge,
}: {
  authState?: PublicAuthState;
  featuredChallenge?: Challenge | null;
}) {
  const actions = landingActions(authState);
  const buttonActions = actions.filter((action) => action.variant !== "text");
  const textActions = actions.filter((action) => action.variant === "text");
  const panels = finalCtaPanels(authState);

  return (
    <main className="bg-slate-50">
      <section className="bg-[#030a1f] pb-24 pt-14 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
          <div className="pt-4 lg:pt-7">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Creator Challenge Network</p>
            <h1 className="mt-5 max-w-2xl text-5xl font-black leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Discover the
              <br />
              World&apos;s Best
              <br />
              Ideas.
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-violet-500 bg-clip-text text-transparent">
                Funded fairly.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-200 sm:text-lg">
              Brands fund creative challenges before publish. Creators submit original work. Winners are selected through blind review and paid through verified USDC settlement.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {buttonActions.map((action) => (
                <Link key={action.href} href={action.href} className={actionClassName(action.variant)}>
                  {action.label}
                  {action.variant === "primary" ? <LandingIcon name="arrow" className="h-5 w-5" /> : null}
                </Link>
              ))}
            </div>
            {textActions.map((action) => (
              <Link key={action.href} href={action.href} className={actionClassName(action.variant)}>
                {action.label}
              </Link>
            ))}
            <TrustIndicators />
          </div>

          <div className="lg:pt-3">
            <FeaturedChallengeCard challenge={featuredChallenge} />
          </div>
        </div>
      </section>

      <LandingMetrics />
      <ProcessStrip />

      <section id="for-brands" className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Active challenges</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Funded briefs ready for original creative work.
            </h2>
          </div>
          <Link
            href="/challenges"
            className="inline-flex items-center gap-2 text-sm font-bold text-violet-700 transition hover:text-violet-900 focus:outline-none focus:ring-2 focus:ring-violet-400"
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
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-14 sm:px-8 lg:px-10">
        <div className={`grid overflow-hidden rounded-2xl border border-white/10 bg-[#050b2a] text-white shadow-2xl shadow-slate-300/50 ${panels.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {panels.map((panel) => (
            <div key={panel.id} className={panels.length > 1 ? panel.className : "p-8 lg:p-10"}>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">{panel.eyebrow}</p>
              <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight">
                {panel.title}
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                {panel.body}
              </p>
              <Link href={panel.href} className={panel.linkClassName}>
                {panel.label}
                <LandingIcon name="arrow" className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
