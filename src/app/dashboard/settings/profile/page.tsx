import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormLabel } from "@/components/ui/form-label";
import { BrandProfileForm } from "@/features/dashboard/components/brand-identity-forms";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";
import { getScopedStoredWallet } from "@/services/circle/wallet-spike-store.server";
import { readBrandUsdcBalance } from "@/services/create-challenge/brand-payment-account.server";
import { resolveAccountImageUrl } from "@/services/media/brand-media.server";

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
  const account = await getAccountSnapshot(context.authUserId);

  return (
    <main className="min-h-screen bg-[#030711] px-5 py-6 text-white xl:px-9">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-sm font-semibold text-blue-300">Back to dashboard</Link>
        <h1 className="mt-4 text-3xl font-black tracking-tight">Brand profile</h1>
        <p className="mt-2 text-slate-400">Personal operator identity for the authenticated Brand Workspace.</p>
        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            <FormLabel readOnly className="text-xs text-slate-400">Company / Brand name</FormLabel>
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-100">{context.brandName ?? "Brand name not set"}</p>
          <p className="mt-1 text-xs text-slate-500">Company identity is edited in Company settings.</p>
        </div>
        <BrandProfileForm
          initialDisplayName={context.displayName || "Brand Account"}
          email={context.email ?? "Unavailable"}
          avatar={{
            imageKey: account?.avatar_image_key ?? null,
            imageUrl: resolveAccountImageUrl(account?.avatar_image_key),
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

async function getAccountSnapshot(authUserId: string) {
  const { createSupabaseAdminClient } = await import("@/services/supabase/admin.server");
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("accounts")
    .select("avatar_image_key")
    .eq("supabase_user_id", authUserId)
    .maybeSingle();
  return data as { avatar_image_key: string | null } | null;
}
