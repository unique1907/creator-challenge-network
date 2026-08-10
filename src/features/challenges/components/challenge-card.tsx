import Link from "next/link";
import { BusinessChallengeCover, formatBusinessChallengeHierarchy } from "@/components/ui/business-challenge-cover";
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
  const hierarchy = formatBusinessChallengeHierarchy({
    brand: challenge.brand,
    title: challenge.title,
    category: challenge.category,
  });

  return (
    <article className="flex h-full flex-col justify-between rounded-xl border border-white/10 bg-white/[0.045] p-3.5 shadow-xl shadow-black/15">
      <div>
        {challenge.coverImageUrl ? (
          <BusinessChallengeCover
            src={challenge.coverImageUrl}
            alt={challenge.coverImageAlt}
            title={challenge.title}
            className="mb-3 aspect-[16/7] max-h-[132px] w-full rounded-lg"
            imageClassName="p-2"
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize leading-4 ${statusClassName(challenge.status)}`}
          >
            {challenge.publicStatusLabel ?? challenge.status}
          </span>
        </div>

        {hierarchy.brand ? (
          <p className="mt-2 truncate text-xs font-medium text-cyan-100/80">
            {hierarchy.brand}
          </p>
        ) : null}
        <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-5 text-white">
          {hierarchy.title}
        </h3>
        <span
          className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold leading-4 ${accentClassName(challenge.accent)}`}
        >
          {hierarchy.category}
        </span>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">
          {challenge.summary}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-white/10 bg-slate-950/45 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Reward</p>
            <p className="mt-1 text-sm font-semibold leading-5 text-emerald-200">
              {formatUsdc(challenge.rewardUsdc)} USDC
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-950/45 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Deadline</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-white">
              {formatDeadline(challenge.deadline)}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-xs leading-5 text-slate-300">
          <div className="flex justify-between gap-4">
            <dt>Submissions</dt>
            <dd className="font-medium text-white">{challenge.submissions}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Prize Pool</dt>
            <dd className="truncate text-right font-medium text-teal-100">
              {challenge.escrowStatus}
            </dd>
          </div>
        </dl>

        <p className="line-clamp-2 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-2 text-[11px] leading-4 text-slate-300">
          {challenge.usageRights}
        </p>

        <Link
          href={`/challenges/${challenge.slug}`}
          className="inline-flex h-9 w-full items-center justify-center rounded-md bg-cyan-300 px-3 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          {challenge.publicCtaLabel ?? "View challenge"}
        </Link>
      </div>
    </article>
  );
}
