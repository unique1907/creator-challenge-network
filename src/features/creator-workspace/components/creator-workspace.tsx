/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CCNLogo } from "@/components/ui/ccn-logo";
import { CreatorPayoutWalletSetup, CreatorSignInAction, CreatorSubmissionForm } from "./creator-actions";
import { CreatorNotificationsButton } from "./creator-notifications-button";
import { CreatorProfileForm } from "./creator-profile-form";
import { CreatorWalletActions } from "./creator-wallet-actions";
import { CreatorWorkspaceNav } from "./creator-workspace-nav";
import { CreatorWorkspaceSearch } from "./creator-workspace-search";
import { UserMenu } from "@/components/auth/user-menu";
import { BusinessChallengeCover, formatBusinessChallengeHierarchy } from "@/components/ui/business-challenge-cover";
import { isSpikeAllowedInEnvironment } from "@/services/internal-spike-auth.server";
import type { CreatorSession } from "@/services/creator-session.server";
import type {
  CreatorChallengeCard,
  CreatorChallengeDetail,
  CreatorMetricItem,
  CreatorNextAction,
  CreatorNotificationItem,
  CreatorProfileSummary,
  CreatorRewardItem,
  CreatorSubmissionDetail,
  CreatorSubmissionListItem,
  CreatorWalletSummary,
  CreatorWorkspaceOverview,
} from "@/services/creator-workspace/creator-workspace.server";

type CreatorShellProps = {
  session: CreatorSession;
  profile?: CreatorProfileSummary;
  notifications?: CreatorNotificationItem[];
  active?: "overview" | "discover" | "submissions" | "rewards" | "wallet";
  children: React.ReactNode;
};


function statusClass(status: string) {
  if (status.includes("Paid") || status.includes("Submitted") || status === "Ready") {
    return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  }
  if (status.includes("Review") || status.includes("Processing") || status.includes("Draft")) {
    return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  }
  if (status.includes("Winner")) return "border-violet-300/30 bg-violet-300/10 text-violet-100";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function maskId(value: string) {
  return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function SectionHeader(props: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
      <div>
        {props.eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">{props.eyebrow}</p>
        ) : null}
        <h2 className="mt-0.5 text-base font-semibold text-white">{props.title}</h2>
      </div>
      {props.action}
    </div>
  );
}

function EmptyState(props: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[12px] text-slate-300">
      <p className="font-semibold text-white">{props.title}</p>
      <p className="mt-1 text-slate-400">{props.detail}</p>
    </div>
  );
}

export function CreatorAuthGate() {
  return (
    <main className="min-h-screen bg-[#050916] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#0c1222] p-8 shadow-2xl shadow-black/40">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Creator Workspace</p>
        <h1 className="mt-3 text-3xl font-semibold">Sign in to continue</h1>
        <p className="mt-3 text-slate-300">
          Creator routes use the server-derived CCN account session. In development, use the approved demo
          creator to test submissions without exposing creator identity to blind review.
        </p>
        {isSpikeAllowedInEnvironment() ? <CreatorSignInAction /> : null}
      </div>
    </main>
  );
}

export function CreatorWorkspaceShell({ session, profile, notifications = [], children }: CreatorShellProps) {
  const identity = profile ?? { displayName: session.displayName, username: null, country: null, avatarImageKey: null, avatarImageUrl: null };
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#030815] text-white">
      <aside className="fixed inset-y-0 left-0 hidden w-[270px] flex-col overflow-y-auto border-r border-white/10 bg-[#050a14]/98 px-4 py-5 lg:flex">
        <Link href="/" className="flex items-center gap-3">
          <CCNLogo size="xl" priority />
        </Link>
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.035] p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Workspace</p>
          <p className="mt-1 font-semibold text-white">Creator Workspace</p>
        </div>
        <CreatorWorkspaceNav />
      </aside>
      <section className="min-h-screen px-3 py-2.5 sm:px-4 lg:ml-[270px] lg:px-5 xl:px-6">
        <header className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 lg:max-w-[590px]">
            <CreatorWorkspaceSearch />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <CreatorNotificationsButton notifications={notifications} />
            <UserMenu
              displayName={identity.displayName}
              workspaceLabel="Creator Workspace"
              initials={identity.displayName.slice(0, 2)}
              avatarUrl={identity.avatarImageUrl}
            />
          </div>
        </header>
        <div className="mb-3 lg:hidden">
          <CreatorWorkspaceNav />
        </div>
        {children}
      </section>
    </main>
  );
}

