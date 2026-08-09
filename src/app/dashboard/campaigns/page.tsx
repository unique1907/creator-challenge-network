/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
    <main className="min-h-screen bg-[#030711] px-3 py-3 text-white xl:px-5">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-black tracking-tight">Your Business Challenges</h1>
            <p className="mt-1 text-[12px] text-slate-400">All Brand Business Challenges.</p>
          </div>
          <div className="flex flex-wrap items-start justify-end gap-3">
            <div className="flex flex-col items-start gap-1.5">
              <Link href="/create-challenge?new=1" prefetch className="inline-flex h-8 items-center rounded-md bg-gradient-to-r from-violet-600 to-blue-600 px-3 text-[12px] font-black text-white">
                + New Business Challenge
              </Link>
              <Link href="/dashboard" className="text-[12px] font-semibold text-violet-200 transition hover:text-violet-100">← Back to dashboard</Link>
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

        <section className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {brandDashboardFilters.map((filter) => (
              <Link
                key={filter}
                href={filter === "All" ? "/dashboard/campaigns" : `/dashboard/campaigns?filter=${filterSlug(filter)}`}
                className={`inline-flex h-6 items-center rounded-md border px-2 text-[10px] font-semibold transition ${activeFilter === filter ? "border-violet-400 bg-violet-600 text-white" : "border-white/10 bg-slate-950/30 text-slate-300 hover:border-white/20 hover:text-white"}`}
              >
                {filter}
              </Link>
            ))}
          </div>
          <div className="mt-2.5 grid gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
            {visibleRows.length ? visibleRows.map((row) => (
              <CampaignCard key={row.draftId} row={row} />
            )) : (
              <div className="rounded-xl border border-dashed border-white/15 bg-slate-950/35 p-3 lg:col-span-2 2xl:col-span-3">
                <p className="text-base font-black">No business challenges yet</p>
                <p className="mt-1 text-[12px] text-slate-400">Describe a business problem to begin the Brand workflow.</p>
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
    <article className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/35 transition hover:border-white/20">
      <div className={`relative aspect-[16/5] max-h-[120px] bg-gradient-to-br ${visualClass(row.visualTone)}`}>
        {row.media.imageUrl ? (
          <img src={row.media.imageUrl} alt={row.media.alt} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.18),transparent_24%),linear-gradient(120deg,rgba(255,255,255,0.1),transparent)]" />
        )}
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute bottom-2 left-2 grid h-8 w-8 place-items-center rounded-md border border-white/15 bg-black/25 text-sm font-black">
          {row.identityToken}
        </div>
        <span className={`absolute right-2 top-2 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${statusClass(row.statusTone)}`}>
          {row.statusLabel}
        </span>
      </div>
      <div className="p-2.5">
        <h2 className="truncate text-[13px] font-black">{row.title}</h2>
        <p className="mt-1 line-clamp-2 min-h-0 text-[11px] leading-4 text-slate-400">{row.businessProblem}</p>
        <div className="mt-2 rounded-md border border-white/10 bg-white/[0.03] p-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Next action</p>
          <p className="mt-1 text-[12px] font-semibold text-white">{row.requiredActionLabel}</p>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px] text-slate-400">
          <span>{row.rewardLabel}</span>
          <span>{row.solutionsLabel}</span>
          <span>{row.deadlineLabel}</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500" style={{ width: `${row.progressPercent ?? 0}%` }} />
        </div>
        <Link href={row.href} className="mt-2.5 inline-flex h-7 w-full items-center justify-center rounded-md border border-violet-400/40 bg-violet-600/20 px-2.5 text-[11px] font-black text-white transition hover:bg-violet-600/35">
          {row.actionLabel} -&gt;
        </Link>
      </div>
    </article>
  );
}

function visualClass(tone: BrandDashboardCampaignRow["visualTone"]) {
  if (tone === "red") return "from-red-600 via-rose-900 to-slate-950";
  if (tone === "amber") return "from-amber-600 via-orange-950 to-slate-950";
  if (tone === "blue") return "from-blue-600 via-cyan-950 to-slate-950";
  if (tone === "slate") return "from-slate-600 via-slate-900 to-slate-950";
  return "from-violet-600 via-indigo-950 to-slate-950";
}

function statusClass(tone: BrandDashboardCampaignRow["statusTone"]) {
  if (tone === "green") return "border-emerald-400/30 bg-emerald-400/15 text-emerald-200";
  if (tone === "amber") return "border-amber-400/30 bg-amber-400/15 text-amber-200";
  if (tone === "violet") return "border-violet-400/30 bg-violet-400/15 text-violet-200";
  if (tone === "blue") return "border-blue-400/30 bg-blue-400/15 text-blue-200";
  return "border-slate-400/30 bg-slate-400/15 text-slate-200";
}
