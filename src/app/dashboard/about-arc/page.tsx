import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ARC_TESTNET_CHAIN_ID } from "@/config/create-challenge-deadline-policy";
import { getBrandAccountControlData } from "@/features/dashboard/brand-account-controls.server";
import { BrandAccountControls } from "@/features/dashboard/components/brand-workspace-navigation";
import { CREATE_CHALLENGE_ESCROW_CONTRACT } from "@/services/create-challenge/create-challenge-store.server";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";

export const metadata: Metadata = {
  title: "Arc Integration | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export default async function AboutArcPage() {
  const context = await getAuthenticatedCcnContext({ workspace: "brand", allowTestContext: true });
  if (!context) redirect("/auth/sign-in");
  if (!context.brandAccess) redirect("/dashboard/creator");
  const accountControls = await getBrandAccountControlData(context);

  return (
    <main className="min-h-screen bg-[#030711] px-5 py-6 text-white xl:px-9">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link href="/dashboard" className="text-sm font-semibold text-blue-300">Back to dashboard</Link>
            <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.07em] text-cyan-200">Arc Integration</p>
            <h1 className="mt-3 text-[24px] font-semibold leading-[1.18] tracking-normal md:text-[28px]">Programmable Money Hackathon</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-400">
              CCN uses Arc Testnet as the programmable USDC settlement layer for funded Business Challenges and creator payouts.
            </p>
          </div>
          <BrandAccountControls {...accountControls} />
        </header>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Info title="Campaign funding" body="Brand prize pools and platform fees are locked into the CCNEscrow contract before a challenge is published." />
          <Info title="Creator payout settlement" body="Winner settlement is reconciled from Arc transaction receipts and payout transaction evidence before CCN marks a Business Challenge completed." />
          <Info title="Circle Hosted Wallets" body="Circle user-controlled wallets provide hosted approval screens for Brand PAYMENT and PAYOUT operations." />
          <Info title="USDC settlement" body="CCN tracks test USDC on Arc Testnet. This environment is not mainnet production money." />
        </div>

        <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-base font-semibold text-white">Runtime context</h2>
          <dl className="mt-4 grid gap-3 md:grid-cols-2">
            <Fact label="Network" value="Arc Testnet" />
            <Fact label="Chain ID" value={String(ARC_TESTNET_CHAIN_ID)} />
            <Fact label="Runtime contract" value={CREATE_CHALLENGE_ESCROW_CONTRACT} />
            <Fact label="Infrastructure" value="Arc + Circle + USDC" />
          </dl>
        </section>
      </div>
    </main>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-3 text-[13px] leading-5 text-slate-300">{body}</p>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">{label}</dt>
      <dd className="mt-2 break-all text-[13px] font-medium text-white">{value}</dd>
    </div>
  );
}