function ChallengeCard({ challenge }: { challenge: CreatorChallengeCard }) {
  const hierarchy = formatBusinessChallengeHierarchy({
    brand: challenge.brandName,
    title: challenge.title,
    category: challenge.category,
  });

  return (
    <article className="flex h-full flex-col rounded-lg border border-white/10 bg-white/[0.04] p-2 transition hover:border-cyan-300/30">
      <BusinessChallengeCover
        src={challenge.coverImageUrl}
        alt={challenge.coverImageAlt}
        title={challenge.title}
        className="mb-1.5 aspect-[16/6] max-h-[78px] w-full rounded-md"
        imageClassName="p-1"
      />
      <div className="flex flex-1 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {hierarchy.brand ? <p className="truncate text-[11px] text-slate-400">{hierarchy.brand}</p> : null}
            <h3 className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-4 text-white">{hierarchy.title}</h3>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold leading-4 ${statusClass(challenge.submissionStatus)}`}>
            {challenge.submissionStatus}
          </span>
        </div>

        <p className="mt-1 truncate text-[11px] text-slate-500">{hierarchy.category}</p>

        <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="rounded-md border border-white/10 bg-[#070b14] p-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">Prize Pool</p>
            <p className="mt-0.5 text-[12px] font-semibold leading-4 text-cyan-200">{challenge.prizePool}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-[#070b14] p-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">Deadline</p>
            <p className="mt-0.5 text-[11px] font-semibold leading-4 text-white">{challenge.submissionDeadline}</p>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-[11px] text-slate-500">{challenge.submissionCountLabel}</span>
          <Link href={`/dashboard/creator/challenges/${challenge.slug}`} className="inline-flex h-7 items-center rounded-md bg-violet-600 px-2.5 text-[11px] font-semibold text-white transition hover:bg-violet-500">
            {challenge.actionLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}

function SubmissionRow({ item }: { item: CreatorSubmissionListItem }) {
  return (
    <div className="grid gap-2 border-b border-white/10 px-2.5 py-1.5 text-[11px] last:border-b-0 md:grid-cols-[1.4fr_1fr_0.8fr_auto] md:items-center">
      <div>
        <p className="font-semibold text-white">{item.challengeTitle}</p>
        <p className="mt-0.5 text-slate-400">{item.challengeDetailLabel}</p>
      </div>
      <p className="text-slate-300">{item.anonymousEntryCode}</p>
      <span className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(item.status)}`}>
        {item.status}
      </span>
      <Link href={item.href} className="font-semibold text-blue-300 hover:text-blue-200">
        {item.actionLabel}
      </Link>
    </div>
  );
}

function RewardRow({ reward }: { reward: CreatorRewardItem }) {
  return (
    <div className="grid gap-2 border-b border-white/10 px-2.5 py-1.5 text-[11px] last:border-b-0 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto] md:items-center">
      <div>
        <p className="font-semibold text-white">{reward.challengeTitle}</p>
        <p className="mt-0.5 text-slate-400">{reward.brandName}</p>
      </div>
      <p className="font-semibold text-cyan-200">{reward.amount}</p>
      <span className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(reward.status)}`}>
        {reward.status}
      </span>
      {reward.transactionHash && reward.transactionUrl ? (
        <a
          href={reward.transactionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 transition hover:text-blue-200"
        >
          {maskId(reward.transactionHash)}
        </a>
      ) : (
        <p className="text-slate-400">No verified tx</p>
      )}
    </div>
  );
}

function MetricCard({ metric }: { metric: CreatorMetricItem }) {
  return <article className="min-w-0 rounded-lg border border-white/10 bg-white/[0.045] p-2 shadow-lg shadow-black/10"><div className="flex min-w-0 items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-violet-400/20 bg-violet-500/15 text-[10px] font-bold text-violet-100" aria-hidden="true">{metric.iconLabel}</span><div className="min-w-0"><p className="text-[10px] leading-3 text-slate-400">{metric.label}</p><p className="mt-0.5 break-words text-[15px] font-semibold leading-tight text-white">{metric.value}</p><p className="mt-0.5 text-[10px] leading-3 text-slate-500">{metric.detail}</p></div></div></article>;
}

function CompactChallengeCard({ challenge }: { challenge: CreatorChallengeCard }) {
  const hierarchy = formatBusinessChallengeHierarchy({
    brand: challenge.brandName,
    title: challenge.title,
    category: challenge.category,
  });

  return <article className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.045] shadow-lg shadow-black/10 transition hover:border-violet-300/25"><div className="relative"><BusinessChallengeCover src={challenge.coverImageUrl} alt={challenge.coverImageAlt} title={challenge.title} className="aspect-[16/6] max-h-[92px] w-full border-0" imageClassName="p-1.5" />{challenge.featured ? <span className="absolute left-2 top-2 rounded-md bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white">Featured</span> : null}<span className="absolute right-2 top-2 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-100">{challenge.timeLeftLabel}</span></div><div className="p-2"><div className="flex items-center gap-1.5"><span className="grid h-5 w-5 place-items-center rounded bg-white text-[10px] font-bold text-slate-950">{(hierarchy.brand || "B").slice(0, 1).toUpperCase()}</span><p className="truncate text-[12px] font-semibold text-white">{hierarchy.brand}</p></div><h3 className="mt-1 line-clamp-2 text-[13px] font-semibold leading-4 text-white">{hierarchy.title}</h3><p className="mt-0.5 text-[11px] text-slate-400">{hierarchy.category}</p><div className="mt-2 flex items-end justify-between gap-2 border-t border-white/10 pt-1.5"><div><p className="text-[13px] font-semibold text-white">{challenge.prizePool}</p><p className="mt-0.5 text-[10px] text-slate-500">Prize Pool</p></div><Link href={`/dashboard/creator/challenges/${challenge.slug}`} className="rounded-md bg-violet-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-violet-500">View Challenge</Link></div><p className="mt-1 text-[10px] text-slate-500">{challenge.submissionCountLabel}</p></div></article>;
}

function NextActionHero({ action }: { action: CreatorNextAction }) {
  if (action.kind === "submit_work" && action.challenge) {
    return (
      <section className="rounded-xl border border-violet-300/20 bg-white/[0.035] p-2.5 shadow-lg shadow-black/10">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-200">Next Action</p>
            <h2 className="mt-0.5 text-base font-semibold text-white">Live challenge ready for your proposal</h2>
          </div>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">{action.statusLabel}</span>
        </div>
        <CompactChallengeCard challenge={action.challenge} />
      </section>
    );
  }
  return <section className="relative overflow-hidden rounded-xl border border-violet-300/20 bg-[radial-gradient(circle_at_30%_20%,rgba(143,64,255,0.34),transparent_32%),linear-gradient(125deg,#5916af_0%,#2624a9_48%,#0755bb_100%)] p-2.5 shadow-lg shadow-violet-950/20 lg:min-h-[108px]">{action.metaLabel ? <span className="absolute right-2.5 top-2.5 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/90">{action.metaLabel}</span> : null}<div className="relative z-10 flex h-full flex-col justify-between gap-2.5"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-100">Next Action</p><h2 className="mt-1.5 text-[17px] font-semibold leading-tight text-white md:text-lg">{action.headline}</h2><p className="mt-1 max-w-2xl text-[12px] leading-4 text-violet-100/85">{action.detail}</p></div><div className="flex flex-wrap items-end justify-between gap-2"><p className="text-[12px] text-violet-100/80">{action.statusLabel}</p><Link href={action.href} className="inline-flex items-center justify-center rounded-md bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-950 shadow-lg shadow-black/10 transition hover:bg-violet-50">{action.ctaLabel} <span className="ml-2" aria-hidden="true">-&gt;</span></Link></div></div></section>;
}

function NotificationsPreview({ notifications }: { notifications: CreatorNotificationItem[] }) {
  return <section className="rounded-xl border border-white/10 bg-white/[0.045] p-2.5 shadow-lg shadow-black/10"><div className="flex items-center justify-between gap-2"><h2 className="text-[13px] font-semibold text-white">Notifications</h2><Link href="/dashboard/creator/notifications" className="text-[11px] font-semibold text-violet-300 transition hover:text-violet-200">View all -&gt;</Link></div><div className="mt-2 space-y-0.5">{notifications.length ? notifications.slice(0, 4).map((item) => <Link key={item.id} href={item.href} className="grid grid-cols-[28px_minmax(0,1fr)_auto] gap-2 border-b border-white/10 py-1.5 last:border-b-0"><span className="grid h-7 w-7 place-items-center rounded-md bg-violet-500/15 text-[10px] font-bold text-violet-100" aria-hidden="true">{item.iconLabel}</span><span className="min-w-0"><span className="block truncate text-[12px] font-semibold text-white">{item.headline}</span><span className="mt-0.5 line-clamp-2 block text-[10px] leading-4 text-slate-400">{item.message}</span></span><span className="flex flex-col items-end gap-1 text-[10px] text-slate-500">{item.timeLabel}{item.unread ? <span className="h-1.5 w-1.5 rounded-full bg-violet-400" aria-label="Unread" /> : null}</span></Link>) : <EmptyState title="No notifications yet" detail="Submission, review, winner, and payout events will appear here when they exist." />}</div></section>;
}

function WalletRailCard({ wallet }: { wallet: CreatorWalletSummary }) {
  return <section className="rounded-xl border border-white/10 bg-white/[0.045] p-2.5 shadow-lg shadow-black/10"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200">Payout Wallet</p><p className="mt-2 text-[11px] text-slate-400">USDC Balance</p><p className="mt-0.5 text-base font-semibold text-white">{wallet.balanceLabel}</p><p className="mt-0.5 text-[10px] text-slate-500">{wallet.balanceDetail}</p></div><span className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-base font-bold text-white shadow-lg shadow-blue-600/20" aria-hidden="true">$</span></div><p className={`mt-2 text-[12px] font-semibold ${wallet.available ? "text-emerald-300" : "text-amber-300"}`}>{wallet.available ? "Ready to receive rewards" : "Payout setup required"}</p><div className="mt-2 space-y-1.5"><Link href="/dashboard/creator/wallet" className="flex items-center justify-between rounded-md bg-violet-600 px-2.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-violet-500">View Wallet <span aria-hidden="true">-&gt;</span></Link><button type="button" disabled className="flex w-full cursor-not-allowed items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] font-semibold text-slate-500">Withdraw (Beta) <span aria-hidden="true">-&gt;</span></button></div></section>;
}

function CreatorHelpCard() {
  return <section className="overflow-hidden rounded-xl border border-violet-300/20 bg-[radial-gradient(circle_at_85%_20%,rgba(124,58,237,0.36),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(124,58,237,0.12))] p-2.5"><h2 className="text-[13px] font-semibold text-white">Need help?</h2><p className="mt-1 max-w-xs text-[11px] leading-4 text-slate-300">Review the Creator Guide and learn how submissions, reviews, and rewards work on CCN.</p><Link href="/dashboard/creator/guide" className="mt-2 inline-flex rounded-md border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/[0.06]">Creator Guide</Link></section>;
}

export function CreatorOverviewPage({ overview }: { overview: CreatorWorkspaceOverview }) {
  return (
    <div className="grid gap-2.5 2xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="min-w-0 space-y-2.5">
        <section className="space-y-2">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-violet-300">Creator Workspace</p>
            <h1 className="mt-1 text-xl font-semibold leading-tight text-white md:text-[22px]">
              Welcome Back {overview.profile.displayName} <span aria-hidden="true">&#128075;</span>
            </h1>
            <p className="mt-1 text-[12px] text-slate-400">Find opportunities, create amazing work, and earn rewards.</p>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-3">{overview.metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div>
        </section>
        <NextActionHero action={overview.nextAction} />
        <section>
          <SectionHeader title="Open Challenges" action={<Link href="/dashboard/creator/discover" className="text-sm font-semibold text-violet-300">View all challenges -&gt;</Link>} />
          {overview.availableChallenges.length ? (
            <div className="grid gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
              {overview.availableChallenges.slice(0, 3).map((challenge) => <CompactChallengeCard key={challenge.draftId} challenge={challenge} />)}
            </div>
          ) : (
            <EmptyState title="No open challenges right now" detail="Funded public briefs will appear here when they go live." />
          )}
        </section>
        <section>
          <SectionHeader title="My Submissions" action={<Link href="/dashboard/creator/submissions" className="text-sm font-semibold text-violet-300">View all submissions -&gt;</Link>} />
          {overview.submissions.length ? (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.045]">
              {overview.submissions.slice(0, 3).map((item) => <SubmissionRow key={item.submissionId} item={item} />)}
            </div>
          ) : (
            <EmptyState title="No submissions yet" detail="Choose an open Business Challenge to create your first Solution Proposal." />
          )}
        </section>
      </div>
      <aside className="space-y-2.5 2xl:sticky 2xl:top-3 2xl:self-start">
        <WalletRailCard wallet={overview.wallet} />
        <NotificationsPreview notifications={overview.notifications} />
        <CreatorHelpCard />
      </aside>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionHeader title={title} />
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">{children}</div>
    </div>
  );
}

