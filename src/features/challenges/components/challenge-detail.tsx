import Link from "next/link";
import { BusinessChallengeCover } from "@/components/ui/business-challenge-cover";
import {
  accentClassName,
  formatDeadline,
  formatUsdc,
  statusClassName,
} from "@/features/challenges/lib/challenge-utils";
import type { Challenge } from "@/types/ccn";

type ChallengeDetailProps = {
  challenge: Challenge;
};

function creatorSignInPath(slug: string) {
  const returnTo = `/dashboard/creator/challenges/${encodeURIComponent(slug)}`;
  const params = new URLSearchParams({ role: "creator", next: returnTo });
  return `/auth/sign-in?${params.toString()}`;
}

export function ChallengeDetail({ challenge }: ChallengeDetailProps) {
  const submissionClosed = challenge.submissionClosed ?? challenge.status !== "open";
  const participation = participationState(challenge);

  return (
    <article className="mx-auto max-w-6xl px-6 py-12 sm:px-8 lg:px-10">
      <Link
        href="/challenges"
        className="text-sm font-semibold text-cyan-200 transition hover:text-white"
      >
        Back to challenges
      </Link>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          {challenge.coverImageUrl ? (
            <BusinessChallengeCover
              src={challenge.coverImageUrl}
              alt={challenge.coverImageAlt}
              title={challenge.title}
              className="mb-8 aspect-[16/7] w-full rounded-xl shadow-2xl shadow-black/20"
              imageClassName="p-3"
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${accentClassName(challenge.accent)}`}
            >
              {challenge.category}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClassName(challenge.status)}`}
            >
              {challenge.publicStatusLabel ?? challenge.status}
            </span>
          </div>

          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            {challenge.title}
          </h1>
          <p className="mt-4 text-lg font-medium text-cyan-100/85">
            {challenge.brand}
          </p>
          <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300">
            {challenge.brief}
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <InfoPanel title="Deliverables" items={challenge.deliverables} />
            <InfoPanel title="Blind review criteria" items={challenge.evaluation} />
          </div>

          <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.045] p-6">
            <h2 className="text-xl font-semibold text-white">
              Audience and usage rights
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {challenge.audience}
            </p>
            <p className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50">
              {challenge.usageRights}
            </p>
          </section>

          <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.045] p-6">
            <h2 className="text-xl font-semibold text-white">
              {participation.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {participation.copy}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {submissionClosed || !participation.href ? (
                <span className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-slate-300">
                  {participation.actionLabel}
                </span>
              ) : (
                <Link
                  href={participation.href}
                  className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
                >
                  {participation.actionLabel}
                </Link>
              )}
            </div>
          </section>
        </section>

        <aside className="h-fit rounded-xl border border-white/10 bg-slate-950/65 p-6 shadow-2xl shadow-black/20">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Prize Pool on Arc
          </p>
          <p className="mt-3 text-4xl font-semibold text-white">
            {formatUsdc(challenge.rewardUsdc)} USDC
          </p>
          <p className="mt-2 text-sm text-emerald-200">
            {challenge.escrowStatus}
          </p>

          <dl className="mt-6 space-y-4 text-sm">
            <div className="flex justify-between gap-5 border-b border-white/10 pb-3">
              <dt className="text-slate-400">Deadline</dt>
              <dd className="text-right font-medium text-white">
                {formatDeadline(challenge.deadline)}
              </dd>
            </div>
            <div className="flex justify-between gap-5 border-b border-white/10 pb-3">
              <dt className="text-slate-400">Submissions</dt>
              <dd className="font-medium text-white">{challenge.submissions}</dd>
            </div>
            <div className="flex justify-between gap-5 border-b border-white/10 pb-3">
              <dt className="text-slate-400">Track</dt>
              <dd className="text-right font-medium text-white">
                DeFi / Programmable Money
              </dd>
            </div>
            <div className="flex justify-between gap-5">
              <dt className="text-slate-400">Winner</dt>
              <dd className="text-right font-medium text-white">
                {challenge.winnerModel ?? "One selected submission"}
              </dd>
            </div>
          </dl>

          {challenge.prizeDistribution?.length ? (
            <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-bold text-white">Prize distribution</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {challenge.prizeDistribution.map((prize) => (
                  <li key={prize}>{prize}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {challenge.fundingTransactionHash ? (
            <a
              href={`https://testnet.arcscan.app/tx/${challenge.fundingTransactionHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block text-sm font-bold text-cyan-200 transition hover:text-cyan-100"
            >
              Funding transaction
            </a>
          ) : null}

          {challenge.escrowContractAddress ? (
            <a
              href={`https://testnet.arcscan.app/address/${challenge.escrowContractAddress}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block text-sm font-bold text-cyan-200 transition hover:text-cyan-100"
            >
              View Arc contract
            </a>
          ) : null}
        </aside>
      </div>
    </article>
  );
}

function participationState(challenge: Challenge) {
  if (challenge.publicStatusLabel === "Closed — Not Enough Submissions") {
    return {
      title: "Submissions are closed",
      copy: "This challenge closed without enough eligible Solution Proposals to fill all planned Winner positions.",
      actionLabel: "Submissions are closed",
      href: null,
    };
  }
  if (challenge.status === "open" && !challenge.submissionClosed) {
    return {
      title: "Ready to participate?",
      copy: "Sign in as a Creator to prepare your entry. Your identity stays hidden from the Brand during review.",
      actionLabel: "Sign in to submit",
      href: creatorSignInPath(challenge.slug),
    };
  }
  if (challenge.status === "reviewing") {
    return {
      title: "Submissions are closed",
      copy: "The submission window has ended. The Brand is reviewing submitted solutions.",
      actionLabel: "Submissions are closed",
      href: null,
    };
  }
  if (challenge.status === "closed") {
    return {
      title: "Submissions are closed",
      copy: "This challenge closed without receiving Solution Proposals.",
      actionLabel: "Closed without submissions",
      href: null,
    };
  }
  if (challenge.status === "completed") {
    return {
      title: "Challenge completed",
      copy: "This challenge has a completed outcome and payout record.",
      actionLabel: "Completed",
      href: null,
    };
  }
  return {
    title: "Submissions are closed",
    copy: "This challenge has moved beyond submission intake.",
    actionLabel: "Submissions are closed",
    href: null,
  };
}
function InfoPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.045] p-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
