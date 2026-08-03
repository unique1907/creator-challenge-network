import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buildBrandDashboardViewModel } from "@/features/dashboard/brand-dashboard-view-model";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";
import { listCreateChallengeDrafts } from "@/services/create-challenge/create-challenge-store.server";

export const metadata: Metadata = {
  title: "Payments | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export default async function BrandPaymentsPage() {
  const context = await getAuthenticatedCcnContext({ workspace: "brand", allowTestContext: true });
  if (!context) redirect("/auth/sign-in");
  if (!context.brandAccess) redirect("/dashboard/creator");

  const drafts = await listCreateChallengeDrafts({ ccnAccountId: context.ccnAccountId });
  const viewModel = buildBrandDashboardViewModel(drafts);

  return (
    <main className="min-h-screen bg-[#030711] px-5 py-6 text-white xl:px-9">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard" className="text-sm font-semibold text-blue-300">Back to dashboard</Link>
        <h1 className="mt-4 text-3xl font-black tracking-tight">Payments</h1>
        <p className="mt-2 max-w-3xl text-slate-400">
          Campaign funding and creator payouts are managed inside each Campaign Workspace. This page points to real campaign records instead of fabricating a wallet ledger.
        </p>
        <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.035] p-5">
          <div className="space-y-3">
            {viewModel.campaignRows.length ? viewModel.campaignRows.map((row) => (
              <Link key={row.draftId} href={row.href} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/35 p-4 transition hover:border-white/20">
                <span>
                  <span className="block text-sm font-black text-white">{row.title}</span>
                  <span className="mt-1 block text-xs text-slate-400">{row.lifecycleContext}</span>
                </span>
                <span className="text-sm font-semibold text-blue-300">Open payment evidence -&gt;</span>
              </Link>
            )) : (
              <p className="text-sm text-slate-400">No campaign payment records are available yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
