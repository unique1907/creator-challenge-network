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

function stepIcon(step: BrandDashboardJourneyStep) {
  if (step.status === "complete") return "OK";
  if (step.id === "draft") return "D";
  if (step.id === "funding") return "$";
  if (step.id === "published") return "P";
  if (step.id === "review") return "R";
  if (step.id === "winner") return "W";
  return "S";
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
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[268px] border-r border-white/10 bg-[#050a14]/95 px-5 py-6 xl:flex xl:flex-col">
        <Link href="/" className="flex items-center gap-3">
          <CCNLogo size="lg" priority />
        </Link>

        <nav className="mt-12 space-y-2 text-sm font-semibold" aria-label="Brand workspace navigation">
          {[
            ["Dashboard", "/dashboard", true, true],
            ["Campaigns", "/dashboard/campaigns", false, true],
            ["Wallet", "/dashboard/wallet", false, true],
            ["Payments", "/dashboard/payments", false, true],
          ].map(([label, href, active, operational]) => (
            <Link
              key={String(label)}
              href={String(href)}
              className={`flex h-12 items-center gap-3 rounded-lg border px-4 ${
                active
                  ? "border-violet-500/50 bg-violet-600/25 text-white shadow-lg shadow-violet-950/20"
                  : operational
                    ? "border-transparent text-slate-200 transition hover:bg-white/[0.06]"
                    : "border-transparent text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300"
              }`}
            >
              <span className="grid h-6 w-6 place-items-center rounded-md border border-white/15 text-xs">{String(label).slice(0, 1)}</span>
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 border-t border-white/10 pt-6">
          <p className="px-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Manage</p>
          <nav className="mt-4 space-y-2 text-sm font-semibold" aria-label="Management navigation">
            <AiTemplatesBetaButton />
            {[
              ["Settings", "/dashboard/settings"],
            ].map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="flex h-11 items-center gap-3 rounded-lg px-4 text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
              >
                <span className="grid h-5 w-5 place-items-center rounded border border-white/15 text-[10px]">{label.slice(0, 1)}</span>
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-auto mb-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Arc Testnet</p>
          <p className="mt-2 text-sm font-semibold text-white">Connected</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Circle wallet infrastructure ready for USDC settlement.</p>
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

      <section className="min-h-screen px-5 py-6 xl:ml-[268px] xl:px-9">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">{greeting}</h1>
            <p className="mt-3 text-lg text-slate-400">{viewModel.primaryMessage}</p>
          </div>
          <div className="flex items-center gap-4">
            <BrandNotifications notifications={viewModel.notifications} />
            <Link href={walletChip?.href ?? "/dashboard/wallet"} className="hidden rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 transition hover:border-blue-300/30 sm:block">
              <p className="flex items-center gap-2 text-xs text-slate-400">
                Brand Wallet
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
              </p>
              <p className="mt-1 text-lg font-black">{walletChip?.balanceLabel ?? "Unavailable"}</p>
              <p className="mt-1 text-xs text-slate-400">Arc Testnet {walletChip?.walletAddressMasked ? `- ${walletChip.walletAddressMasked}` : ""}</p>
            </Link>
          </div>
        </header>

        <div className="mt-8 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_350px]">
          <div className="space-y-5">
            <NextActionHero viewModel={viewModel} />
            <Journey steps={viewModel.journeySteps} />
            <CampaignRows rows={viewModel.campaignRows} />
          </div>
          <RightColumn viewModel={viewModel} />
        </div>
      </section>
    </main>
  );
}

function NextActionHero({ viewModel }: { viewModel: BrandDashboardViewModel }) {
  const campaign = viewModel.primaryCampaign;
  if (!campaign) {
    return (
      <section className="grid gap-6 rounded-xl border border-white/10 bg-[#0c1020] p-6 shadow-2xl shadow-violet-950/10 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.65fr)]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">First Run</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">Launch your first creative challenge</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            Define the brief, fund the prize and receive global creative submissions.
          </p>
          <Link href="/create-challenge?new=1" prefetch className="mt-6 inline-flex h-12 items-center rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-7 text-sm font-black text-white shadow-lg shadow-violet-950/30">
            Create your first challenge
          </Link>
          <Link href="/#how-it-works" className="ml-3 mt-6 inline-flex h-12 items-center rounded-lg border border-white/10 px-6 text-sm font-black text-white transition hover:bg-white/[0.05]">
            Explore how CCN works
          </Link>
        </div>
        <CampaignIdentityPanel campaign={null} />
      </section>
    );
  }
  const primaryIssue = campaign ? heroPrimaryIssue(campaign) : "Campaign details are missing.";
  const reviewAttention = viewModel.primaryTitle === "New submission received";
  return (
    <section className="grid gap-6 rounded-xl border border-white/10 bg-[#0c1020] p-6 shadow-2xl shadow-violet-950/10 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.65fr)]">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">{reviewAttention ? "New submission received" : "Needs Attention"}</p>
        <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
          {reviewAttention ? campaign.title : "Complete your campaign before publishing."}
        </h2>
        <div className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">Primary issue</p>
          <p className="mt-2 text-lg font-black text-white">{primaryIssue}</p>
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-300">Estimated time: 2 min.</p>
        <Link href={viewModel.primaryAction.href} className="mt-6 inline-flex h-12 items-center rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-7 text-sm font-black text-white shadow-lg shadow-violet-950/30">
          {viewModel.primaryAction.label} -&gt;
        </Link>
        <Link href="/create-challenge?new=1" prefetch className="ml-3 mt-6 inline-flex h-12 items-center rounded-lg border border-white/10 px-6 text-sm font-black text-white transition hover:bg-white/[0.05]">
          + New Challenge
        </Link>
      </div>

      <CampaignIdentityPanel campaign={campaign} />
    </section>
  );
}

function heroPrimaryIssue(campaign: BrandDashboardCampaignRow) {
  if (campaign.status === "review") return "Open Blind Review to evaluate anonymous submissions.";
  if (campaign.nextStep.toLowerCase().includes("prize")) return "Prize & Winners is still missing.";
  return `${campaign.nextStep.replace(/^Next:\s*/i, "")} needs attention.`;
}

function CampaignIdentityPanel({ campaign }: { campaign: BrandDashboardCampaignRow | null }) {
  const rows = campaign
    ? [
        ["Campaign", campaign.title],
        ["Status", campaign.statusLabel],
        ["Current Phase", campaign.lifecycleContext],
        ["Required Action", campaign.nextStep],
        ["Last Updated", campaign.updatedLabel],
      ]
    : [
        ["Campaign", "No active campaign"],
        ["Status", "Not started"],
        ["Current Phase", "Draft"],
      ];

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/45 p-5">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Campaign Identity</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">Operational snapshot</p>
        </div>
        {campaign ? <span className={`rounded-md border px-2.5 py-1 text-[10px] font-black uppercase ${statusClass(campaign.statusTone)}`}>{campaign.statusLabel}</span> : null}
      </div>
      <dl className="divide-y divide-white/10">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[120px_1fr] gap-4 py-3">
            <dt className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
            <dd className="min-w-0 truncate text-sm font-semibold text-slate-100">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Journey({ steps }: { steps: BrandDashboardJourneyStep[] }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.035] p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Campaign Journey</p>
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
              {stepIcon(step)}
            </div>
            <p className={`mt-3 text-sm font-semibold ${step.status === "future" ? "text-slate-400" : "text-white"}`}>{step.label}</p>
            <p className={`mt-1 text-xs ${step.status === "current" ? "text-violet-200" : "text-slate-500"}`}>
              {step.status === "current" ? "Now" : step.status === "complete" ? "Done" : "Next"}
            </p>
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
        <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Your Campaigns</h2>
        <Link href="/dashboard/campaigns" className="text-sm font-semibold text-blue-300">View all campaigns -&gt;</Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {["All", "Draft", "Funding", "Live", "Review", "Completed", "Archived"].map((filter, index) => (
          <button
            key={filter}
            type="button"
            className={`h-9 rounded-lg border px-4 text-xs font-bold ${index === 0 ? "border-violet-400/50 bg-violet-600 text-white" : "border-white/10 bg-slate-950/40 text-slate-300"}`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {rows.length ? rows.map((row) => (
          <article key={row.draftId} className="grid gap-5 rounded-xl border border-white/10 bg-slate-950/35 p-4 transition hover:border-white/20 md:grid-cols-[minmax(300px,1.35fr)_minmax(180px,0.65fr)_auto] md:items-center">
            <div className="flex items-center gap-4">
              <CampaignThumb row={row} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-black">{row.title}</h3>
                  <span className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase ${statusClass(row.statusTone)}`}>{row.statusLabel}</span>
                </div>
                <p className="mt-2 text-sm font-semibold leading-5 text-white">{row.nextStep}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{row.metadataLine}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{row.progressLabel}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500" style={{ width: `${row.progressPercent ?? 0}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-400">{row.lifecycleContext}</p>
            </div>
            <Link href={row.href} className="inline-flex h-10 items-center justify-center rounded-lg border border-violet-400/40 bg-violet-600/20 px-5 text-sm font-black text-white transition hover:bg-violet-600/35">
              {row.actionLabel}
            </Link>
          </article>
        )) : (
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-6">
            <p className="text-lg font-black">Create your first challenge</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Create challenge -&gt; Fund -&gt; Publish -&gt; Review -&gt; Select Winner -&gt; Settle -&gt; Completed.</p>
            <Link href="/create-challenge?new=1" prefetch className="mt-5 inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-5 text-sm font-black text-white">
              Create your first challenge
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function RightColumn({ viewModel }: { viewModel: BrandDashboardViewModel }) {
  return (
    <aside className="space-y-5">
      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Wallet Quick Actions</h2>
        <div className="mt-5 divide-y divide-white/10">
          {viewModel.walletQuickActions.map((action) => (
            action.available && action.href ? (
              <Link key={action.label} href={action.href} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <span>
                  <span className="block text-sm font-black text-white">{action.label}</span>
                  <span className="mt-1 block text-sm leading-5 text-slate-300">{action.detail}</span>
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-800 text-lg">+</span>
              </Link>
            ) : (
              <div key={action.label} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0 opacity-60">
                <span>
                  <span className="block text-sm font-black text-white">{action.label}</span>
                  <span className="mt-1 block text-sm leading-5 text-slate-300">{action.detail}</span>
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-800 text-lg">+</span>
              </div>
            )
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Recent Activity</h2>
          <Link href="/dashboard/campaigns" className="text-xs font-bold text-blue-300">View all</Link>
        </div>
        <div className="mt-5 space-y-5">
          {viewModel.recentActivity.length ? viewModel.recentActivity.map((item) => (
            <Link key={`${item.label}-${item.detail}`} href={item.href} className="flex gap-3">
              <span className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black ${
                item.tone === "green"
                  ? "bg-emerald-500 text-slate-950"
                  : item.tone === "amber"
                    ? "bg-amber-500 text-slate-950"
                    : item.tone === "violet"
                      ? "bg-violet-600 text-white"
                      : "bg-blue-500 text-white"
              }`}>{item.label.slice(0, 1)}</span>
              <span>
                <span className="block text-sm font-semibold text-white">{item.label}</span>
                <span className="mt-1 block text-sm leading-5 text-slate-300">{item.detail}</span>
                <span className="mt-1 block text-xs text-slate-400">{item.at}</span>
              </span>
            </Link>
          )) : (
            <p className="text-sm text-slate-400">No campaign activity yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-blue-400/30 bg-gradient-to-br from-[#0b1228] to-[#111833] p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-cyan-300 text-cyan-200">A</span>
          <div>
            <h2 className="text-2xl font-black">Arc</h2>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Programmable Money Hackathon</p>
          </div>
        </div>
        <p className="mt-5 text-lg font-semibold leading-7 text-slate-100">Built on Arc.</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">Powered by Circle and USDC for hosted wallet approvals, escrow funding and creator settlement.</p>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Arc Testnet - Connected</p>
        <Link href="/dashboard/about-arc" className="mt-5 inline-flex rounded-lg border border-blue-400/30 px-4 py-3 text-sm font-semibold text-blue-200">
          Learn about the Arc integration -&gt;
        </Link>
      </section>
    </aside>
  );
}

function CampaignThumb({ row, size = "normal" }: { row: BrandDashboardCampaignRow; size?: "normal" | "large" }) {
  const dimensions = size === "large" ? "h-14 w-14" : "h-16 w-24";
  return (
    <div className={`${dimensions} shrink-0 overflow-hidden rounded-lg bg-gradient-to-br ${visualClass(row.visualTone)}`} aria-hidden="true">
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
