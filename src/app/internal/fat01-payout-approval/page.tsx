import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSpikeAllowedInEnvironment } from "@/services/internal-spike-auth.server";
import { Fat01PayoutApprovalClient } from "./payout-approval-client";

export const metadata: Metadata = {
  title: "FAT-01 Payout Approval | CCN Internal",
};

const FAT_01_OPERATION = {
  draftId: "f51a9024-879f-4bc0-b519-3bff298d2614",
  challengeId: "0x98a03a73cab4f10049f2269c348b69031aa78484b15c9098943e5cea07bcbdd9",
  canonicalWinner: "0x7660f88026f01b44ac9b96d02d045dccffeb7e79",
  payoutAmount: "1000000",
  platformFee: "100000",
  escrow: "0x4DCE98F8a35d09F57ECE7A340B8392Ba0Fb7ba3D",
  payoutWallet: "0x37e30fe02f1f0a7d46ea7cd254398830be8c30b9",
  treasury: "0x6d2ca88a7bDA59280D9ad0E41aA87C9acF24Aa1A",
  chainId: "5042002",
  selectedBlindEntryIds: ["117db492-a3f2-4e2d-931c-cb885ed3eb5f"],
} as const;

export default function Fat01PayoutApprovalPage() {
  if (!isSpikeAllowedInEnvironment()) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">
          Internal FAT-01 approval step
        </p>
        <h1 className="mt-3 text-3xl font-bold">Hosted PAYOUT Approval</h1>
        <p className="mt-3 text-sm text-slate-300">
          This page opens one Circle Hosted PAYOUT approval for the frozen FAT-01 operation only.
          It does not reconcile or submit any additional application action after PIN completion.
        </p>
        <Fat01PayoutApprovalClient
          appId={process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? ""}
          operation={FAT_01_OPERATION}
        />
      </div>
    </main>
  );
}