function WalletPanel({ wallet }: { wallet: CreatorWalletSummary }) {
  return (
    <div>
      <SectionHeader title="Wallet Readiness" />
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Payout wallet</p>
            <p className="mt-1 text-base font-semibold text-white">{wallet.available ? "Ready" : "Setup required"}</p>
            <p className="mt-1 text-[11px] text-slate-400">{wallet.available ? wallet.walletAddressMasked : "Set up your payout wallet before submitting."}</p>
          </div>
          <div className="grid gap-2">
            <CreatorWalletActions walletAddress={wallet.walletAddress} explorerUrl={wallet.explorerUrl} />
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] font-semibold text-slate-500"
            >
              Withdraw <span className="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]">Beta</span>
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Creator withdrawals are being prepared for the beta release.</p>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          <Info label="Network" value={wallet.network} />
          <Info label="Status" value={wallet.available ? "Ready" : wallet.walletState} />
          <Info label="Balance" value={wallet.balanceLabel} />
          <Info label="Wallet verification" value={wallet.balanceStatus === "ready" ? "Verified on Arc Testnet" : wallet.balanceStatus === "error" ? "Retry required" : "Unavailable"} />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">{wallet.balanceDetail}</p>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#070b14] p-1.5">
      <p className="text-[9px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-white">{value}</p>
    </div>
  );
}

