import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BusinessChallengeCover } from "@/components/ui/business-challenge-cover";
import {
  brandDashboardFilterMatches,
  brandDashboardFilters,
  filterSlug,
  normalizeBrandDashboardFilter,
  type BrandDashboardFilter,
} from "@/features/dashboard/brand-dashboard-filters";
import { buildBrandDashboardViewModel } from "@/features/dashboard/brand-dashboard-view-model";
import { BrandAccountControls } from "@/features/dashboard/components/brand-workspace-navigation";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";
import { listCreateChallengeDrafts } from "@/services/create-challenge/create-challenge-store.server";
import { getBrandDashboardSubmissionNotifications } from "@/features/dashboard/brand-dashboard-data.server";
import type { BrandDashboardCampaignRow } from "@/features/dashboard/brand-dashboard-view-model";

export const metadata: Metadata = {
  title: "Business Challenges | Creator Challenge Network",
  robots: { index: false, follow: false },
};

type BrandCampaignsPageProps = {
  searchParams?: Promise<{ filter?: string }>;
};

export default async function BrandCampaignsPage({ searchParams }: BrandCampaignsPageProps) {
  const context = await getAuthenticatedCcnContext({ workspace: "brand", allowTestContext: true });
  if (!context) redirect("/auth/sign-in");
  if (!context.brandAccess) redirect("/dashboard/creator");

  const params = await searchParams;
  const activeFilter = normalizeBrandDashboardFilter(params?.filter);
  const drafts = await listCreateChallengeDrafts({ ccnAccountId: context.ccnAccountId });
  const submissionNotifications = await getBrandDashboardSubmissionNotifications(drafts);
  const viewModel = buildBrandDashboardViewModel(drafts, { campaignLimit: null, submissionNotifications });
  const visibleRows = filterCampaignRows(viewModel.campaignRows, activeFilter);
  const profileName = context.displayName?.trim() || "Brand Account";

  return (
    <main className="min-h-screen bg-[#0F1117] px-3 py-4 text-white sm:px-5 xl:px-7">
      <div className="mx-auto max-w-[1520px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Your Business Challenges</h1>
            <p className="mt-1 text-[13px] text-slate-400">Manage and review your business challenges.</p>
          </div>
          <div className="flex flex-wrap items-start justify-end gap-3">
            <div className="flex flex-col items-start gap-1.5">
              <Link href="/create-challenge?new=1" prefetch className="inline-flex h-8 items-center rounded-md bg-violet-600 px-3 text-[12px] font-semibold text-white shadow-sm shadow-violet-950/30 transition hover:bg-violet-500">
                + New Business Challenge
              </Link>
              <Link href="/dashboard" className="text-[12px] font-medium text-slate-400 transition hover:text-slate-200">Back to dashboard</Link>
            </div>
            <BrandAccountControls
              displayName={profileName}
              brandName={context.brandName}
              email={context.email}
              workspaceLabel="Brand Workspace"
              creatorAccess={context.creatorAccess}
              avatarImageUrl={context.avatarImageUrl}
              notifications={viewModel.notifications}
            />
          </div>
        </div>

        <section className="mt-4">
          <div className="inline-flex flex-wrap gap-1 rounded-lg bg-[#171B24] p-1 shadow-sm ring-1 ring-white/[0.06]">
            {brandDashboardFilters.map((filter) => (
              <Link
                key={filter}
                href={filter === "All" ? "/dashboard/campaigns" : `/dashboard/campaigns?filter=${filterSlug(filter)}`}
                className={`inline-flex h-7 items-center rounded-md px-2.5 text-[11px] font-medium transition ${activeFilter === filter ? "bg-violet-600/85 text-white shadow-sm" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"}`}
              >
                {filter}
              </Link>
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {visibleRows.length ? visibleRows.map((row) => (
              <CampaignCard key={row.draftId} row={row} />
            )) : (
              <div className="rounded-xl bg-[#171B24] p-5 ring-1 ring-white/[0.06] md:col-span-2 xl:col-span-4">
                <p className="text-base font-semibold">No business challenges yet</p>
                <p className="mt-1 text-[13px] text-slate-400">Describe a business problem to begin the Brand workflow.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function filterCampaignRows(rows: BrandDashboardCampaignRow[], filter: BrandDashboardFilter) {
  return rows.filter((row) => brandDashboardFilterMatches(row, filter));
}

function CampaignCard({ row }: { row: BrandDashboardCampaignRow }) {
  return (
    <article className="flex h-full min-h-[310px] flex-col overflow-hidden rounded-xl bg-[#171B24] shadow-sm shadow-black/20 ring-1 ring-white/[0.055] transition hover:bg-[#1B202B] hover:ring-white/[0.09]">
      <div className="relative aspect-video bg-[#111722]">
        {row.media.imageUrl ? (
          <BusinessChallengeCover
            src={row.media.imageUrl}
            alt={row.media.alt}
            title={row.title}
            className="absolute inset-0 h-full w-full border-0 bg-[#111722]"
            imageClassName="p-3"
          />
        ) : (
          <BusinessChallengeCover
            src={null}
            alt={row.media.alt}
            title={row.title}
            className="absolute inset-0 h-full w-full border-0 bg-[#111722]"
          />
        )}
        <div className="absolute bottom-2 left-2 grid h-7 w-7 place-items-center rounded-md bg-black/30 text-[11px] font-semibold text-white ring-1 ring-white/10 backdrop-blur">
          {row.identityToken}
        </div>
        <span className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4 backdrop-blur ${statusClass(row.statusTone)}`}>
          {row.statusLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h2 className="line-clamp-2 min-h-10 text-[14px] font-semibold leading-5 text-slate-50">{row.title}</h2>
        <p className="mt-1 line-clamp-2 min-h-9 text-[12px] leading-[18px] text-slate-400">{row.businessProblem}</p>
        <div className="mt-3 flex items-start gap-2 border-t border-white/[0.06] pt-2.5">
          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400/80" />
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">Next action</p>
            <p className="mt-0.5 line-clamp-1 text-[12px] font-medium text-slate-200">{row.requiredActionLabel}</p>
          </div>
        </div>
        <div className="mt-auto pt-3">
          <div className="h-1 overflow-hidden rounded-full bg-slate-700/70">
            <div className="h-full rounded-full bg-violet-400/75" style={{ width: `${row.progressPercent ?? 0}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] leading-4 text-slate-400">
            <span className="truncate">{row.rewardLabel}</span>
            <span className="truncate text-center">{row.solutionsLabel}</span>
            <span className="truncate text-right">{row.deadlineLabel}</span>
          </div>
          <Link href={row.href} className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md bg-white/[0.055] px-2 text-[12px] font-semibold text-slate-100 ring-1 ring-white/[0.08] transition hover:bg-white/[0.09] hover:text-white">
            {row.actionLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}

function statusClass(tone: BrandDashboardCampaignRow["statusTone"]) {
  if (tone === "green") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-200";
  if (tone === "amber") return "border-amber-300/25 bg-amber-300/10 text-amber-200";
  if (tone === "violet") return "border-violet-300/25 bg-violet-300/10 text-violet-200";
  if (tone === "blue") return "border-blue-300/25 bg-blue-300/10 text-blue-200";
  return "border-slate-300/20 bg-slate-300/10 text-slate-200";
}
