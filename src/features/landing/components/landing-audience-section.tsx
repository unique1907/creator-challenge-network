import Link from "next/link";
import type { PublicAuthState } from "@/types/public-auth";
import { LandingIcon } from "./landing-icons";

type Props = {
  authState: PublicAuthState;
};

const brandBenefits = [
  "Access a global network of AI-augmented creators",
  "Receive targeted solutions to real business problems",
  "Blind review ensures ideas win, not identities",
  "Secure rewards with USDC on Arc",
];

const creatorBenefits = [
  "Discover challenges that match your skills and interests",
  "Submit Solution Proposals anonymously",
  "Compete through ideas, not identity",
  "Receive rewards in test USDC through Circle Wallets",
];

function brandHref(authState: PublicAuthState) {
  if (authState.kind === "brand") {
    return authState.onboardingComplete ? "/create-challenge?new=1" : "/auth/onboarding/brand";
  }
  return "/auth/sign-up?role=brand";
}

function creatorHref(authState: PublicAuthState) {
  if (authState.kind === "creator") {
    return authState.onboardingComplete ? "/dashboard/creator" : "/auth/onboarding/creator?next=%2Fdashboard%2Fcreator";
  }
  return "/auth/sign-up?role=creator";
}

function CheckIcon() {
  return (
    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-950/35">
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m5 12 4 4L19 6" />
      </svg>
    </span>
  );
}

function AudienceHeader({ kind }: { kind: "brand" | "creator" }) {
  const isBrand = kind === "brand";
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-800 text-white shadow-xl shadow-violet-950/35">
        <LandingIcon name={isBrand ? "brand" : "creators"} className="h-5 w-5" />
      </span>
      <h2 className="text-[22px] font-black leading-none tracking-tight text-white" style={{ fontFamily: "\"Space Grotesk\", Arial, Helvetica, sans-serif" }}>
        For <span className="text-violet-500">{isBrand ? "Brands" : "Creators"}</span>
      </h2>
    </div>
  );
}

function AudienceBenefits({ benefits }: { benefits: string[] }) {
  return (
    <ul className="mt-3.5 space-y-2 text-[13px] leading-[1.35] text-white/90">
      {benefits.map((benefit) => (
        <li key={benefit} className="flex gap-3">
          <CheckIcon />
          <span>{benefit}</span>
        </li>
      ))}
    </ul>
  );
}

function LaptopVisual() {
  return (
    <div className="pointer-events-none relative hidden min-h-[165px] flex-1 items-end justify-end md:flex" data-device-visual="brand-laptop" aria-label="Illustrative CCN Brand dashboard laptop visual">
      <div className="absolute right-2 top-6 h-32 w-40 rounded-full bg-violet-600/25 blur-3xl" />
      <div className="relative w-[min(100%,195px)] rotate-[-1.5deg]">
        <div className="rounded-t-[11px] border border-white/25 bg-[#171b27] p-1 shadow-2xl shadow-black/70">
          <div className="rounded-[8px] border border-white/10 bg-[#040816] p-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <div className="flex items-center gap-1.5 text-[8px] font-bold text-white">
                <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
                CCN
              </div>
              <div className="h-3 w-11 rounded-full bg-white/10" />
            </div>
            <div className="mt-2 grid grid-cols-[0.36fr_1fr] gap-1.5">
              <div className="space-y-1">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className={`h-3 rounded-sm ${index === 0 ? "bg-violet-600/60" : "bg-white/10"}`} />
                ))}
              </div>
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded-md border border-white/10 bg-white/6 p-1.5">
                    <div className="h-1.5 w-10 rounded bg-cyan-300/45" />
                    <div className="mt-1.5 h-2 w-12 rounded bg-white/70" />
                    <div className="mt-1 h-1.5 w-9 rounded bg-violet-400/70" />
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/6 p-1.5">
                    <div className="h-1.5 w-9 rounded bg-cyan-300/45" />
                    <div className="mt-1.5 h-1.5 rounded bg-white/25" />
                    <div className="mt-1 h-1.5 w-4/5 rounded bg-white/20" />
                  </div>
                </div>
                <div className="rounded-md border border-white/10 bg-white/6 p-1.5">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-1.5 border-b border-white/10 py-1 last:border-0">
                      <span className="h-4 w-4 rounded-sm bg-gradient-to-br from-cyan-300/70 to-violet-600/70" />
                      <span className="h-1.5 flex-1 rounded bg-white/30" />
                      <span className="h-2.5 w-5 rounded bg-emerald-400/35" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto h-2 w-[92%] rounded-b-[14px] border border-white/15 bg-gradient-to-b from-slate-500 to-slate-800 shadow-2xl shadow-black/70" />
        <div className="mx-auto h-1 w-[46%] rounded-b-full bg-slate-400/60" />
      </div>
    </div>
  );
}

