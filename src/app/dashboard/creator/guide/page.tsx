import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Creator Guide | Creator Challenge Network",
  robots: { index: false, follow: false },
};

const creatorSections = [
  {
    title: "Discover Business Challenges",
    body: "Browse live Business Challenges, review the business problem, prize pool, deadline, expected outcome, and judging criteria, then confirm the challenge is open for solutions.",
    cta: { label: "Discover Challenges", href: "/dashboard/creator/discover" },
  },
  {
    title: "Submit A Solution Proposal",
    body: "Open an eligible Business Challenge, prepare the requested solution, add your description, project links, and supporting material, then review before finalizing. A finalized submission becomes immutable in the current product flow.",
  },
  {
    title: "Blind Review",
    body: "During blind evaluation, the Brand reviews the proposed solution without creator identity being exposed in the review surface. Evaluation focuses on the work and the defined criteria, and you can follow status from My Submissions.",
  },
  {
    title: "Track Your Submissions",
    body: "Use My Submissions to follow supported states such as Submitted, Under Review, and Reward Paid. Drafts and submitted proposals stay tied to their Business Challenge.",
    cta: { label: "My Submissions", href: "/dashboard/creator/submissions" },
  },
  {
    title: "Win And Receive USDC",
    body: "After Brand winner finalization, eligible rewards are settled in test USDC through the CCN settlement flow. Your payout wallet receives or reflects rewards, and verified payout transactions can be inspected on Arc Testnet when evidence is available. Wallet Balance is not the same as Total Earnings; wallet balance can include funds beyond earned rewards.",
    cta: { label: "View Wallet", href: "/dashboard/creator/wallet" },
  },
  {
    title: "Trust And Verification",
    body: "Prize pools are funded before open participation. Blind Review supports fair evaluation. Rewards use USDC, and settlement is executed or verified on Arc Testnet where applicable. Transaction evidence may be viewed through Arc explorer links when available.",
  },
];

export default function CreatorGuidePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-2.5">
      <header className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300">Creator Workspace</p>
        <h1 className="mt-1 text-xl font-semibold leading-tight text-white">Creator Guide</h1>
        <p className="mt-1 max-w-3xl text-[12px] leading-4 text-slate-300">
          Learn how to discover Business Challenges, submit Solution Proposals, follow reviews, and receive rewards.
        </p>
      </header>

      <section className="grid gap-2">
        {creatorSections.map((section, index) => (
          <article key={section.title} className="rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
            <div className="flex gap-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-violet-300/25 bg-violet-500/15 text-[10px] font-semibold text-violet-100">
                {index + 1}
              </span>
              <div className="min-w-0">
                <h2 className="text-[13px] font-semibold text-white">{section.title}</h2>
                <p className="mt-1 text-[11px] leading-4 text-slate-300">{section.body}</p>
                {section.cta ? (
                  <Link href={section.cta.href} className="mt-2 inline-flex h-7 items-center rounded-md border border-white/10 px-2.5 text-[11px] font-semibold text-violet-100 transition hover:bg-white/[0.06]">
                    {section.cta.label} <span className="ml-2" aria-hidden="true">-&gt;</span>
                  </Link>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
