import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormLabel } from "@/components/ui/form-label";
import { getBrandAccountControlData } from "@/features/dashboard/brand-account-controls.server";
import { BrandProfileForm } from "@/features/dashboard/components/brand-identity-forms";
import { BrandAccountControls } from "@/features/dashboard/components/brand-workspace-navigation";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";
import { getScopedStoredWallet } from "@/services/circle/wallet-spike-store.server";
import { readBrandUsdcBalance } from "@/services/create-challenge/brand-payment-account.server";

export const metadata: Metadata = {
  title: "Brand Profile | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export default async function BrandProfilePage() {
  const context = await getAuthenticatedCcnContext({ workspace: "brand", allowTestContext: true });
  if (!context) redirect("/auth/sign-in");
  if (!context.brandAccess) redirect("/dashboard/creator");
  const wallet = await getScopedStoredWallet({
    ccnAccountId: context.ccnAccountId,
    role: "BRAND",
    purpose: "PAYMENT",
  });
  const balance = wallet ? await readBrandUsdcBalance(wallet.walletAddress).catch(() => null) : null;
  const brandCompanyName = context.brandName ?? "Company name not set";
  const accountControls = await getBrandAccountControlData(context);

  return (
    <main className="min-h-screen bg-[#030711] px-3 py-3 text-white xl:px-5">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/dashboard" className="text-[12px] font-semibold text-blue-300">Back to dashboard</Link>
            <h1 className="mt-1.5 text-lg font-semibold leading-[1.12] tracking-normal md:text-xl">Brand profile</h1>
            <p className="mt-1 text-[12px] text-slate-400">Personal operator identity for the authenticated Brand Workspace.</p>
          </div>
          <BrandAccountControls {...accountControls} />
        </header>
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            <FormLabel readOnly className="text-[11px] text-slate-400">Company / Brand name</FormLabel>
          </p>
          <p className="mt-0.5 text-[12px] font-medium text-slate-100">{brandCompanyName}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Company identity is edited in Company settings.</p>
        </div>
        <BrandProfileForm
          initialDisplayName={context.displayName || "Brand Account"}
          email={context.email ?? "Unavailable"}
          avatar={{
            imageKey: context.avatarImageKey ?? null,
            imageUrl: context.avatarImageUrl ?? null,
          }}
          walletSummary={{
            label: balance?.display ?? wallet?.walletState ?? "Wallet unavailable",
            detail: wallet ? "Arc Testnet" : "No Brand PAYMENT wallet mapping",
          }}
        />
      </div>
    </main>
  );
}