function PhoneVisual() {
  return (
    <div className="pointer-events-none relative hidden min-h-[160px] flex-1 items-end justify-center md:flex" data-device-visual="creator-phones" aria-label="Illustrative CCN Creator discovery and wallet phone visuals">
      <div className="absolute right-6 top-6 h-32 w-28 rounded-full bg-violet-600/25 blur-3xl" />
      <PhoneMockup className="absolute right-10 top-4 rotate-[3deg]" variant="wallet" />
      <PhoneMockup className="absolute left-12 top-9 rotate-[-4deg]" variant="discover" />
    </div>
  );
}

function PhoneMockup({ className, variant }: { className: string; variant: "discover" | "wallet" }) {
  const isWallet = variant === "wallet";
  return (
    <div className={`${className} h-[132px] w-[68px] rounded-[14px] border border-white/35 bg-[#111827] p-1 shadow-2xl shadow-black/75`}>
      <div className="h-full rounded-[11px] border border-white/10 bg-[#060a18] px-1.5 py-2">
        <div className="mx-auto mb-1.5 h-1 w-6 rounded-full bg-black/60" />
        <div className="flex items-center justify-between text-[6px] font-bold text-white/75">
          <span>{isWallet ? "Wallet" : "Challenges"}</span>
          <span className="h-2 w-2 rounded-full border border-white/35" />
        </div>
        {isWallet ? <WalletScreen /> : <DiscoveryScreen />}
      </div>
    </div>
  );
}

function WalletScreen() {
  return (
    <div className="mt-2 space-y-1.5">
      <div className="rounded-md border border-white/10 bg-white/6 p-1.5">
        <div className="h-1 w-7 rounded bg-cyan-300/45" />
        <div className="mt-1 h-2 w-10 rounded bg-white/70" />
        <div className="mt-1 h-1 w-8 rounded bg-violet-400/60" />
      </div>
      <div className="rounded-md border border-white/10 bg-white/6 p-1.5">
        <div className="h-1 w-7 rounded bg-white/30" />
        <div className="mt-1 grid grid-cols-2 gap-1">
          <div className="h-4 rounded-sm bg-white/8" />
          <div className="h-4 rounded-sm bg-white/8" />
        </div>
      </div>
      <div className="space-y-1">
        <div className="h-4 rounded-md bg-emerald-400/15" />
        <div className="h-4 rounded-md bg-emerald-400/10" />
      </div>
    </div>
  );
}

function DiscoveryScreen() {
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        <span className="h-3.5 w-5 rounded-sm bg-violet-600" />
        <span className="h-3.5 w-6 rounded-sm bg-white/8" />
        <span className="h-3.5 w-6 rounded-sm bg-white/8" />
      </div>
      <div className="h-3.5 rounded-sm bg-white/10" />
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-1 rounded-md border border-white/10 bg-white/6 p-1">
          <span className="h-3.5 w-3.5 rounded-sm bg-gradient-to-br from-violet-500 to-cyan-400" />
          <span className="space-y-0.5">
            <span className="block h-1 w-8 rounded bg-white/45" />
            <span className="block h-1 w-6 rounded bg-cyan-300/35" />
          </span>
        </div>
      ))}
    </div>
  );
}

