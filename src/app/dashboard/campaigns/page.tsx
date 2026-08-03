/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buildBrandDashboardViewModel } from "@/features/dashboard/brand-dashboard-view-model";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";
import { listCreateChallengeDrafts } from "@/services/create-challenge/create-challenge-store.server";
import type { BrandDashboardCampaignRow } from "@/features/dashboard/brand-dashboard-view-model";

export const metadata: Metadata = {
  title: "Campaigns | Creator Challenge Network",
  robots: { index: false, follow: false },
};

type BrandCampaignsPageProps = {
  searchParams?: Promise<{ filter?: string }>;
};

const campaignFilters = ["All", "Draft", "Funding", "Live", "Review", "Completed"] as const;

export default async function BrandCampaignsPage({ searchParams }: BrandCampaignsPageProps) {
  const context = await getAuthenticatedCcnContext({ workspace: "brand", allowTestContext: true });
  if (!context) redirect("/auth/sign-in");
  if (!context.brandAccess) redirect("/dashboard/creator");

  const params = await searchParams;
  const activeFilter = normalizeCampaignFilter(params?.filter);
  const drafts = await listCreateChallengeDrafts({ ccnAccountId: context.ccnAccountId });
  const viewModel = buildBrandDashboardViewModel(drafts, { campaignLimit: null });
  const visibleRows = filterCampaignRows(viewModel.campaignRows, activeFilter);

  return (
    <main className="min-h-screen bg-[#030711] px-5 py-6 text-white xl:px-9">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm font-semibold text-blue-300">Back to dashboard</Link>
            <h1 className="mt-4 text-3xl font-black tracking-tight">Campaigns</h1>
            <p className="mt-2 text-slate-400">All Brand campaigns from canonical workspace state.</p>
          </div>
          <Link href="/create-challenge?new=1" prefetch className="inline-flex h-11 items-center rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-5 text-sm font-black text-white">
            + New Challenge
          </Link>
        </div>

        <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex flex-wrap gap-2">
            {campaignFilters.map((filter) => (
              <Link
                key={filter}
                href={filter === "All" ? "/dashboard/campaigns" : `/dashboard/campaigns?filter=${filter.toLowerCase()}`}
                className={`rounded-lg border px-4 py-2 text-xs font-bold ${activeFilter === filter ? "border-violet-400/50 bg-violet-600 text-white" : "border-white/10 bg-slate-950/40 text-slate-300"}`}
              >
                {filter}
              </Link>
            ))}
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {visibleRows.length ? visibleRows.map((row) => (
              <CampaignCard key={row.draftId} row={row} />
            )) : (
              <div className="rounded-xl border border-dashed border-white/15 bg-slate-950/35 p-6 lg:col-span-2 2xl:col-span-3">
                <p className="text-lg font-black">No campaigns yet</p>
                <p className="mt-2 text-sm text-slate-400">Create a challenge to begin the Brand workflow.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function normalizeCampaignFilter(value?: string): typeof campaignFilters[number] {
  const match = campaignFilters.find((filter) => filter.toLowerCase() === value?.toLowerCase());
  return match ?? "All";
}

function filterCampaignRows(rows: BrandDashboardCampaignRow[], filter: typeof campaignFilters[number]) {
  if (filter === "All") return rows;
  if (filter === "Draft") return rows.filter((row) => row.status === "draft");
  if (filter === "Funding") return rows.filter((row) => row.status === "funding");
  if (filter === "Live") return rows.filter((row) => row.status === "review" || row.status === "ready-to-publish");
  if (filter === "Review") return rows.filter((row) => row.status === "review");
  if (filter === "Completed") return rows.filter((row) => row.status === "completed");
  return rows;
}

function CampaignCard({ row }: { row: BrandDashboardCampaignRow }) {
  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/35 transition hover:border-white/20">
      <div className={`relative aspect-[16/7] bg-gradient-to-br ${visualClass(row.visualTone)}`}>
        {row.media.imageUrl ? (
          <img src={row.media.imageUrl} alt={row.media.alt} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.18),transparent_24%),linear-gradient(120deg,rgba(255,255,255,0.1),transparent)]" />
        )}
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute bottom-4 left-4 grid h-12 w-12 place-items-center rounded-xl border border-white/15 bg-black/25 text-xl font-black">
          {row.identityToken}
        </div>
        <span className={`absolute right-4 top-4 rounded-md border px-2.5 py-1 text-[10px] font-black uppercase ${statusClass(row.statusTone)}`}>
          {row.statusLabel}
        </span>
      </div>
      <div className="p-5">
        <h2 className="truncate text-lg font-black">{row.title}</h2>
        <p className="mt-2 min-h-10 text-sm leading-5 text-slate-400">{row.metadataLine}</p>
        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Next action</p>
          <p className="mt-2 text-sm font-semibold text-white">{row.nextStep}</p>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500" style={{ width: `${row.progressPercent ?? 0}%` }} />
        </div>
        <Link href={row.href} className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg border border-violet-400/40 bg-violet-600/20 px-4 text-sm font-black text-white transition hover:bg-violet-600/35">
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
