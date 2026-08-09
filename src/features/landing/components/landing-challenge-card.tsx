/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { formatUsdc } from "@/features/challenges/lib/challenge-utils";
import type { Challenge } from "@/types/ccn";
import { DeadlineCountdown } from "./deadline-countdown";
import { LandingIcon } from "./landing-icons";

type LandingChallengeCardProps = {
  challenge: Challenge;
  currentTimeIso: string;
};

function solutionLabel(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? "solution" : "solutions"}`;
}

export function LandingChallengeCard({ challenge, currentTimeIso }: LandingChallengeCardProps) {
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md shadow-slate-200/70">
      <div className="relative">
        {challenge.coverImageUrl ? (
          <img src={challenge.coverImageUrl} alt={challenge.coverImageAlt ?? `${challenge.title} cover image`} className="aspect-[16/7] max-h-[120px] w-full object-cover" />
        ) : (
          <div className="grid aspect-[16/7] max-h-[120px] w-full place-items-center bg-slate-100 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Cover unavailable
          </div>
        )}
        <span className="absolute left-3 top-3 inline-flex rounded-md bg-emerald-500/95 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white shadow-sm">
          LIVE
        </span>
      </div>

      <div className="p-3.5">
        <h3 className="line-clamp-2 text-[14px] font-semibold leading-5 text-slate-950">
          {challenge.title}
        </h3>
        <p className="mt-1.5 truncate text-[11px] font-medium text-slate-500">{challenge.category}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold leading-4 text-slate-600">
          <span>{formatUsdc(challenge.rewardUsdc)} test USDC</span>
          <span>{solutionLabel(challenge.submissions)}</span>
          <span className="inline-flex items-center gap-1">
            <LandingIcon name="clock" className="h-3.5 w-3.5 text-violet-700" />
            <DeadlineCountdown deadline={challenge.deadline} initialNowIso={currentTimeIso} />
          </span>
        </div>

        <div className="mt-4">
          <Link href={`/challenges/${challenge.slug}`} className="inline-flex h-9 items-center rounded-md bg-violet-700 px-3.5 text-[12px] font-bold text-white transition hover:bg-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-400">
            View Challenge
          </Link>
        </div>
      </div>
    </article>
  );
}
