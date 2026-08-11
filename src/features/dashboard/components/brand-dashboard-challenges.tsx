"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BusinessChallengeCover } from "@/components/ui/business-challenge-cover";
import {
  brandDashboardFilterMatches,
  brandDashboardFilters,
  type BrandDashboardFilter,
} from "@/features/dashboard/brand-dashboard-filters";
import type {
  BrandDashboardCampaignRow,
  BrandDashboardViewModel,
} from "@/features/dashboard/brand-dashboard-view-model";

function statusClass(tone: BrandDashboardCampaignRow["statusTone"]) {
  if (tone === "green") return "border-emerald-400/30 bg-emerald-400/12 text-emerald-200";
  if (tone === "amber") return "border-amber-400/30 bg-amber-400/12 text-amber-200";
  if (tone === "violet") return "border-violet-400/35 bg-violet-500/15 text-violet-100";
  if (tone === "blue") return "border-blue-400/30 bg-blue-400/12 text-blue-200";
  return "border-slate-400/25 bg-slate-400/10 text-slate-200";
}

function visualClass(tone: BrandDashboardCampaignRow["visualTone"]) {
  if (tone === "red") return "from-red-600 via-rose-900 to-slate-950";
  if (tone === "amber") return "from-amber-600 via-orange-950 to-slate-950";
  if (tone === "blue") return "from-blue-600 via-cyan-950 to-slate-950";
  if (tone === "slate") return "from-slate-600 via-slate-900 to-slate-950";
  return "from-violet-600 via-indigo-950 to-slate-950";
}

function actionLabelForRow(row: BrandDashboardCampaignRow) {
  switch (row.status) {
    case "draft":
      return "Continue Draft";
    case "funding":
      return "Complete Funding";
    case "ready-to-publish":
      return "View Challenge";
    case "review":
      return "Review Solutions";
    case "winner-ready":
      return "Finalize Selection";
    case "settlement":
      return "Approve Payout";
    case "completed":
      return "View Outcome";
    default:
      return row.actionLabel;
  }
}

function rowMetric(row: BrandDashboardCampaignRow) {
  if (row.status === "draft") return { label: "Progress", value: row.progressLabel ?? "Draft", detail: row.nextStep };
  if (row.status === "funding") return { label: "Funding", value: row.fundingStatusLabel, detail: row.requiredActionDescription };
  if (row.status === "review") return { label: "Winners", value: row.rewardLabel, detail: row.requiredActionDescription };
  if (row.status === "winner-ready") return { label: "Selection", value: row.solutionsLabel, detail: row.requiredActionDescription };
  if (row.status === "settlement") return { label: "Payout", value: row.rewardLabel, detail: row.requiredActionDescription };
  if (row.status === "completed") return { label: "Outcome", value: "Completed", detail: row.fundingStatusLabel };
  return { label: "State", value: row.currentPhaseLabel, detail: row.requiredActionDescription };
}

function compactDeadline(row: BrandDashboardCampaignRow) {
  if (row.status === "completed") return "Completed";
  return row.deadlineLabel === "-" || row.deadlineLabel === "--" ? "Deadline pending" : row.deadlineLabel;
}

function emptyStateForFilter(filter: BrandDashboardFilter, primaryAction: BrandDashboardViewModel["primaryAction"]) {
  if (filter === "Drafts") {
    return {
      title: "No draft business challenges",
      detail: "Start a new business challenge when you have a business problem to define.",
      cta: { label: "New Business Challenge", href: "/create-challenge?new=1" },
    };
  }
  if (filter === "Active") {
    return {
      title: "No active business challenges",
      detail: "No live challenges are currently open for creator solutions.",
      cta: { label: "New Business Challenge", href: "/create-challenge?new=1" },
    };
  }
  if (filter === "Needs Action") {
    return {
      title: "No action required right now",
      detail: "Evaluation, selection, and settlement actions will appear here when they are ready.",
      cta: null,
    };
  }
  if (filter === "Completed") {
    return {
      title: "No completed outcomes yet",
      detail: "Completed challenges will appear here after successful settlement.",
      cta: null,
    };
  }
  return {
    title: "No business challenges yet",
    detail: "Start from the next available workspace action.",
    cta: { label: primaryAction.label, href: primaryAction.href },
  };
}

