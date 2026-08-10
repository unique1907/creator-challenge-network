import Link from "next/link";
import type { ReactNode } from "react";
import { BusinessChallengeCover } from "@/components/ui/business-challenge-cover";
import { CCNLogo } from "@/components/ui/ccn-logo";
import { BrandDashboardChallengeList } from "@/features/dashboard/components/brand-dashboard-challenges";
import { BrandWalletQuickActions } from "@/features/dashboard/components/brand-wallet-quick-actions";
import { AiTemplatesBetaButton, BrandAccountControls } from "@/features/dashboard/components/brand-workspace-navigation";
import { resolveBrandDashboardGreetingName } from "@/features/dashboard/brand-dashboard-view-model";
import type {
  BrandDashboardActivity,
  BrandDashboardCampaignRow,
  BrandDashboardJourneyStep,
  BrandDashboardPriority,
  BrandDashboardViewModel,
} from "@/features/dashboard/brand-dashboard-view-model";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "D", active: true, disabled: false },
  { label: "Business Challenges", href: "/dashboard/campaigns", icon: "B", active: false, disabled: false },
  { label: "Wallet", href: "/dashboard/wallet", icon: "W", active: false, disabled: false },
  { label: "Payments", href: "/dashboard/payments", icon: "P", active: false, disabled: false },
];

const secondaryNavItems = [
  { label: "Analytics", href: null, icon: "A", active: false, disabled: true },
  { label: "Settings", href: "/dashboard/settings", icon: "S", active: false, disabled: false },
];

const NEW_DRAFT_HREF = "/create-challenge?new=1";

function statusClass(tone: BrandDashboardCampaignRow["statusTone"]) {
  if (tone === "green") return "border-emerald-400/30 bg-emerald-400/12 text-emerald-200";
  if (tone === "amber") return "border-amber-400/30 bg-amber-400/12 text-amber-200";
  if (tone === "violet") return "border-violet-400/35 bg-violet-500/15 text-violet-100";
  if (tone === "blue") return "border-blue-400/30 bg-blue-400/12 text-blue-200";
  return "border-slate-400/25 bg-slate-400/10 text-slate-200";
}

function priorityToneClass(tone: BrandDashboardPriority["tone"]) {
  if (tone === "green") return "border-emerald-400/30 bg-emerald-400/[0.09] text-emerald-100";
  if (tone === "amber") return "border-amber-400/30 bg-amber-400/[0.09] text-amber-100";
  if (tone === "violet") return "border-violet-400/30 bg-violet-400/[0.09] text-violet-100";
  if (tone === "blue") return "border-blue-400/30 bg-blue-400/[0.09] text-blue-100";
  return "border-slate-700/70 bg-[#0d1524] text-slate-100";
}

