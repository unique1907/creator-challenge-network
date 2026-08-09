import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBrandAccountControlData } from "@/features/dashboard/brand-account-controls.server";
import { BrandCompanyForm } from "@/features/dashboard/components/brand-identity-forms";
import { BrandAccountControls } from "@/features/dashboard/components/brand-workspace-navigation";
import { normalizeBrandCompanyName } from "@/services/auth/brand-identity.server";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";
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

  const account = await getCompanySnapshot(context.authUserId);
  const brandName = normalizeBrandCompanyName(account?.brand_name) ?? context.brandName ?? "";
  const accountControls = await getBrandAccountControlData(context);

  return (
    <main className="min-h-screen bg-[#030711] px-3 py-3 text-white xl:px-5">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/dashboard" className="text-[12px] font-semibold text-blue-300">Back to dashboard</Link>
            <h1 className="mt-1.5 text-lg font-semibold leading-[1.12] tracking-normal md:text-xl">Company settings</h1>
            <p className="mt-1 text-[12px] text-slate-400">Organization identity used for workspace context and creator-facing Brand attribution.</p>
          </div>
          <BrandAccountControls {...accountControls} />
        </header>
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
