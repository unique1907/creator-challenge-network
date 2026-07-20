import type { LandingChallenge } from "@/features/landing/data/landing-page";
import { LandingIcon } from "./landing-icons";

type LandingChallengeCardProps = {
  challenge: LandingChallenge;
};

const artworkClassNames: Record<LandingChallenge["accent"], string> = {
  nike: "from-slate-950 via-blue-950 to-slate-900",
  spotify: "from-emerald-950 via-slate-950 to-emerald-900",
  samsung: "from-slate-950 via-blue-950 to-indigo-950",
  adobe: "from-red-950 via-red-800 to-slate-950",
  redbull: "from-slate-950 via-blue-950 to-slate-900",
  gopro: "from-cyan-950 via-slate-900 to-blue-950",
};

export function LandingChallengeCard({ challenge }: LandingChallengeCardProps) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-200/70">
      <div
        className={`relative h-24 bg-gradient-to-r ${artworkClassNames[challenge.accent]}`}
      >
        <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_70%_30%,rgba(59,130,246,0.55),transparent_28%),linear-gradient(135deg,transparent_45%,rgba(168,85,247,0.45)_46%,transparent_60%)]" />
        <span className="absolute left-4 top-3 rounded-md border border-white/20 bg-slate-950/55 px-2 py-1 text-xs text-white">
          Demo
        </span>
        <p className="absolute bottom-4 left-4 text-2xl font-bold tracking-wide text-white">
          {challenge.brand}
        </p>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              {challenge.brand}
            </p>
            <h3 className="mt-1 text-[17px] font-bold leading-[21px] text-slate-950">
              {challenge.title}
            </h3>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
            {challenge.category}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-lg font-bold text-slate-950">{challenge.reward}</p>
          <span className="rounded-md bg-slate-100 px-3 py-1 text-xs text-slate-600">
            {challenge.winners}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-xs text-slate-600">
          <p className="flex items-center gap-1.5">
            <LandingIcon name="clock" className="h-4 w-4" />
            {challenge.timeLeft}
          </p>
          <p className="flex items-center gap-1.5 justify-self-end">
            <LandingIcon name="submissions" className="h-4 w-4" />
            {challenge.submissions} submissions
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-medium">
          <p className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-2 text-emerald-700">
            <LandingIcon name="lock" className="h-4 w-4" />
            Escrow Funded
          </p>
          <p className="flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-2 text-violet-700">
            <LandingIcon name="blind" className="h-4 w-4" />
            Blind Review
          </p>
        </div>
      </div>
    </article>
  );
}