function activityToneClass(tone: BrandDashboardActivity["tone"]) {
  if (tone === "green") return "bg-emerald-400";
  if (tone === "amber") return "bg-amber-400";
  if (tone === "violet") return "bg-violet-400";
  return "bg-blue-400";
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

function heroTitle(row: BrandDashboardCampaignRow | null) {
  if (!row) return "You're all caught up";
  switch (row.status) {
    case "draft":
      return "Complete your Business Challenge draft";
    case "funding":
      return "Fund your Business Challenge";
    case "ready-to-publish":
      return "Open your business challenge for solutions";
    case "review":
      return "Review incoming solution proposals";
    case "winner-ready":
      return "Choose the winning solution";
    case "settlement":
      return "Approve creator payout";
    default:
      return "Choose your next business challenge action";
  }
}

function heroCta(row: BrandDashboardCampaignRow | null, fallback: BrandDashboardViewModel["primaryAction"]) {
  if (!row) return { label: "New Business Challenge", href: fallback.href || NEW_DRAFT_HREF };
  return { label: actionLabelForRow(row), href: row.href };
}

export function BrandDashboard({
  user,
  walletChip,
  viewModel,
}: {
  user: { displayName: string; brandName?: string | null; email?: string; creatorAccess?: boolean; avatarImageUrl?: string | null };
  walletChip?: { walletAddress: string; walletAddressMasked: string; balanceLabel: string; href: string } | null;
  viewModel: BrandDashboardViewModel;
}) {
  const greetingName = resolveBrandDashboardGreetingName({
    brandName: viewModel.brandDisplayName,
    displayName: user.displayName,
  });
  const profileName = user.displayName?.trim() || "Brand Account";
  const greeting = greetingName ? `Welcome back, ${greetingName}.` : "Welcome back.";
  const focus = viewModel.primaryCampaign;

  return (
    <main className="min-h-screen bg-[#030712] text-white">
      <Sidebar />

      <section className="min-h-screen xl:ml-[224px]">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-2.5 px-3 py-2.5 lg:px-4">
          <TopBar
            greeting={greeting}
            profileName={profileName}
            user={user}
            brandName={viewModel.brandDisplayName}
            notifications={viewModel.notifications}
          />

          <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_288px] xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-2.5">
              <NextActionHero row={focus} primaryAction={viewModel.primaryAction} />
              <DashboardJourney steps={viewModel.journeySteps} />
              <BrandDashboardChallengeList
                rows={viewModel.campaignRows}
                filterRows={viewModel.allCampaignRows}
                totalRows={viewModel.allCampaignRows.length}
                primaryAction={viewModel.primaryAction}
              />
            </div>
            <RightRail viewModel={viewModel} walletChip={walletChip} />
          </div>
        </div>
      </section>
    </main>
  );
}

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[224px] border-r border-white/10 bg-[#050a14]/95 px-4 py-4 xl:flex xl:flex-col">
      <Link href="/" className="flex items-center gap-3">
        <CCNLogo size="md" priority />
      </Link>

      <nav className="mt-6 space-y-0.5 text-[12px] font-medium" aria-label="Brand workspace navigation">
        {navItems.map((item) => (
          <SidebarNavRow key={item.label} item={item} />
        ))}
        <AiTemplatesBetaButton variant="compact" />
        {secondaryNavItems.map((item) => (
          <SidebarNavRow key={item.label} item={item} />
        ))}
      </nav>
      <TutorialCard />
    </aside>
  );
}

