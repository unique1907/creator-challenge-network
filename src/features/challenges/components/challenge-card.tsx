/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import {
  accentClassName,
  formatDeadline,
  formatUsdc,
  statusClassName,
} from "@/features/challenges/lib/challenge-utils";
import type { Challenge } from "@/types/ccn";

type ChallengeCardProps = {
  challenge: Challenge;
};

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  return (
    <article className="flex h-full flex-col justify-between rounded-xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/15">
      <div>
        {challenge.coverImageUrl ? (
          <img src={challenge.coverImageUrl} alt={challenge.coverImageAlt ?? `${challenge.title} cover image`} className="mb-5 aspect-[16/9] w-full rounded-lg border border-white/10 object-cover" />
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
            {challenge.status}
          </span>
        </div>

        <h3 className="mt-5 text-2xl font-semibold tracking-tight text-white">
          {challenge.title}
        </h3>
        <p className="mt-2 text-sm font-medium text-cyan-100/80">
          {challenge.brand}
        </p>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          {challenge.summary}
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-white/10 bg-slate-950/45 p-3">
            <p className="text-slate-400">Reward</p>
            <p className="mt-1 font-semibold text-emerald-200">
              {formatUsdc(challenge.rewardUsdc)} USDC
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-950/45 p-3">
            <p className="text-slate-400">Deadline</p>
            <p className="mt-1 font-semibold text-white">
              {formatDeadline(challenge.deadline)}
            </p>
          </div>
        </div>

        <dl className="space-y-2 text-sm text-slate-300">
          <div className="flex justify-between gap-4">
            <dt>Submissions</dt>
            <dd className="font-medium text-white">{challenge.submissions}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Escrow</dt>
            <dd className="font-medium text-teal-100">
              {challenge.escrowStatus}
            </dd>
          </div>
        </dl>

        <p className="rounded-lg border border-white/10 bg-white/[0.035] p-3 text-xs leading-5 text-slate-300">
          {challenge.usageRights}
        </p>

        <Link
          href={`/challenges/${challenge.slug}`}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          View challenge
        </Link>
      </div>
    </article>
  );
}
