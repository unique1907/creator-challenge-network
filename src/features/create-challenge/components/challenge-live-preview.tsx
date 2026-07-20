import type { CreateChallengeDraftState } from "@/types/create-challenge";
import { PrizeDistributionRow } from "./prize-distribution-row";
import { StatusBadge } from "./status-badge";

type ChallengeLivePreviewProps = {
  draft: CreateChallengeDraftState;
};

export function ChallengeLivePreview({ draft }: ChallengeLivePreviewProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="demo">Demo</StatusBadge>
        <StatusBadge tone="testnet">{draft.funding.network}</StatusBadge>
      </div>
      <p className="mt-5 text-sm font-semibold text-slate-300">
        {draft.challenge.brandName}
      </p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
        {draft.challenge.title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        {draft.challenge.description}
      </p>
      <div className="mt-5 rounded-lg border border-white/10 bg-slate-950/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Prize Pool
        </p>
        <p className="mt-2 text-3xl font-bold text-white">
          {draft.prizePool.totalAmount.toLocaleString()}{" "}
          <span className="text-lg">{draft.prizePool.currency}</span>
        </p>
      </div>
      <div className="mt-4 space-y-2">
        {draft.prizePool.prizeDistribution.map((prize) => (
          <PrizeDistributionRow key={prize.place} prize={prize} />
        ))}
      </div>
    </section>
  );
}
