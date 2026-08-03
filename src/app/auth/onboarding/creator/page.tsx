import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreatorPayoutWalletSetup } from "@/features/creator-workspace/components/creator-actions";
import { resolveOrCreateCcnAccount } from "@/services/creator-foundation/creator-foundation.server";
import { createSupabaseServerClient } from "@/services/supabase/server";

export const metadata: Metadata = {
  title: "Creator onboarding | Creator Challenge Network",
  robots: { index: false, follow: false },
};

type CreatorOnboardingPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

function safeCreatorReturnPath(value?: string) {
  if (!value || !value.startsWith("/dashboard/creator") || value.startsWith("//")) return "/dashboard/creator";
  return value;
}

export default async function CreatorOnboardingPage({ searchParams }: CreatorOnboardingPageProps) {
  const params = await searchParams;
  const returnTo = safeCreatorReturnPath(params?.next);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect(`/auth/sign-in?role=creator&next=${encodeURIComponent(returnTo)}`);

  const account = await resolveOrCreateCcnAccount(data.user);
  if (account.is_brand && !account.is_creator) {
    return (
      <main className="min-h-screen bg-[#050916] px-6 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#0c1222] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Creator onboarding</p>
          <h1 className="mt-3 text-3xl font-semibold">Creator access is not available</h1>
          <p className="mt-3 text-slate-300">This account is registered as a Brand. Creator accounts must use a separate sign-in.</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-md bg-blue-600 px-5 py-3 text-sm font-bold text-white">
            Return to Brand Workspace
          </Link>
        </div>
      </main>
    );
  }
  if (account.is_creator && !account.is_brand) redirect(returnTo);

  return (
    <main className="min-h-screen bg-[#050916] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#0c1222] p-8 shadow-2xl shadow-black/40">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Creator onboarding</p>
        <h1 className="mt-3 text-3xl font-semibold">Set up your Creator workspace</h1>
        <p className="mt-3 text-slate-300">
          Activate your Creator payout wallet with the approved Circle Hosted Wallet flow before submitting work.
        </p>
        <div className="mt-7">
          <CreatorPayoutWalletSetup appId={process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? ""} available={false} returnTo={returnTo} />
        </div>
        <p className="mt-5 text-sm text-slate-400">
          This setup never accepts a payout address from the browser and does not start funding, payout, or settlement.
        </p>
      </div>
    </main>
  );
}
