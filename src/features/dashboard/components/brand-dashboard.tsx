/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CCNLogo } from "@/components/ui/ccn-logo";
import { AiTemplatesBetaButton, BrandAccountMenu, BrandNotifications } from "@/features/dashboard/components/brand-workspace-navigation";
import { resolveBrandDashboardGreetingName } from "@/features/dashboard/brand-dashboard-view-model";
import type {
  BrandDashboardCampaignRow,
  BrandDashboardJourneyStep,
  BrandDashboardViewModel,
} from "@/features/dashboard/brand-dashboard-view-model";

function statusClass(tone: BrandDashboardCampaignRow["statusTone"]) {
  if (tone === "green") return "border-emerald-400/30 bg-emerald-400/15 text-emerald-200";
  if (tone === "amber") return "border-amber-400/30 bg-amber-400/15 text-amber-200";
  if (tone === "violet") return "border-violet-400/30 bg-violet-400/15 text-violet-200";
  if (tone === "blue") return "border-blue-400/30 bg-blue-400/15 text-blue-200";
  return "border-slate-400/30 bg-slate-400/15 text-slate-200";
}

function visualClass(tone: BrandDashboardCampaignRow["visualTone"]) {
  if (tone === "red") return "from-red-600 via-rose-900 to-slate-950";
  if (tone === "amber") return "from-amber-600 via-orange-950 to-slate-950";
  if (tone === "blue") return "from-blue-600 via-cyan-950 to-slate-950";
  if (tone === "slate") return "from-slate-600 via-slate-900 to-slate-950";
  return "from-violet-600 via-indigo-950 to-slate-950";
}

function stepIcon(step: BrandDashboardJourneyStep, index: number) {
  if (step.status === "complete") return "OK";
  return String(index + 1);
}

function stepCaption(step: BrandDashboardJourneyStep) {
  if (step.status === "complete") return "Completed";
  if (step.status === "current" && step.id === "published") return "Open";
  if (step.status === "current") return "In Progress";
  return "Pending";
}

