import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandCompanyForm } from "@/features/dashboard/components/brand-identity-forms";
import { buildBrandDashboardViewModel } from "@/features/dashboard/brand-dashboard-view-model";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";
import { listCreateChallengeDrafts } from "@/services/create-challenge/create-challenge-store.server";
import { createSupabaseAdminClient } from "@/services/supabase/admin.server";
import { resolveAccountImageUrl } from "@/services/media/brand-media.server";

export const metadata: Metadata = {
  title: "Company Settings | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export default async function CompanySettingsPage() {
  const context = await getAuthenticatedCcnContext({ workspace: "brand", allowTestContext: true });
  if (!context) redirect("/auth/sign-in");
  if (!context.brandAccess) redirect("/dashboard/creator");

  const drafts = await listCreateChallengeDrafts({ ccnAccountId: context.ccnAccountId });
  const account = await getCompanySnapshot(context.authUserId);
  const brandName = account?.brand_name ?? context.brandName ?? buildBrandDashboardViewModel(drafts).brandDisplayName ?? "Brand name not set";

  return (
    <main className="min-h-screen bg-[#030711] px-5 py-6 text-white xl:px-9">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-sm font-semibold text-blue-300">Back to dashboard</Link>
        <h1 className="mt-4 text-3xl font-black tracking-tight">Company settings</h1>
        <p className="mt-2 text-slate-400">Organization identity used for workspace context and creator-facing Brand attribution.</p>
        <BrandCompanyForm
          initial={{
            brandName,
            websiteUrl: account?.website_url ?? "",
            companyDescription: account?.company_description ?? "",
            linkedinUrl: account?.linkedin_url ?? "",
            instagramUrl: account?.instagram_url ?? "",
            xUrl: account?.x_url ?? "",
          }}
          logo={{
            imageKey: account?.brand_logo_image_key ?? null,
            imageUrl: resolveAccountImageUrl(account?.brand_logo_image_key),
          }}
        />
      </div>
    </main>
  );
}

async function getCompanySnapshot(authUserId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("accounts")
    .select("brand_name,brand_logo_image_key,website_url,company_description,linkedin_url,instagram_url,x_url")
    .eq("supabase_user_id", authUserId)
    .maybeSingle();
  return data as {
    brand_name: string | null;
    brand_logo_image_key: string | null;
    website_url: string | null;
    company_description: string | null;
    linkedin_url: string | null;
    instagram_url: string | null;
    x_url: string | null;
  } | null;
}
