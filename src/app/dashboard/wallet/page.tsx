import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBrandAccountControlData } from "@/features/dashboard/brand-account-controls.server";
import { BrandAccountControls } from "@/features/dashboard/components/brand-workspace-navigation";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";
import { getScopedStoredWallet } from "@/services/circle/wallet-spike-store.server";
import { readBrandUsdcBalance } from "@/services/create-challenge/brand-payment-account.server";

export const metadata: Metadata = {
  title: "Brand Wallet | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export default async function BrandWalletPage() {
  const context = await getAuthenticatedCcnContext({ workspace: "brand", allowTestContext: true });
  if (!context) redirect("/auth/sign-in");
  if (!context.brandAccess) redirect("/dashboard/creator");

  const wallet = await getScopedStoredWallet({
    ccnAccountId: context.ccnAccountId,
    role: "BRAND",
    purpose: "PAYMENT",
  });
  const balance = wallet ? await readBrandUsdcBalance(wallet.walletAddress).catch(() => null) : null;
  const accountControls = await getBrandAccountControlData(context);

  return (
    <main className="min-h-screen bg-[#030711] px-3 py-3 text-white xl:px-5">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/dashboard" className="text-[12px] font-semibold text-blue-300">Back to dashboard</Link>
            <h1 className="mt-1.5 text-lg font-semibold leading-[1.12] tracking-normal md:text-xl">Brand Wallet</h1>
            <p className="mt-1 max-w-2xl text-[12px] text-slate-400">
              Your testnet USDC wallet is used to fund business challenges and approve selected-solution payouts.
            </p>
          </div>
          <BrandAccountControls {...accountControls} />
        </header>

        <section className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
          <div className="grid gap-2 md:grid-cols-[1.2fr_1fr]">
            <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06] p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-emerald-200">Available Balance</p>
              <p className="mt-1 text-base font-semibold leading-tight">{balance?.display ?? "Unavailable"}</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-300">Arc Testnet uses test USDC. No real funds are shown on this page.</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-950/35 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">Payment Account</p>
              <p className="mt-1 text-[13px] font-semibold text-white">{wallet?.walletState ?? "Unavailable"}</p>
              <p className="mt-1 break-all text-[11px] leading-4 text-slate-300">{wallet?.walletAddress ?? "No Brand wallet is mapped yet."}</p>
            </div>
          </div>

          <dl className="mt-2 grid gap-1.5 md:grid-cols-3">
            <Info label="Network" value={wallet?.blockchain ?? "Unavailable"} />
            <Info label="Funding" value="Business challenge prizes" />
            <Info label="Settlement" value="Selected solution payouts" />
            <Info label="Explorer" value="Use transaction evidence from Payments" />
          </dl>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Link href="/dashboard/campaigns" className="inline-flex h-7 items-center rounded-md border border-white/10 px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/[0.05]">
              View Business Challenges
            </Link>
            <Link href="/dashboard/payments" className="inline-flex h-7 items-center rounded-md border border-white/10 px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/[0.05]">
              View Payments
            </Link>
            <Link href="/create-challenge?new=1" prefetch className="inline-flex h-7 items-center rounded-md bg-gradient-to-r from-violet-600 to-blue-600 px-2.5 text-[11px] font-semibold text-white">
              + New Business Challenge
            </Link>
          </div>

          <details className="mt-2.5 rounded-lg border border-white/10 bg-slate-950/35 p-2">
            <summary className="cursor-pointer text-[12px] font-semibold text-slate-200">Technical details</summary>
            <dl className="mt-2 grid gap-1.5 md:grid-cols-2">
              <Info label="Wallet address" value={wallet?.walletAddress ?? "Unavailable"} />
              <Info label="Account type" value={wallet?.accountType ?? "Unavailable"} />
            </dl>
          </details>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-950/35 p-1.5">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-all text-[11px] font-medium text-white">{value}</dd>
    </div>
  );
}
