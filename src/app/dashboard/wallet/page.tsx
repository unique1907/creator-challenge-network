import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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

  return (
    <main className="min-h-screen bg-[#030711] px-5 py-6 text-white xl:px-9">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="text-sm font-semibold text-blue-300">Back to dashboard</Link>
        <h1 className="mt-4 text-3xl font-black tracking-tight">Brand Wallet</h1>
        <p className="mt-2 text-slate-400">Canonical Brand PAYMENT wallet status for Arc Testnet campaign funding.</p>

        <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.035] p-5">
          <dl className="grid gap-3 md:grid-cols-2">
            <Info label="Purpose" value="BRAND:PAYMENT" />
            <Info label="Network" value={wallet?.blockchain ?? "Unavailable"} />
            <Info label="Wallet address" value={wallet?.walletAddress ?? "No Brand PAYMENT wallet mapping"} />
            <Info label="Wallet state" value={wallet?.walletState ?? "Unavailable"} />
            <Info label="Account type" value={wallet?.accountType ?? "Unavailable"} />
            <Info label="Wallet balance" value={balance?.display ?? "Wallet balance unavailable"} />
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/dashboard/campaigns" className="inline-flex h-10 items-center rounded-lg border border-white/10 px-4 text-sm font-black text-white transition hover:bg-white/[0.05]">
              View Business Challenge Funding
            </Link>
            <Link href="/create-challenge?new=1" prefetch className="inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-4 text-sm font-black text-white">
              + New Business Challenge
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-2 break-all text-sm font-bold text-white">{value}</dd>
    </div>
  );
}