export function CreatorDiscoverPage({ challenges }: { session: CreatorSession; challenges: CreatorChallengeCard[] }) {
  return (
    <>
      <SectionHeader eyebrow="Creator Workspace" title="Discover Challenges" />
      {challenges.length ? (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {challenges.map((challenge) => <ChallengeCard key={challenge.draftId} challenge={challenge} />)}
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[12px] text-slate-300"><p className="font-semibold text-white">No open challenges right now</p><p className="mt-1 text-slate-400">Only published, funded campaigns with active submission windows are shown.</p><Link href="/challenges" className="mt-2 inline-flex rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/[0.06]">Return to public challenges</Link></div>
      )}
    </>
  );
}

export function CreatorChallengeDetailPage({ challenge, wallet, appId }: {
  session: CreatorSession;
  challenge: CreatorChallengeDetail;
  wallet: CreatorWalletSummary;
  appId: string;
}) {
  const submitted = challenge.submission?.status === "SUBMITTED";
  return (
    <>
      <div className="grid gap-2.5 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
          {challenge.coverImageUrl ? (
            <BusinessChallengeCover
              src={challenge.coverImageUrl}
              alt={challenge.coverImageAlt}
              title={challenge.title}
              className="mb-2 aspect-[16/5] max-h-[140px] w-full rounded-md"
              imageClassName="p-2"
            />
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] text-cyan-200">{challenge.brandName}</p>
              <h1 className="mt-1 text-lg font-semibold leading-tight text-white">{challenge.title}</h1>
              <p className="mt-1 max-w-3xl text-[12px] leading-4 text-slate-300">{challenge.summary}</p>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(challenge.submissionStatus)}`}>
              {challenge.submissionStatus}
            </span>
          </div>
          <div className="mt-2 grid gap-1.5 md:grid-cols-3">
            <Info label="Prize Pool" value={challenge.prizePool} />
            <Info label="Deadline" value={challenge.submissionDeadline} />
            <Info label="Submissions" value={String(challenge.submissionCount)} />
          </div>
          <div className="mt-2.5 space-y-2 text-[12px] text-slate-300">
            <TextBlock title="Brief" value={challenge.description} />
            <TextBlock title="Primary deliverable" value={challenge.primaryDeliverable} />
            <TextBlock title="Usage rights" value={challenge.usageRights} />
            <TextBlock title="Review timeline" value={challenge.reviewDeadline} />
          </div>
        </section>
        <aside className="space-y-2.5">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Eligibility</p>
            <p className="mt-1 text-[13px] font-semibold text-white">{challenge.eligibilityLabel}</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">Submission access is rechecked server-side on every save and finalize action.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Review criteria</p>
            <ul className="mt-1.5 space-y-1 text-[11px] text-slate-300">
              {challenge.judgingCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}
            </ul>
          </div>
        </aside>
      </div>
      <section className="mt-2.5">
        {!wallet.available ? (
          <CreatorPayoutWalletSetup appId={appId} available={wallet.available} />
        ) : challenge.acceptsSubmissions || challenge.submission ? (
          <CreatorSubmissionForm
            draftId={challenge.draftId}
            initialTitle={challenge.submission?.title ?? ""}
            initialDescription={challenge.submission?.description ?? ""}
            initialPrimaryAssetUrl={challenge.submission?.primaryAssetUrl ?? ""}
            initialSupportingLinks={challenge.submission?.supportingLinks ?? []}
            isSubmitted={submitted}
          />
        ) : (
          <EmptyState title="Submissions closed" detail="This challenge is not currently accepting creator submissions." />
        )}
      </section>
    </>
  );
}

function TextBlock({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-0.5 leading-4 text-slate-400">{value || "Not provided"}</p>
    </div>
  );
}

export function CreatorSubmissionsPage({ submissions }: { session: CreatorSession; submissions: CreatorSubmissionListItem[] }) {
  return (
    <>
      <SectionHeader eyebrow="Creator Workspace" title="My Submissions" />
      {submissions.length ? (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
          {submissions.map((item) => <SubmissionRow key={item.submissionId} item={item} />)}
        </div>
      ) : (
        <EmptyState title="No submissions yet" detail="Eligible challenge entries will appear here after you save or submit." />
      )}
    </>
  );
}

export function CreatorSubmissionDetailPage({ submission }: { session: CreatorSession; submission: CreatorSubmissionDetail }) {
  return (
    <>
      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] text-cyan-200">{submission.challengeTitle}</p>
            <h1 className="mt-1 text-lg font-semibold text-white">{submission.title}</h1>
            <p className="mt-1 text-[12px] text-slate-400">{submission.anonymousEntryCode}</p>
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(submission.resultStatus)}`}>
            {submission.resultStatus}
          </span>
        </div>
        <div className="mt-2 grid gap-1.5 md:grid-cols-3">
          <Info label="Updated" value={submission.updatedAt} />
          <Info label="Submitted" value={submission.submittedAt ?? "Draft"} />
          <Info label="Immutable" value={submission.immutable ? "Yes" : "No"} />
        </div>
        <div className="mt-2.5 space-y-2 text-[12px] text-slate-300">
          <TextBlock title="Description" value={submission.description} />
          <TextBlock title="Main project link" value={submission.primaryAssetUrl} />
          <TextBlock title="Supporting links" value={submission.supportingLinks.join(", ") || "None"} />
        </div>
      </section>
      {submission.reward ? (
        <section className="mt-2.5">
          <Panel title="Reward">
            <RewardRow reward={submission.reward} />
          </Panel>
        </section>
      ) : null}
    </>
  );
}