function LandingBrandAudienceCard({ href }: { href: string }) {
  return (
    <article className="relative flex h-full min-h-[240px] overflow-hidden rounded-[22px] border border-white/15 bg-[#070c1c] p-4 text-white shadow-2xl shadow-black/30 sm:p-5 lg:px-5 lg:py-5" data-audience-card="For Brands">
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-violet-700/30 to-transparent" />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col md:max-w-[47%]">
        <AudienceHeader kind="brand" />
        <AudienceBenefits benefits={brandBenefits} />
        <Link href={href} className="mt-auto inline-flex h-[38px] w-fit items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-violet-700 px-4 text-[13px] font-bold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-200">
          Start a Challenge
          <LandingIcon name="arrow" className="h-3.5 w-3.5" />
        </Link>
      </div>
      <LaptopVisual />
    </article>
  );
}

function LandingCreatorAudienceCard({ href }: { href: string }) {
  return (
    <article className="relative flex h-full min-h-[240px] overflow-hidden rounded-[22px] border border-white/15 bg-[#070c1c] p-4 text-white shadow-2xl shadow-black/30 sm:p-5 lg:px-5 lg:py-5" data-audience-card="For Creators">
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-violet-700/30 to-transparent" />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col md:max-w-[50%]">
        <AudienceHeader kind="creator" />
        <AudienceBenefits benefits={creatorBenefits} />
        <Link href={href} className="mt-auto inline-flex h-[38px] w-fit items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-violet-700 px-4 text-[13px] font-bold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-200">
          Join as a Creator
          <LandingIcon name="arrow" className="h-3.5 w-3.5" />
        </Link>
      </div>
      <PhoneVisual />
    </article>
  );
}

function LandingOutcomeCtaBanner() {
  return (
    <section className="relative mt-4 flex min-h-[88px] overflow-hidden rounded-[22px] border border-violet-300/20 bg-gradient-to-r from-violet-800 via-violet-900 to-[#22135d] p-4 text-white shadow-2xl shadow-violet-950/25 lg:items-center lg:justify-between lg:gap-5" data-outcome-cta-banner>
      <div className="absolute right-0 top-0 h-full w-1/2 opacity-35" aria-hidden="true">
        <div className="absolute right-8 top-8 h-32 w-32 rounded-full border border-violet-300/30" />
        <div className="absolute right-24 top-14 h-56 w-56 rounded-full border border-violet-300/15" />
        <div className="absolute right-40 top-20 h-px w-56 rotate-[-22deg] bg-violet-200/20" />
        <div className="absolute right-16 top-28 h-px w-64 rotate-[12deg] bg-violet-200/20" />
      </div>
      <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
        <span className="inline-flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full border border-violet-200/25 bg-white/8 text-white shadow-inner shadow-white/10">
          <LandingIcon name="trophy" className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-[22px] font-black leading-tight tracking-tight" style={{ fontFamily: "\"Space Grotesk\", Arial, Helvetica, sans-serif" }}>
            Ideas have value. Outcomes drive impact.
          </h2>
          <p className="mt-1 max-w-[610px] text-[13px] leading-5 text-violet-100/80">
            Turn real business problems into funded challenges and verified outcomes.
          </p>
        </div>
      </div>
      <Link href="/challenges" className="relative z-10 mt-4 inline-flex h-[38px] w-fit items-center justify-center gap-2 rounded-lg border border-violet-200/35 bg-white/5 px-4 text-[13px] font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-200 lg:mt-0">
        Explore Live Challenges
        <LandingIcon name="arrow" className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

export function LandingAudienceSection({ authState }: Props) {
  return (
    <section className="bg-[#030a1f] pb-10 pt-2 text-white" data-audience-section>
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <div className="grid gap-4 lg:grid-cols-2" data-audience-card-grid>
          <LandingBrandAudienceCard href={brandHref(authState)} />
          <LandingCreatorAudienceCard href={creatorHref(authState)} />
        </div>
        <LandingOutcomeCtaBanner />
      </div>
    </section>
  );
}
