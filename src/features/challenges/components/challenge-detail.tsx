import Link from "next/link";
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

export function ChallengeDetail({ challenge }: ChallengeDetailProps) {
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
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${accentClassName(challenge.accent)}`}
            >
              {challenge.category}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClassName(challenge.status)}`}
            >
              {challenge.status}
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
        </section>

        <aside className="h-fit rounded-xl border border-white/10 bg-slate-950/65 p-6 shadow-2xl shadow-black/20">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Arc escrow
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
                One selected submission
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </article>
  );
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
