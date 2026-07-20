import type { FundingState } from "@/types/create-challenge";
import { StatusBadge } from "./status-badge";

type NetworkStatusCardProps = {
  funding: FundingState;
};

export function NetworkStatusCard({ funding }: NetworkStatusCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-bold text-white">Network Status</h2>
        <StatusBadge tone="testnet">Testnet</StatusBadge>
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-400">Network</dt>
          <dd className="font-semibold text-white">{funding.network}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-400">Funding</dt>
          <dd className="font-semibold text-cyan-100">{funding.fundingStatus}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-400">Escrow</dt>
          <dd className="font-semibold text-violet-100">{funding.escrowStatus}</dd>
        </div>
      </dl>
    </div>
  );
}
