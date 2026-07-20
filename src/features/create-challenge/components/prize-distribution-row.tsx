import type { PrizeDistribution } from "@/types/create-challenge";

type PrizeDistributionRowProps = {
  prize: PrizeDistribution;
};

export function PrizeDistributionRow({ prize }: PrizeDistributionRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-slate-800 bg-slate-950/60 px-4 py-3">
      <span className="text-sm font-semibold text-slate-200">
        {prize.place} Place
      </span>
      <span className="text-sm font-bold text-white">
        {prize.amount.toLocaleString()} {prize.currency}
      </span>
    </div>
  );
}