export function BrandDashboard({
  user,
  walletChip,
  viewModel,
}: {
  user: { displayName: string; email?: string; creatorAccess?: boolean; avatarImageUrl?: string | null };
  walletChip?: { walletAddressMasked: string; balanceLabel: string; href: string } | null;
  viewModel: BrandDashboardViewModel;
}) {
  const greetingName = resolveBrandDashboardGreetingName({
    brandName: viewModel.brandDisplayName,
    displayName: user.displayName,
  });
  const profileName = user.displayName?.trim() || "Brand Account";
  const greeting = greetingName ? `Welcome back, ${greetingName}.` : "Welcome back.";

  return (
    <main className="min-h-screen bg-[#030711] text-white">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[312px] border-r border-white/10 bg-[#050a14]/95 px-6 py-7 xl:flex xl:flex-col">
        <Link href="/" className="flex items-center gap-3">
          <CCNLogo size="lg" priority />
        </Link>

        <nav className="mt-12 space-y-2 text-base font-semibold" aria-label="Brand workspace navigation">
          {[
            ["Dashboard", "/dashboard", true, true],
            ["Business Challenges", "/dashboard/campaigns", false, true],
            ["Wallet", "/dashboard/wallet", false, true],
            ["Payments", "/dashboard/payments", false, true],
          ].map(([label, href, active, operational]) => (
            <Link
              key={String(label)}
              href={String(href)}
              className={`flex h-[52px] items-center gap-3 rounded-lg border px-4 ${
                active
                  ? "border-violet-500/50 bg-violet-600/25 text-white shadow-lg shadow-violet-950/20"
                  : operational
                    ? "border-transparent text-slate-200 transition hover:bg-white/[0.06]"
                    : "border-transparent text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300"
              }`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/15 text-xs">{String(label).slice(0, 1)}</span>
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-8 border-t border-white/10 pt-6">
          <p className="px-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Manage</p>
          <nav className="mt-4 space-y-2 text-base font-semibold" aria-label="Management navigation">
            <AiTemplatesBetaButton />
            {[["Settings", "/dashboard/settings"]].map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="flex h-12 items-center gap-3 rounded-lg px-4 text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
              >
                <span className="grid h-6 w-6 place-items-center rounded border border-white/15 text-[10px]">{label.slice(0, 1)}</span>
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-auto mb-4 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.05] p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100">Arc Testnet</p>
          <p className="mt-1 text-sm font-semibold text-white">Connected</p>
        </div>

        <BrandAccountMenu
          displayName={profileName}
          brandName={viewModel.brandDisplayName}
          email={user.email}
          workspaceLabel="Brand Workspace"
          creatorAccess={user.creatorAccess}
          avatarImageUrl={user.avatarImageUrl}
        />
      </aside>

      <section className="min-h-screen px-5 py-7 xl:ml-[312px] xl:px-10">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="text-[42px] font-black tracking-tight md:text-[52px]">{greeting}</h1>
            <p className="mt-4 text-xl text-slate-300">{viewModel.primaryMessage}</p>
          </div>
          <div className="flex items-center gap-4">
            <BrandNotifications notifications={viewModel.notifications} />
            <Link href={walletChip?.href ?? "/dashboard/wallet"} className="hidden rounded-xl border border-white/10 bg-white/[0.03] px-6 py-4 transition hover:border-blue-300/30 sm:block">
              <p className="flex items-center gap-2 text-sm text-slate-400">
                Wallet Balance
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
              </p>
              <p className="mt-1 text-2xl font-black">{walletChip?.balanceLabel ?? "Unavailable"}</p>
              <p className="mt-1 text-xs text-slate-400">on Arc Testnet {walletChip?.walletAddressMasked ? `- ${walletChip.walletAddressMasked}` : ""}</p>
            </Link>
          </div>
        </header>

        <div className="mt-8 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-6">
            <ActiveBusinessChallenge viewModel={viewModel} />
            <Journey steps={viewModel.journeySteps} />
            <CampaignRows rows={viewModel.campaignRows} />
          </div>
          <RightColumn viewModel={viewModel} />
        </div>
      </section>
    </main>
  );
}

function ActiveBusinessChallenge({ viewModel }: { viewModel: BrandDashboardViewModel }) {
  const campaign = viewModel.primaryCampaign;
  if (!campaign) {
    return (
      <section className="rounded-xl border border-white/10 bg-[#0c1020] p-7 shadow-2xl shadow-violet-950/10">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-200">Active Business Challenge</p>
        <h2 className="mt-5 text-3xl font-black tracking-tight md:text-4xl">What business problem are you trying to solve?</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Turn a real business challenge into globally sourced, actionable solutions.</p>
        <Link href="/create-challenge?new=1" prefetch className="mt-6 inline-flex h-12 items-center rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-7 text-sm font-black text-white shadow-lg shadow-violet-950/30">
          Describe Your Business Problem
        </Link>
      </section>
    );
  }

  const attentionLabel = campaign.solutionCount > 1
    ? "Solutions Ready for Evaluation"
    : campaign.solutionCount === 1
      ? "New Solution Received"
      : "Active Business Challenge";

  return (
    <section className="rounded-xl border border-white/10 bg-[#0c1020] p-7 shadow-2xl shadow-violet-950/10">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-200">{attentionLabel}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h2 className="max-w-4xl text-3xl font-black tracking-tight md:text-4xl">{campaign.title}</h2>
            <span className={`rounded-md border px-3 py-1.5 text-xs font-black uppercase ${statusClass(campaign.statusTone)}`}>{campaign.statusLabel}</span>
          </div>
        </div>
        <Link href="/create-challenge?new=1" prefetch className="inline-flex h-12 items-center rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-violet-950/30">
          + New Business Challenge
        </Link>
      </div>

      <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-xl border border-white/10 bg-slate-950/30 p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Business Problem</p>
          <p className={`mt-3 text-xl font-bold leading-8 ${campaign.hasBusinessProblem ? "text-white" : "text-slate-400"}`}>{campaign.businessProblem}</p>
          {(campaign.hasGoal || campaign.hasExpectedOutcome) ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {campaign.hasGoal ? <Metric label="Goal" value={campaign.goalLabel} /> : null}
              {campaign.hasExpectedOutcome ? <Metric label="Expected Outcome" value={campaign.expectedOutcomeLabel} /> : null}
            </div>
          ) : null}
          <Link href={campaign.href} className="mt-5 inline-flex text-base font-bold text-violet-200">
            View Full Brief -&gt;
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <MetricCard label="Reward" value={campaign.rewardLabel} detail={campaign.fundingStatusLabel} />
          <MetricCard label="Deadline" value={campaign.deadlineLabel} />
          <MetricCard label="Solutions" value={campaign.solutionsLabel} />
          <MetricCard label="Funding" value={campaign.fundingStatusLabel} />
        </div>
      </div>

      {campaign.briefIncomplete ? (
        <div className="mt-6 rounded-lg border border-amber-300/20 bg-amber-300/10 px-5 py-4">
          <p className="text-base font-black text-amber-100">Brief incomplete</p>
          <p className="mt-1 text-base leading-7 text-slate-300">Add problem summary, goal, expected outcome and deadline.</p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Required Action</p>
          <p className="mt-1 text-lg font-semibold text-white">{campaign.requiredActionDescription}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={viewModel.primaryAction.href} className="inline-flex h-11 items-center rounded-lg bg-violet-600 px-5 text-sm font-black text-white transition hover:bg-violet-500">
            {viewModel.primaryAction.label}
          </Link>
          <Link href={campaign.href} className="inline-flex h-11 items-center rounded-lg border border-white/10 px-5 text-sm font-black text-white transition hover:bg-white/[0.05]">
            View Full Brief
          </Link>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-2 text-lg font-bold leading-7 ${muted ? "text-slate-400" : "text-white"}`}>{value}</p>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black leading-7 text-white">{value}</p>
      {detail ? <p className="mt-1 text-base font-semibold text-emerald-300">{detail}</p> : null}
    </div>
  );
}

function Journey({ steps }: { steps: BrandDashboardJourneyStep[] }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.035] p-6">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-200">Solution Journey</p>
      <div className="mt-6 grid gap-5 md:grid-cols-6 md:gap-3">
        {steps.map((step, index) => (
          <div key={step.id} className="relative text-center">
            {index < steps.length - 1 ? (
              <span className="absolute left-[calc(50%+30px)] right-[calc(-50%+30px)] top-[24px] hidden h-px md:block" aria-hidden="true">
                <span className={`block h-full ${
                  step.status === "complete"
                    ? "bg-gradient-to-r from-emerald-300/70 to-emerald-300/25"
                    : step.status === "current"
                      ? "bg-gradient-to-r from-violet-300/80 to-white/15"
                      : "bg-white/10"
                }`} />
              </span>
            ) : null}
            <div className={`relative z-10 mx-auto grid h-12 w-12 place-items-center rounded-full border text-sm font-black ring-8 ring-[#090f1b] ${
              step.status === "current"
                ? "border-violet-200 bg-violet-600 text-white shadow-lg shadow-violet-700/35"
                : step.status === "complete"
                  ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                  : "border-white/10 bg-slate-900 text-slate-500"
            }`}>
              {stepIcon(step, index)}
            </div>
            <p className={`mt-3 text-base font-bold ${step.status === "future" ? "text-slate-400" : "text-white"}`}>{step.label}</p>
            <p className={`mt-1 text-base ${step.status === "current" ? "text-violet-200" : "text-slate-500"}`}>{stepCaption(step)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CampaignRows({ rows }: { rows: BrandDashboardCampaignRow[] }) {
  return (
    <section id="campaigns" className="scroll-mt-20 rounded-xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-violet-200">Your Business Challenges</h2>
        <Link href="/dashboard/campaigns" className="text-sm font-semibold text-violet-200">View all challenges -&gt;</Link>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {["All", "Problem Draft", "Funding", "Open for Solutions", "Evaluation", "Selection", "Completed", "Archived"].map((filter, index) => (
          <button
            key={filter}
            type="button"
            className={`h-10 rounded-lg border px-4 text-sm font-bold ${index === 0 ? "border-violet-400/50 bg-violet-600 text-white" : "border-white/10 bg-slate-950/40 text-slate-300"}`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[1120px]">
          <div className="grid grid-cols-[minmax(280px,1.15fr)_minmax(260px,1fr)_150px_140px_150px_160px_52px] gap-4 border-b border-white/10 px-3 pb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            <span>Challenge</span>
            <span>Problem</span>
            <span>Reward</span>
            <span>Solutions</span>
            <span>Deadline</span>
            <span>Status</span>
            <span />
          </div>
          <div className="divide-y divide-white/10">
            {rows.length ? rows.map((row) => (
              <article key={row.draftId} className="grid grid-cols-[minmax(280px,1.15fr)_minmax(260px,1fr)_150px_140px_150px_160px_52px] gap-4 px-4 py-5 text-base transition hover:bg-white/[0.025]">
                <div className="flex min-w-0 items-center gap-4">
                  <CampaignThumb row={row} />
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black text-white">{row.title}</h3>
                    <p className="mt-1 text-base text-slate-400">{row.updatedLabel}</p>
                  </div>
                </div>
                <p className={`self-center leading-7 ${row.hasBusinessProblem ? "text-slate-200" : "text-slate-400"}`}>{row.businessProblem}</p>
                <div className="self-center">
                  <p className="font-bold text-white">{row.rewardLabel}</p>
                  <p className="mt-1 text-base text-emerald-300">{row.fundingStatusLabel}</p>
                </div>
                <p className="self-center text-lg font-bold text-white">{row.solutionsLabel}</p>
                <p className="self-center text-slate-300">{row.deadlineLabel}</p>
                <div className="self-center">
                  <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-black ${statusClass(row.statusTone)}`}>{row.currentPhaseLabel}</span>
                </div>
                <Link href={row.href} aria-label={`Open ${row.title}`} className="self-center text-center text-xl font-black text-slate-400 transition hover:text-white">...</Link>
              </article>
            )) : (
              <div className="rounded-xl border border-white/10 bg-slate-950/35 p-6">
                <p className="text-lg font-black">What business problem are you trying to solve?</p>
                <p className="mt-2 max-w-2xl text-base leading-7 text-slate-300">Business Problem -&gt; Business Challenge -&gt; Solutions -&gt; Evaluation -&gt; Selection -&gt; Settlement.</p>
                <Link href="/create-challenge?new=1" prefetch className="mt-5 inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-5 text-sm font-black text-white">
                  Describe Your Business Problem
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function RightColumn({ viewModel }: { viewModel: BrandDashboardViewModel }) {
  return (
    <aside className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-violet-200">Today&apos;s Priorities</h2>
        <div className="mt-5 space-y-4">
          {viewModel.priorities.map((item) => (
            <Link key={`${item.label}-${item.detail}`} href={item.href} className="block rounded-lg border border-white/10 bg-slate-950/35 p-4 transition hover:border-violet-300/30">
              <span className="block text-lg font-black text-white">{item.label}</span>
              <span className="mt-2 block text-base leading-7 text-slate-300">{item.detail}</span>
              <span className="mt-4 inline-flex text-base font-bold text-violet-200">{item.ctaLabel} -&gt;</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-violet-200">Wallet Quick Actions</h2>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {viewModel.walletQuickActions.map((action) => (
            action.available && action.href ? (
              <Link key={action.label} href={action.href} className="rounded-lg border border-white/10 bg-slate-950/35 p-3 text-center transition hover:border-blue-300/30">
                <span className="block text-base font-black text-white">{action.label}</span>
                <span className="mt-2 block text-sm text-slate-400">{action.detail}</span>
              </Link>
            ) : (
              <div key={action.label} className="rounded-lg border border-white/10 bg-slate-950/35 p-3 text-center opacity-60">
                <span className="block text-base font-black text-white">{action.label}</span>
                <span className="mt-2 block text-sm text-slate-400">{action.detail}</span>
              </div>
            )
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-black uppercase tracking-[0.18em] text-violet-200">Recent Activity</h2>
          <Link href="/dashboard/campaigns" className="text-sm font-bold text-violet-200">View all</Link>
        </div>
        <div className="mt-5 space-y-5">
          {viewModel.recentActivity.length ? viewModel.recentActivity.map((item) => (
            <Link key={`${item.label}-${item.detail}`} href={item.href} className="flex gap-3">
              <span className={`mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black ${
                item.tone === "green"
                  ? "bg-emerald-500 text-slate-950"
                  : item.tone === "amber"
                    ? "bg-amber-500 text-slate-950"
                    : item.tone === "violet"
                      ? "bg-violet-600 text-white"
                      : "bg-blue-500 text-white"
              }`}>{item.label.slice(0, 1)}</span>
              <span>
                <span className="block text-base font-bold text-white">{item.label}</span>
                <span className="mt-2 block text-base leading-7 text-slate-300">{item.detail}</span>
                <span className="mt-1 block text-sm text-slate-400">{item.at}</span>
              </span>
            </Link>
          )) : (
            <p className="text-sm text-slate-400">No campaign activity yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-blue-400/30 bg-gradient-to-br from-[#0b1228] to-[#111833] p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-cyan-300 text-cyan-200">A</span>
          <div>
            <h2 className="text-2xl font-black">Arc</h2>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Programmable Money Hackathon</p>
          </div>
        </div>
        <p className="mt-5 text-lg font-semibold leading-7 text-slate-100">Built on Arc.</p>
        <p className="mt-2 text-base leading-7 text-slate-300">Powered by Circle and USDC for hosted wallet approvals, escrow funding and creator settlement.</p>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Arc Testnet - Connected</p>
        <Link href="/dashboard/about-arc" className="mt-5 inline-flex rounded-lg border border-blue-400/30 px-4 py-3 text-sm font-semibold text-blue-200">
          Learn about Arc -&gt;
        </Link>
      </section>
    </aside>
  );
}

function CampaignThumb({ row }: { row: BrandDashboardCampaignRow }) {
  return (
    <div className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br ${visualClass(row.visualTone)}`} aria-hidden="true">
      {row.media.imageUrl ? (
        <img src={row.media.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(120deg,rgba(255,255,255,0.08),transparent)] text-lg font-black text-white">
          {row.identityToken}
        </div>
      )}
    </div>
  );
}