function SidebarNavRow({ item }: { item: (typeof navItems)[number] | (typeof secondaryNavItems)[number] }) {
  const className = `flex h-8 items-center gap-2.5 rounded-md border px-2.5 ${
    item.active
      ? "border-violet-500/45 bg-violet-600/25 text-white shadow-[0_0_20px_rgba(124,58,237,0.18)]"
      : item.disabled
        ? "cursor-not-allowed border-transparent text-slate-500"
        : "border-transparent text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
  }`;
  const content = (
    <>
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded border border-white/15 text-[9px]">
        {item.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.disabled ? <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Soon</span> : null}
    </>
  );

  if (item.disabled || !item.href) {
    return (
      <div className={className} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {content}
    </Link>
  );
}

function TutorialCard() {
  return (
    <a
      href="https://www.youtube.com/watch?v=BG0sHuTqGRc"
      target="_blank"
      rel="noopener noreferrer"
      className="mt-auto block rounded-xl border border-violet-400/20 bg-violet-500/[0.08] p-2.5 text-left transition hover:border-violet-300/35 hover:bg-violet-500/[0.12]"
    >
      <span className="flex items-center gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-600/30 text-white">
          <span className="ml-0.5 text-[11px]">Play</span>
        </span>
        <span className="min-w-0">
          <span className="block text-[12px] font-semibold leading-4 text-white">How to send your first draft</span>
          <span className="mt-0.5 block text-[11px] leading-4 text-slate-400">
            Learn how to create and submit your first draft step by step.
          </span>
        </span>
      </span>
      <span className="mt-2 inline-flex h-7 items-center rounded-md border border-white/10 px-2.5 text-[11px] font-semibold text-violet-100">
        Watch Tutorial
      </span>
    </a>
  );
}

function TopBar({
  greeting,
  profileName,
  user,
  brandName,
  notifications,
}: {
  greeting: string;
  profileName: string;
  user: { displayName: string; brandName?: string | null; email?: string; creatorAccess?: boolean; avatarImageUrl?: string | null };
  brandName?: string | null;
  notifications: BrandDashboardViewModel["notifications"];
}) {
  return (
    <header className="flex min-h-[48px] items-center justify-between gap-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 xl:hidden">
          <CCNLogo size="sm" priority />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[18px] font-semibold leading-[1.12] tracking-normal text-white md:text-[20px]">
            {greeting}
          </h1>
          <p className="mt-0.5 truncate text-[12px] text-slate-400">
            Turn business problems into solutions you can review and reward.
          </p>
        </div>
      </div>

      <BrandAccountControls
        displayName={profileName}
        brandName={user.brandName ?? brandName}
        email={user.email}
        workspaceLabel="Brand Workspace"
        creatorAccess={user.creatorAccess}
        avatarImageUrl={user.avatarImageUrl}
        notifications={notifications}
      />
    </header>
  );
}

function NextActionHero({
  row,
  primaryAction,
}: {
  row: BrandDashboardCampaignRow | null;
  primaryAction: BrandDashboardViewModel["primaryAction"];
}) {
  const cta = heroCta(row, primaryAction);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-700/75 bg-[#0b1220] shadow-[0_12px_44px_rgba(0,0,0,0.22)] md:grid md:min-h-[150px] md:grid-cols-2">
      <div className="relative z-10 flex min-h-[148px] flex-col justify-center p-3 md:min-h-[150px] md:p-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-violet-300">YOUR NEXT ACTION</p>
        <h2 className="mt-1.5 max-w-[520px] text-[18px] font-semibold leading-[1.12] tracking-normal text-white md:text-[20px]">
          {heroTitle(row)}
        </h2>

        {row ? (
          <div className="mt-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[13px] font-semibold text-white">{row.title}</h3>
              <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${statusClass(row.statusTone)}`}>
                {row.currentPhaseLabel}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">{row.updatedLabel}</p>
          </div>
        ) : (
          <p className="mt-2 max-w-[460px] text-[12px] leading-4 text-slate-300">
            No Business Challenges currently require your attention.
          </p>
        )}

        <div className="mt-2.5 flex w-full max-w-[172px] flex-col gap-1.5">
          <Link
            href={cta.href}
            className="inline-flex h-7 items-center justify-center rounded-md border border-white/12 bg-slate-950/30 px-3 text-[11px] font-semibold text-violet-100 transition hover:border-violet-300/35 hover:bg-white/[0.05]"
          >
            {cta.label} <span className="ml-2">-&gt;</span>
          </Link>
          {row ? (
            <Link
              href={NEW_DRAFT_HREF}
              className="inline-flex h-8 items-center justify-center rounded-md bg-violet-600 px-3 text-[11px] font-semibold text-white transition hover:bg-violet-500"
            >
              New Business Challenge
            </Link>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-[108px] overflow-hidden md:min-h-full">
        {row?.media.imageUrl ? (
          <BusinessChallengeCover
            src={row.media.imageUrl}
            alt={row.media.alt}
            title={row.title}
            decorative
            className="absolute inset-0 h-full w-full border-0"
            imageClassName="p-3"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#0b1220_0%,rgba(11,18,32,0.72)_12%,rgba(11,18,32,0.18)_30%,rgba(11,18,32,0)_54%)]" />
      </div>
    </section>
  );
}

function DashboardJourney({ steps }: { steps: BrandDashboardJourneyStep[] }) {
  return (
    <section className="rounded-xl border border-slate-700/75 bg-[#0b1220] px-3 py-2">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="grid h-4 w-4 place-items-center rounded-full bg-violet-500/20 text-[9px] text-violet-200">J</span>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-200">Challenge Progress</h2>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {steps.map((step, index) => (
          <div key={step.id} className="relative min-w-0">
            {index > 0 ? (
              <span
                className={`absolute right-1/2 top-4 hidden h-px w-full md:block ${
                  step.status === "future" ? "bg-slate-600/80" : "bg-violet-400/70"
                }`}
              />
            ) : null}
            <div className="relative z-10 flex flex-col items-center text-center">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full border text-[10px] font-semibold ${
                  step.status === "complete"
                    ? "border-emerald-400/40 bg-emerald-400/20 text-emerald-100"
                    : step.status === "current"
                      ? "border-violet-300 bg-violet-600 text-white shadow-[0_0_24px_rgba(124,58,237,0.36)]"
                      : "border-slate-600/90 bg-[#0e1728] text-slate-400"
                }`}
              >
                {step.status === "complete" ? "OK" : index + 1}
              </span>
              <p className="mt-1 text-[10px] font-semibold text-white">{step.label}</p>
              <p className="mt-0.5 text-[10px] text-slate-300">
                {step.status === "complete" ? "Completed" : step.status === "current" ? "Current" : "Pending"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RightRail({
  viewModel,
  walletChip,
}: {
  viewModel: BrandDashboardViewModel;
  walletChip?: { walletAddress: string; walletAddressMasked: string; balanceLabel: string; href: string } | null;
}) {
  const priority = viewModel.priorities[0] ?? null;

  return (
    <aside className="space-y-2">
      <WalletQuickActions walletChip={walletChip} />
      <RecentActivity items={viewModel.recentActivity} />
      <TodaysPriorities priority={priority} />
      <ArcCircleCard />
      <BrandGuideCard />
    </aside>
  );
}

function WalletQuickActions({ walletChip }: { walletChip?: { walletAddress: string; walletAddressMasked: string; balanceLabel: string; href: string } | null }) {
  return (
    <RailCard title="Wallet Quick Actions">
      <BrandWalletQuickActions
        walletAddress={walletChip ? walletChip.walletAddress : null}
        walletHref={walletChip ? walletChip.href : "/dashboard/wallet"}
        balanceLabel={walletChip ? walletChip.balanceLabel : "Wallet balance unavailable"}
      />
    </RailCard>
  );
}

function RecentActivity({ items }: { items: BrandDashboardActivity[] }) {
  return (
    <RailCard
      title="Recent Activity"
      action={
        <Link href="/dashboard/campaigns" className="text-[11px] font-semibold text-violet-200">
          View all
        </Link>
      }
    >
      <div className="space-y-1">
        {items.length ? (
          items.slice(0, 5).map((item) => (
            <Link key={item.key} href={item.href} className="grid grid-cols-[28px_1fr] gap-1.5 py-1.5">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-white/[0.06]">
                <span className={`h-2 w-2 rounded-full ${activityToneClass(item.tone)}`} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold leading-4 text-white">{item.label}</span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-300">{item.detail}</span>
                <span className="mt-0.5 block text-[10px] text-slate-400">{item.at}</span>
              </span>
            </Link>
          ))
        ) : (
          <p className="text-[12px] leading-5 text-slate-300">No business challenge activity yet.</p>
        )}
      </div>
    </RailCard>
  );
}

function TodaysPriorities({ priority }: { priority: BrandDashboardPriority | null }) {
  const hasPriority = priority && priority.label !== "No urgent actions right now";

  return (
    <RailCard title="Today's Priorities">
      {hasPriority && priority ? (
        <Link href={priority.href} className={`block rounded-md border p-2 transition hover:border-white/20 ${priorityToneClass(priority.tone)}`}>
          <p className="text-[12px] font-semibold leading-4">{priority.label}</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-300">{priority.detail}</p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.04em]">{priority.ctaLabel} -&gt;</p>
        </Link>
      ) : (
        <div className="rounded-md border border-slate-700/65 bg-[#0d1524] p-2">
          <p className="text-[12px] font-semibold text-white">No urgent actions right now</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-300">Active business challenges are up to date.</p>
        </div>
      )}
    </RailCard>
  );
}

function ArcCircleCard() {
  return (
    <section className="rounded-xl border border-blue-400/25 bg-blue-500/[0.08] p-2.5">
      <p className="text-[13px] font-semibold text-white">Built on Arc</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-300">
        CCN uses Arc and Circle-powered USDC settlement for funded business challenges.
      </p>
      <Link href="/dashboard/payments" className="mt-2 inline-flex h-6 items-center rounded-md border border-blue-300/30 px-2 text-[10px] font-semibold text-blue-100">
        View payment status -&gt;
      </Link>
    </section>
  );
}

function BrandGuideCard() {
  return (
    <section className="overflow-hidden rounded-xl border border-violet-300/20 bg-[radial-gradient(circle_at_85%_20%,rgba(124,58,237,0.28),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(124,58,237,0.1))] p-2.5">
      <h2 className="text-[13px] font-semibold text-white">Need help?</h2>
      <p className="mt-1 text-[11px] leading-4 text-slate-300">
        Learn how to create, fund, review, and settle Business Challenges on CCN.
      </p>
      <Link href="/dashboard/guide" className="mt-2 inline-flex h-6 items-center rounded-md border border-white/15 px-2 text-[10px] font-semibold text-white transition hover:bg-white/[0.06]">
        Brand Guide
      </Link>
    </section>
  );
}

function RailCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-700/75 bg-[#0b1220] p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-[0.01em] text-slate-200">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
