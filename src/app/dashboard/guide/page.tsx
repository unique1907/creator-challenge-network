import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBrandAccountControlData } from "@/features/dashboard/brand-account-controls.server";
import { BrandAccountControls } from "@/features/dashboard/components/brand-workspace-navigation";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";

export const metadata: Metadata = {
  title: "Brand Guide | Creator Challenge Network",
  robots: { index: false, follow: false },
};

const brandSections = [
  {
    title: "Define The Business Problem",
    body: "Create a Business Challenge with a challenge title, business problem, expected outcome, judging criteria, prize pool, winner model, and deadlines or rules.",
    cta: { label: "New Business Challenge", href: "/create-challenge?new=1" },
  },
  {
    title: "Fund The Prize Pool",
    body: "CCN calculates the prize pool and platform fee. Your Brand payment wallet is used to secure reward funding before the challenge becomes live. In the current MVP, escrow funding and verification use test USDC on Arc Testnet.",
  },
  {
    title: "Publish",
    body: "Once required funding and verification are complete, the challenge can be published. Eligible published challenges become visible to creators, who can submit Solution Proposals before the deadline.",
    cta: { label: "Business Challenges", href: "/dashboard/campaigns" },
  },
  {
    title: "Review Solutions",
    body: "Submitted solutions enter the review flow. Blind Review hides creator identity during evaluation, and the Brand evaluates against the judging criteria defined in the Business Challenge.",
  },
  {
    title: "Select The Winner",
    body: "Finalize the winning solution according to the challenge rules. CCN keeps winner finalization tied to the canonical challenge state so the selected outcome remains consistent.",
  },
  {
    title: "Settle The Reward",
    body: "The winning reward is prepared for settlement. Circle Wallets participate in the current approval flow, and USDC settlement executes through CCN's Arc settlement infrastructure. Verified settlement evidence can be reconciled from Arc Testnet.",
  },
];

export default async function BrandGuidePage() {
  const context = await getAuthenticatedCcnContext({ workspace: "brand", allowTestContext: true });
  if (!context) redirect("/auth/sign-in");
  if (!context.brandAccess) redirect("/dashboard/creator");
  if (!context.brandOnboardingComplete) redirect("/auth/onboarding/brand");

  const accountControls = await getBrandAccountControlData(context);

  return (
    <main className="min-h-screen bg-[#030711] px-3 py-3 text-white xl:px-5">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/dashboard" className="text-[12px] font-semibold text-blue-300">Back to dashboard</Link>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-300">Brand Workspace</p>
            <h1 className="mt-1 text-xl font-semibold leading-tight text-white">Brand Guide</h1>
            <p className="mt-1 max-w-3xl text-[12px] leading-4 text-slate-300">
              Learn how to launch a Business Challenge, secure the reward, review Solution Proposals, and settle the winning outcome.
            </p>
          </div>
          <BrandAccountControls {...accountControls} />
        </header>

        <section className="mt-3 grid gap-2">
          {brandSections.map((section, index) => (
            <article key={section.title} className="rounded-xl border border-slate-700/75 bg-[#0b1220] p-2.5">
              <div className="flex gap-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-violet-300/25 bg-violet-500/15 text-[10px] font-semibold text-violet-100">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h2 className="text-[13px] font-semibold text-white">{section.title}</h2>
                  <p className="mt-1 text-[11px] leading-4 text-slate-300">{section.body}</p>
                  {section.cta ? (
                    <Link href={section.cta.href} prefetch className="mt-2 inline-flex h-7 items-center rounded-md border border-white/10 px-2.5 text-[11px] font-semibold text-violet-100 transition hover:bg-white/[0.06]">
                      {section.cta.label} <span className="ml-2" aria-hidden="true">-&gt;</span>
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
