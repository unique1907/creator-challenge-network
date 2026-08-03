import type { LandingChallenge } from "@/features/landing/data/landing-page";
import { LandingIcon } from "./landing-icons";

type LandingChallengeCardProps = {
  challenge: LandingChallenge;
};

const accentClassNames: Record<LandingChallenge["accent"], string> = {
  nike: "bg-slate-950 text-blue-200",
  spotify: "bg-emerald-950 text-emerald-200",
  samsung: "bg-blue-950 text-blue-200",
  adobe: "bg-red-950 text-red-100",
  redbull: "bg-slate-950 text-orange-200",
  gopro: "bg-cyan-950 text-cyan-100",
};

export function LandingChallengeCard({ challenge }: LandingChallengeCardProps) {
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/70">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] ${accentClassNames[challenge.accent]}`}>
              {challenge.brand}
            </span>
            <h3 className="mt-4 text-xl font-black leading-6 text-slate-950">
              {challenge.title}
            </h3>
          </div>
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
            {challenge.category}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-y border-slate-200 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Prize Pool</p>
            <p className="mt-1 text-lg font-black text-slate-950">{challenge.reward}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Winner</p>
            <p className="mt-1 text-lg font-black text-slate-950">{challenge.winners}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm text-slate-600">
          <p className="flex items-center gap-2">
            <LandingIcon name="clock" className="h-4 w-4 text-violet-700" />
            {challenge.timeLeft}
          </p>
          <p className="flex items-center gap-2">
            <LandingIcon name="submissions" className="h-4 w-4 text-violet-700" />
            {challenge.submissions} submissions
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold">
          <p className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-2 text-emerald-700">
            <LandingIcon name="lock" className="h-4 w-4" />
            Escrow funded
          </p>
          <p className="flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-2 text-violet-700">
            <LandingIcon name="blind" className="h-4 w-4" />
            Blind review
          </p>
        </div>
      </div>
    </article>
  );
}