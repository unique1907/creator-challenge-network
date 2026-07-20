import { LandingIcon } from "./landing-icons";

const prizeDistribution = [
  { place: "1st Place", amount: "30,000 USDC", tone: "text-yellow-300" },
  { place: "2nd Place", amount: "15,000 USDC", tone: "text-slate-100" },
  { place: "3rd Place", amount: "5,000 USDC", tone: "text-orange-300" },
];

export function FeaturedChallengeCard() {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-purple-400/40 bg-[#080d29] p-6 shadow-2xl shadow-purple-950/35">
      <div className="absolute inset-x-40 top-4 h-72 rounded-full bg-purple-500/18 blur-3xl" />
      <div className="absolute right-0 top-0 h-56 w-72 bg-[radial-gradient(circle_at_center,rgba(217,70,239,0.35),transparent_58%)]" />
      <div className="absolute right-5 top-8 h-48 w-48 rounded-full border border-fuchsia-300/40 shadow-[0_0_52px_rgba(217,70,239,0.38)]" />
      <div className="absolute right-14 top-16 h-32 w-32 rounded-full border border-fuchsia-400/45 shadow-[0_0_38px_rgba(217,70,239,0.45)]" />
      <div className="absolute bottom-24 right-8 flex h-24 items-end gap-1 opacity-70">
        {Array.from({ length: 34 }).map((_, index) => (
          <span
            key={index}
            className="w-1 rounded-full bg-gradient-to-t from-blue-500 to-fuchsia-400"
            style={{ height: `${18 + ((index * 17) % 62)}px` }}
          />
        ))}
      </div>

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <span className="inline-flex items-center gap-2 rounded-md bg-indigo-500/35 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-50">
            <span aria-hidden>☆</span>
            Featured Challenge
          </span>
          <span className="rounded-md border border-white/25 bg-white/5 px-3 py-1 text-xs font-medium text-white">
            Demo
          </span>
        </div>

        <div className="mt-7 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1ed760] text-slate-950">
            <span className="h-6 w-6 rounded-full border-t-4 border-slate-950" />
          </span>
          <p className="text-2xl font-bold text-white">Spotify</p>
        </div>

        <h2 className="mt-6 text-2xl font-semibold text-white">
          Motion Design Challenge
        </h2>
        <span className="mt-3 inline-flex rounded-md bg-violet-500/35 px-3 py-1 text-xs font-medium text-violet-50">
          Motion Design
        </span>

        <div className="mt-7 grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm text-slate-300">Prize Pool</p>
            <p className="mt-1 text-[2.6rem] font-bold leading-none tracking-tight text-white">
              50,000 <span className="text-[1.65rem]">USDC</span>
            </p>
          </div>
          <div className="rounded-lg border border-white/15 bg-slate-950/45 p-3 text-sm">
            <p className="flex items-center gap-2 text-emerald-200">
              <LandingIcon name="lock" className="h-4 w-4" />
              Escrow Funded
            </p>
            <p className="mt-2 flex items-center gap-2 text-cyan-200">
              <LandingIcon name="arc" className="h-4 w-4" />
              Arc Verified
            </p>
          </div>
        </div>

        <div className="mt-7 border-y border-white/12 py-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {prizeDistribution.map((prize) => (
              <div
                key={prize.place}
                className="flex items-center gap-3 sm:border-r sm:border-white/12 sm:last:border-r-0"
              >
                <LandingIcon name="trophy" className={`h-6 w-6 ${prize.tone}`} />
                <div>
                  <p className="text-xs text-slate-300">{prize.place}</p>
                  <p className={`mt-1 text-sm font-bold ${prize.tone}`}>
                    {prize.amount}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 pt-4 text-sm text-slate-200 sm:grid-cols-3">
          <p className="flex items-center gap-2">
            <LandingIcon name="submissions" className="h-5 w-5" />
            42 Submissions
          </p>
          <p className="flex items-center gap-2">
            <LandingIcon name="clock" className="h-5 w-5" />
            6d 12h remaining
          </p>
          <p className="flex items-center gap-2">
            <LandingIcon name="blind" className="h-5 w-5" />
            Blind Review
          </p>
        </div>
      </div>
    </article>
  );
}
