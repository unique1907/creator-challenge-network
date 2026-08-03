import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandOnboardingForm } from "@/features/auth/components/brand-onboarding/brand-onboarding-form";
import { resolveOrCreateCcnAccount } from "@/services/creator-foundation/creator-foundation.server";
import { createSupabaseServerClient } from "@/services/supabase/server";

export const metadata: Metadata = {
  title: "Brand onboarding | Creator Challenge Network",
  robots: { index: false, follow: false },
};

function onboardingComplete(account: {
  is_brand: boolean;
  display_name?: string | null;
  brand_name?: string | null;
  brand_onboarding_completed_at?: string | null;
}) {
  return Boolean(
    account.is_brand &&
      account.display_name?.trim() &&
      account.brand_name?.trim() &&
      account.brand_onboarding_completed_at,
  );
}

export default async function BrandOnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/auth/sign-in");

  const account = await resolveOrCreateCcnAccount(data.user);
  if (onboardingComplete(account)) redirect("/dashboard");
  if (account.is_creator && !account.is_brand) {
    return (
      <main className="min-h-screen bg-[#050916] px-6 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#0c1222] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Brand onboarding</p>
          <h1 className="mt-3 text-3xl font-semibold">Brand access is not available</h1>
          <p className="mt-3 text-slate-300">This account is registered as a Creator. Brand accounts must use a separate sign-in.</p>
          <Link href="/dashboard/creator" className="mt-6 inline-flex rounded-md bg-blue-600 px-5 py-3 text-sm font-bold text-white">
            Return to Creator Workspace
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050916] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#0c1222] p-8 shadow-2xl shadow-black/40">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Brand onboarding</p>
        <h1 className="mt-3 text-3xl font-semibold">Set up your Brand workspace</h1>
        <p className="mt-3 text-slate-300">
          Add the minimum profile details CCN needs to personalize your Brand workspace.
        </p>
        <BrandOnboardingForm
          initialDisplayName={account.display_name ?? ""}
          initialBrandName={account.brand_name ?? ""}
          email={data.user.email}
        />
      </div>
    </main>
  );
}