export function CreatorRewardsPage({ rewards }: { session: CreatorSession; rewards: CreatorRewardItem[] }) {
  return (
    <>
      <SectionHeader eyebrow="Creator Workspace" title="Rewards" />
      {rewards.length ? (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
          {rewards.map((reward) => <RewardRow key={reward.submissionId} reward={reward} />)}
        </div>
      ) : (
        <EmptyState title="No rewards yet" detail="Winner and payout evidence will appear here after settlement is complete." />
      )}
    </>
  );
}

export function CreatorWalletPage({ wallet, appId }: { session: CreatorSession; wallet: CreatorWalletSummary; appId: string }) {
  return (
    <>
      <SectionHeader eyebrow="Creator Workspace" title="Wallet" />
      <WalletPanel wallet={wallet} />
      <div className="mt-2.5">
        <CreatorPayoutWalletSetup appId={appId} available={wallet.available} />
      </div>
      <div className="mt-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-[11px] text-slate-400">
        Creator payout wallet activation stays inside the approved Circle Hosted Wallet architecture. This page never
        accepts an arbitrary payout address from the client.
      </div>
    </>
  );
}



export function CreatorNotificationsPage({ notifications }: { session: CreatorSession; notifications: CreatorNotificationItem[] }) {
  return (
    <>
      <SectionHeader eyebrow="Creator Workspace" title="Notifications" />
      {notifications.length ? (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
          {notifications.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="grid gap-2 border-b border-white/10 px-2.5 py-1.5 text-[11px] last:border-b-0 sm:grid-cols-[30px_minmax(0,1fr)_auto] sm:items-start"
            >
              <span className="grid h-7 w-7 place-items-center rounded-md bg-violet-500/15 text-[10px] font-bold text-violet-100" aria-hidden="true">
                {item.iconLabel}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-white">{item.headline}</span>
                <span className="mt-0.5 block text-slate-400">{item.message}</span>
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                {item.timeLabel}
                {item.unread ? <span className="h-2 w-2 rounded-full bg-violet-400" aria-label="Unread" /> : null}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="No notifications yet" detail="Submission, review, winner, and payout updates will appear here after canonical activity exists." />
      )}
    </>
  );
}

export function CreatorProfilePage({ session, wallet, profile }: { session: CreatorSession; wallet: CreatorWalletSummary; profile: CreatorProfileSummary }) {
  return (
    <>
      <SectionHeader eyebrow="Creator Workspace" title="Profile" />
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-blue-600 to-violet-700 text-sm font-semibold text-white">
              {profile.avatarImageUrl ? <img src={profile.avatarImageUrl} alt="" className="h-full w-full object-cover" /> : profile.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-base font-semibold text-white">{profile.displayName}</p>
              <p className="mt-0.5 text-[12px] text-slate-400">{profile.username ? `@${profile.username}` : "Creator account"}</p>
            </div>
          </div>
          <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
            <Info label="Workspace" value="Creator" />
            <Info label="Account" value={maskId(session.ccnAccountId)} />
          </div>
<CreatorProfileForm
            initialDisplayName={profile.displayName}
            initialUsername={profile.username ?? ""}
            initialCountry={profile.country ?? ""}
            initialAvatarImageKey={profile.avatarImageKey}
            initialAvatarImageUrl={profile.avatarImageUrl}
          />
        </section>
        <WalletPanel wallet={wallet} />
      </div>
    </>
  );
}