export function BrandDashboardChallengeList({
  rows,
  filterRows,
  totalRows,
  primaryAction,
}: {
  rows: BrandDashboardCampaignRow[];
  filterRows?: BrandDashboardCampaignRow[];
  totalRows: number;
  primaryAction: BrandDashboardViewModel["primaryAction"];
}) {
  const [activeFilter, setActiveFilter] = useState<BrandDashboardFilter>("All");
  const filteredRows = useMemo(() => {
    const sourceRows = activeFilter === "All" ? rows : filterRows ?? rows;
    return sourceRows.filter((row) => brandDashboardFilterMatches(row, activeFilter));
  }, [activeFilter, filterRows, rows]);

  return (
    <section className="rounded-xl border border-slate-700/75 bg-[#0b1220] p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold text-white">Business Challenges</h2>
          <p className="mt-0.5 text-[11px] text-slate-300">{totalRows} Business Challenges</p>
        </div>
        <Link href="/dashboard/campaigns" className="text-[11px] font-semibold text-violet-200 transition hover:text-violet-100">
          View all business challenges -&gt;
        </Link>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Filter business challenges by lifecycle">
        {brandDashboardFilters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={`h-6 rounded-md border px-2 text-[10px] font-semibold transition ${
              activeFilter === filter
                ? "border-violet-400 bg-violet-600 text-white"
                : "border-slate-700/70 bg-[#0d1524] text-slate-300 hover:border-slate-500/80 hover:text-white"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {filteredRows.length ? (
        <div className="mt-2 divide-y divide-slate-700/65 overflow-hidden rounded-lg border border-slate-700/75">
          {filteredRows.map((row) => (
            <ChallengeRow key={row.draftId} row={row} />
          ))}
        </div>
      ) : (
        <div className="mt-2 rounded-lg border border-slate-700/70 bg-[#0d1524] p-3">
          {(() => {
            const empty = emptyStateForFilter(activeFilter, primaryAction);
            return (
              <>
                <p className="text-[13px] font-semibold text-white">{empty.title}</p>
                <p className="mt-0.5 text-[12px] leading-4 text-slate-300">{empty.detail}</p>
                {empty.cta ? (
                  <Link href={empty.cta.href} className="mt-2.5 inline-flex h-7 items-center rounded-md bg-violet-600 px-2.5 text-[11px] font-semibold text-white">
                    {empty.cta.label}
                  </Link>
                ) : null}
              </>
            );
          })()}
        </div>
      )}
    </section>
  );
}

function ChallengeRow({ row }: { row: BrandDashboardCampaignRow }) {
  const metric = rowMetric(row);

  return (
    <article className="grid gap-2 bg-[#0d1524] px-2.5 py-1.5 text-[11px] transition hover:bg-[#111b2d] md:min-h-[50px] md:grid-cols-[36px_minmax(170px,1.2fr)_minmax(140px,0.9fr)_minmax(105px,0.7fr)_94px_112px] md:items-center">
      <ChallengeThumb row={row} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[11px] font-semibold text-white">{row.title}</h3>
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${statusClass(row.statusTone)}`}>
            {row.currentPhaseLabel}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[10px] text-slate-400">{row.updatedLabel}</p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">{metric.label}</p>
        <p className="mt-0.5 truncate font-medium text-slate-100">{metric.value}</p>
        <p className="mt-0.5 truncate text-[10px] text-slate-400">{metric.detail}</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">Solutions</p>
        <p className="mt-0.5 font-semibold text-white">{row.solutionsLabel}</p>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">Deadline</p>
        <p className="mt-0.5 font-medium text-slate-200">{compactDeadline(row)}</p>
      </div>
      <Link
        href={row.href}
        className="inline-flex h-7 items-center justify-center rounded-md border border-violet-400/35 bg-violet-600/15 px-2 text-[10px] font-semibold text-white transition hover:bg-violet-600/25"
      >
        {actionLabelForRow(row)}
      </Link>
    </article>
  );
}

function ChallengeThumb({ row }: { row: BrandDashboardCampaignRow }) {
  return (
    <div className={`h-8 w-8 overflow-hidden rounded-md bg-gradient-to-br ${visualClass(row.visualTone)}`} aria-hidden="true">
      {row.media.imageUrl ? (
        <BusinessChallengeCover
          src={row.media.imageUrl}
          alt={row.media.alt}
          title={row.title}
          decorative
          className="h-full w-full border-0"
          imageClassName="p-0.5"
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(120deg,rgba(255,255,255,0.08),transparent)] text-sm font-semibold text-white">
          {row.identityToken}
        </div>
      )}
    </div>
  );
}
