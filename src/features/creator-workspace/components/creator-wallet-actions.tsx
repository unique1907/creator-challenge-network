"use client";

import { useState } from "react";

export function CreatorWalletActions({ walletAddress, explorerUrl }: { walletAddress: string | null; explorerUrl: string | null }) {
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void copyAddress()}
        disabled={!walletAddress}
        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {copied ? "Copied" : "Copy address"}
      </button>
      {explorerUrl ? (
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]">
          View on Explorer
        </a>
      ) : null}
      <a href="/dashboard/creator/wallet" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]">
        Refresh balance
      </a>
    </div>
  );
}
