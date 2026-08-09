import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandDashboard } from "@/features/dashboard/components/brand-dashboard";
import { buildBrandDashboardViewModel } from "@/features/dashboard/brand-dashboard-view-model";
import { listCreateChallengeDrafts } from "@/services/create-challenge/create-challenge-store.server";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";
import { getScopedStoredWallet } from "@/services/circle/wallet-spike-store.server";
import { readBrandUsdcBalance } from "@/services/create-challenge/brand-payment-account.server";
import { getBrandDashboardSubmissionNotifications } from "@/features/dashboard/brand-dashboard-data.server";

export const metadata: Metadata = {
  title: "Dashboard | Creator Challenge Network",
  description: "Brand workspace for CCN challenge drafts and funding status.",
};

export default async function DashboardPage() {
  const context = await getAuthenticatedCcnContext({ workspace: "brand", allowTestContext: true });
  if (!context) redirect("/auth/sign-in");
  if (!context.brandAccess) {
    return (
      <main className="min-h-screen bg-[#050916] px-6 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#0c1222] p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-cyan-200">Brand Workspace</p>
          <h1 className="mt-3 text-[24px] font-semibold leading-[1.18] md:text-[28px]">Access not available</h1>
          <p className="mt-3 text-slate-300">This CCN account does not have Brand workspace access.</p>
        </div>
      </main>
    );
  }
  if (!context.brandOnboardingComplete) redirect("/auth/onboarding/brand");
  const drafts = await listCreateChallengeDrafts({ ccnAccountId: context.ccnAccountId });
  const walletChip = await getBrandWalletChip(context.ccnAccountId);
  const submissionNotifications = await getBrandDashboardSubmissionNotifications(drafts);
  const viewModel = buildBrandDashboardViewModel(drafts, {
    brandDisplayName: context.brandName,
    submissionNotifications,
  });
  return <BrandDashboard user={{ displayName: context.displayName, brandName: context.brandName, email: context.email, creatorAccess: context.creatorAccess, avatarImageUrl: context.avatarImageUrl }} walletChip={walletChip} viewModel={viewModel} />;
}

async function getBrandWalletChip(ccnAccountId: string) {
  const wallet = await getScopedStoredWallet({
    ccnAccountId,
    role: "BRAND",
    purpose: "PAYMENT",
  });
  if (!wallet) return null;

  try {
    const balance = await readBrandUsdcBalance(wallet.walletAddress);
    return {
      walletAddress: wallet.walletAddress,
      walletAddressMasked: maskAddress(wallet.walletAddress),
      balanceLabel: balance.display,
      href: "/dashboard/wallet",
    };
  } catch {
    return {
      walletAddress: wallet.walletAddress,
      walletAddressMasked: maskAddress(wallet.walletAddress),
      balanceLabel: "Wallet balance unavailable",
      href: "/dashboard/wallet",
    };
  }
}

function maskAddress(value: string) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "Wallet unavailable";
}
