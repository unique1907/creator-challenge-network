"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

type BrandWalletQuickActionsProps = {
  walletAddress: string | null;
  walletHref: string;
  balanceLabel: string;
};

export function BrandWalletQuickActions({ walletAddress, walletHref, balanceLabel }: BrandWalletQuickActionsProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function copyWalletAddress() {
    if (!walletAddress) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(walletAddress);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = walletAddress;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) throw new Error("Clipboard fallback failed.");
      }
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    } finally {
      window.setTimeout(() => setCopyState("idle"), 1600);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-[58px] items-center justify-between gap-3 rounded-lg border border-slate-700/70 bg-[#0d1524] px-3 py-2">
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-white">Wallet Balance</span>
          <span className="mt-0.5 block whitespace-nowrap text-[11px] font-medium text-slate-300">{balanceLabel} {" · "} Arc Testnet</span>
        </span>
      </div>
      <QuickAction href="https://faucet.circle.com/" label="Add Test USDC" detail="Get free USDC from Circle Faucet" target="_blank" rel="noopener noreferrer" icon="plus" />
      <button
        type="button"
        onClick={() => void copyWalletAddress()}
        disabled={!walletAddress}
        className="flex min-h-[58px] w-full items-center justify-between gap-3 rounded-lg border border-slate-700/70 bg-[#0d1524] px-3 py-2 text-left transition hover:border-violet-300/30 hover:bg-[#111b2d] disabled:cursor-not-allowed disabled:opacity-55"
      >
        <span>
          <span className="block text-[13px] font-semibold text-white">Copy Wallet Address</span>
          <span className="mt-0.5 block text-[12px] text-slate-300">
            {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy unavailable" : "Copy your Arc Testnet wallet address"}
          </span>
        </span>
        <IconFrame><CopyIcon /></IconFrame>
      </button>
      <QuickAction href={walletHref} label="Open Wallet" detail="Review balance and wallet status" icon="arrow" />
      <QuickAction href="/dashboard/payments" label="View Payments" detail="See funding and settlement history" icon="arrow" />
    </div>
  );
}

function QuickAction({
  href,
  label,
  detail,
  target,
  rel,
  icon,
}: {
  href: string;
  label: string;
  detail: string;
  target?: string;
  rel?: string;
  icon: "plus" | "arrow";
}) {
  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      className="flex min-h-[58px] items-center justify-between gap-3 rounded-lg border border-slate-700/70 bg-[#0d1524] px-3 py-2 transition hover:border-violet-300/30 hover:bg-[#111b2d]"
    >
      <span>
        <span className="block text-[13px] font-semibold text-white">{label}</span>
        <span className="mt-0.5 block text-[12px] text-slate-300">{detail}</span>
      </span>
      <IconFrame>{icon === "plus" ? <PlusIcon /> : <ArrowUpRightIcon />}</IconFrame>
    </Link>
  );
}

function IconFrame({ children }: { children: ReactNode }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-slate-600/55 bg-slate-800/80 text-slate-200" aria-hidden="true">
      {children}
    </span>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M5 15V7a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9">
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  );
}
