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
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {props.eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">{props.eyebrow}</p>
        ) : null}
        <h2 className="mt-1 text-xl font-semibold text-white">{props.title}</h2>
      </div>
      {props.action}
    </div>
  );
}

function EmptyState(props: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300">
      <p className="font-semibold text-white">{props.title}</p>
      <p className="mt-2 text-slate-400">{props.detail}</p>
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
          <CCNLogo size="lg" priority />
        </Link>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Workspace</p>
          <p className="mt-1 font-semibold text-white">Creator Workspace</p>
        </div>
        <CreatorWorkspaceNav />
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-blue-600 to-violet-700 text-xs font-bold text-white">
              {identity.avatarImageUrl ? <img src={identity.avatarImageUrl} alt="" className="h-full w-full object-cover" /> : identity.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{identity.displayName}</p>
              <p className="mt-1 truncate text-xs text-slate-400">{identity.username ? `@${identity.username}` : "Creator account"}</p>
            </div>
          </div>
        </div>
      </aside>
      <section className="min-h-screen px-4 py-4 sm:px-6 lg:ml-[270px] lg:px-8 xl:px-8">
        <header className="mb-7 flex items-center justify-between gap-4">
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
        <div className="mb-5 lg:hidden">
          <CreatorWorkspaceNav />
        </div>
        {children}
      </section>
    </main>
  );
}

function ChallengeCard({ challenge }: { challenge: CreatorChallengeCard }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-cyan-300/30">
      {challenge.coverImageUrl ? (
        <img src={challenge.coverImageUrl} alt={challenge.coverImageAlt} className="mb-5 aspect-[16/9] w-full rounded-xl border border-white/10 object-cover" />
      ) : (
        <div className="mb-5 grid aspect-[16/9] w-full place-items-center rounded-xl border border-white/10 bg-[#070b14] text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Cover unavailable
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{challenge.brandName}</p>
          <h3 className="mt-1 text-lg font-semibold text-white">{challenge.title}</h3>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(challenge.submissionStatus)}`}>
          {challenge.submissionStatus}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-white/10 bg-[#070b14] p-3">
          <p className="text-slate-500">Prize Pool</p>
          <p className="mt-1 font-semibold text-cyan-200">{challenge.prizePool}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#070b14] p-3">
          <p className="text-slate-500">Deadline</p>
          <p className="mt-1 font-semibold text-white">{challenge.submissionDeadline}</p>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">{challenge.category}</span>
        <Link href={`/dashboard/creator/challenges/${challenge.slug}`} className="text-sm font-semibold text-blue-300 hover:text-blue-200">
          {challenge.actionLabel} &rarr;
        </Link>
      </div>
    </article>
  );
}

function SubmissionRow({ item }: { item: CreatorSubmissionListItem }) {
  return (
    <div className="grid gap-4 border-b border-white/10 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[1.4fr_1fr_0.8fr_auto] md:items-center">
      <div>
        <p className="font-semibold text-white">{item.title}</p>
        <p className="mt-1 text-slate-400">{item.challengeTitle}</p>
      </div>
      <p className="text-slate-300">{item.anonymousEntryCode}</p>
      <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
        {item.status}
      </span>
      <Link href={`/dashboard/creator/submissions/${item.submissionId}`} className="font-semibold text-blue-300 hover:text-blue-200">
        {item.actionLabel}
      </Link>
    </div>
  );
}

function RewardRow({ reward }: { reward: CreatorRewardItem }) {
  return (
    <div className="grid gap-4 border-b border-white/10 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto] md:items-center">
      <div>
        <p className="font-semibold text-white">{reward.challengeTitle}</p>
        <p className="mt-1 text-slate-400">{reward.brandName}</p>
      </div>
      <p className="font-semibold text-cyan-200">{reward.amount}</p>
      <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(reward.status)}`}>
        {reward.status}
      </span>
      <p className="text-slate-400">{reward.transactionHash ? maskId(reward.transactionHash) : "No verified tx"}</p>
    </div>
  );
}

function MetricCard({ metric }: { metric: CreatorMetricItem }) {
  return <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/10"><div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-violet-400/20 bg-violet-500/15 text-sm font-bold text-violet-100" aria-hidden="true">{metric.iconLabel}</span><div className="min-w-0"><p className="text-xs leading-4 text-slate-400">{metric.label}</p><p className="mt-1 text-xl font-semibold leading-none text-white">{metric.value}</p><p className="mt-1 text-xs text-slate-500">{metric.detail}</p></div></div></article>;
}

function CompactChallengeCard({ challenge }: { challenge: CreatorChallengeCard }) {
  return <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/10 transition hover:border-violet-300/25"><div className="relative">{challenge.coverImageUrl ? <img src={challenge.coverImageUrl} alt={challenge.coverImageAlt} className="aspect-[16/8] w-full object-cover" /> : <div className="grid aspect-[16/8] w-full place-items-center bg-[#070d19] text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Cover unavailable</div>}{challenge.featured ? <span className="absolute left-4 top-4 rounded-md bg-violet-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white">Featured</span> : null}<span className="absolute right-4 top-4 rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-100">{challenge.timeLeftLabel}</span></div><div className="p-4"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-xs font-bold text-slate-950">{(challenge.brandName || "B").slice(0, 1).toUpperCase()}</span><p className="truncate text-sm font-semibold text-white">{challenge.brandName}</p></div><h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-white">{challenge.title}</h3><p className="mt-1 text-sm text-slate-400">{challenge.category}</p><div className="mt-4 flex items-end justify-between gap-3 border-t border-white/10 pt-3"><div><p className="text-lg font-semibold text-white">{challenge.prizePool}</p><p className="mt-1 text-xs text-slate-500">Prize Pool</p></div><Link href={`/dashboard/creator/challenges/${challenge.slug}`} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500">View Challenge</Link></div><p className="mt-3 text-xs text-slate-500">{challenge.submissionCountLabel}</p></div></article>;
}

function NextActionHero({ action }: { action: CreatorNextAction }) {
  return <section className="relative overflow-hidden rounded-2xl border border-violet-300/20 bg-[radial-gradient(circle_at_30%_20%,rgba(143,64,255,0.34),transparent_32%),linear-gradient(125deg,#5916af_0%,#2624a9_48%,#0755bb_100%)] p-6 shadow-2xl shadow-violet-950/20 lg:min-h-[205px]">{action.metaLabel ? <span className="absolute right-5 top-5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">{action.metaLabel}</span> : null}<div className="relative z-10 flex h-full flex-col justify-between gap-8"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-100">Next Action</p><h2 className="mt-5 text-2xl font-semibold leading-tight text-white md:text-3xl">{action.headline}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-violet-100/85">{action.detail}</p></div><div className="flex flex-wrap items-end justify-between gap-4"><p className="text-sm text-violet-100/80">{action.statusLabel}</p><Link href={action.href} className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-black/10 transition hover:bg-violet-50">{action.ctaLabel} <span className="ml-2" aria-hidden="true">-&gt;</span></Link></div></div></section>;
}

function NotificationsPreview({ notifications }: { notifications: CreatorNotificationItem[] }) {
  return <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/10"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-white">Notifications</h2><Link href="/dashboard/creator/notifications" className="text-sm font-semibold text-violet-300 transition hover:text-violet-200">View all -&gt;</Link></div><div className="mt-5 space-y-1">{notifications.length ? notifications.slice(0, 4).map((item) => <Link key={item.id} href={item.href} className="grid grid-cols-[42px_minmax(0,1fr)_auto] gap-3 border-b border-white/10 py-3 last:border-b-0"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-sm font-bold text-violet-100" aria-hidden="true">{item.iconLabel}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{item.headline}</span><span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-400">{item.message}</span></span><span className="flex flex-col items-end gap-2 text-xs text-slate-500">{item.timeLabel}{item.unread ? <span className="h-2 w-2 rounded-full bg-violet-400" aria-label="Unread" /> : null}</span></Link>) : <EmptyState title="No notifications yet" detail="Submission, review, winner, and payout events will appear here when they exist." />}</div></section>;
}

function WalletRailCard({ wallet }: { wallet: CreatorWalletSummary }) {
  return <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/10"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200">Payout Wallet</p><p className="mt-6 text-sm text-slate-400">USDC Balance</p><p className="mt-2 text-2xl font-semibold text-white">{wallet.balanceLabel}</p><p className="mt-1 text-xs text-slate-500">{wallet.balanceDetail}</p></div><span className="grid h-16 w-16 place-items-center rounded-full bg-blue-600 text-3xl font-bold text-white shadow-xl shadow-blue-600/20" aria-hidden="true">$</span></div><p className={`mt-4 text-sm font-semibold ${wallet.available ? "text-emerald-300" : "text-amber-300"}`}>{wallet.available ? "Ready to receive rewards" : "Payout setup required"}</p><div className="mt-4 space-y-2"><Link href="/dashboard/creator/wallet" className="flex items-center justify-between rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500">View Wallet <span aria-hidden="true">-&gt;</span></Link><button type="button" disabled className="flex w-full cursor-not-allowed items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-500">Withdraw (Beta) <span aria-hidden="true">-&gt;</span></button></div></section>;
}

function CreatorHelpCard() {
  return <section className="overflow-hidden rounded-2xl border border-violet-300/20 bg-[radial-gradient(circle_at_85%_20%,rgba(124,58,237,0.36),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(124,58,237,0.12))] p-5"><h2 className="text-lg font-semibold text-white">Need help?</h2><p className="mt-2 max-w-xs text-sm leading-6 text-slate-300">Review the Creator Guide and learn how submissions, reviews, and rewards work on CCN.</p><Link href="/dashboard/creator/discover" className="mt-5 inline-flex rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]">Creator Guide</Link></section>;
}

export function CreatorOverviewPage({ overview }: { overview: CreatorWorkspaceOverview }) {
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]"><div className="min-w-0 space-y-6"><section className="grid gap-5 xl:grid-cols-[minmax(380px,1fr)_minmax(420px,600px)] xl:items-end"><div><p className="text-sm font-semibold text-violet-300">Creator Workspace</p><h1 className="mt-2 text-3xl font-semibold leading-tight text-white md:text-[34px]">Good afternoon, {overview.profile.displayName} <span aria-hidden="true">&#128075;</span></h1><p className="mt-2 text-base text-slate-400">Find opportunities, create amazing work, and earn rewards.</p></div><div className="grid gap-4 sm:grid-cols-3">{overview.metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div></section><NextActionHero action={overview.nextAction} /><section><SectionHeader title="Open Challenges" action={<Link href="/dashboard/creator/discover" className="text-sm font-semibold text-violet-300">View all challenges -&gt;</Link>} />{overview.availableChallenges.length ? <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{overview.availableChallenges.slice(0, 3).map((challenge) => <CompactChallengeCard key={challenge.draftId} challenge={challenge} />)}</div> : <EmptyState title="No open challenges right now" detail="Funded public briefs will appear here when they go live." />}</section><section><SectionHeader title="My Submissions" action={<Link href="/dashboard/creator/submissions" className="text-sm font-semibold text-violet-300">View all submissions -&gt;</Link>} />{overview.submissions.length ? <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045]">{overview.submissions.slice(0, 3).map((item) => <SubmissionRow key={item.submissionId} item={item} />)}</div> : <EmptyState title="No submissions yet" detail="Choose an open challenge to create your first entry." />}</section></div><aside className="space-y-5 xl:sticky xl:top-4 xl:self-start"><WalletRailCard wallet={overview.wallet} /><NotificationsPreview notifications={overview.notifications} /><CreatorHelpCard /></aside></div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionHeader title={title} />
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">{children}</div>
    </div>
  );
}

function WalletPanel({ wallet }: { wallet: CreatorWalletSummary }) {
  return (
    <div>
      <SectionHeader title="Wallet Readiness" />
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Payout wallet</p>
            <p className="mt-3 text-2xl font-semibold text-white">{wallet.available ? "Ready" : "Setup required"}</p>
            <p className="mt-2 text-sm text-slate-400">{wallet.available ? wallet.walletAddressMasked : "Set up your payout wallet before submitting."}</p>
          </div>
          <div className="grid gap-2">
            <CreatorWalletActions walletAddress={wallet.walletAddress} explorerUrl={wallet.explorerUrl} />
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-500"
            >
              Withdraw <span className="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]">Beta</span>
            </button>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-400">Creator withdrawals are being prepared for the beta release.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Info label="Network" value={wallet.network} />
          <Info label="Status" value={wallet.available ? "Ready" : wallet.walletState} />
          <Info label="Balance" value={wallet.balanceLabel} />
          <Info label="Balance source" value={wallet.balanceStatus === "ready" ? "Arc Testnet RPC" : wallet.balanceStatus === "error" ? "Retry required" : "Unavailable"} />
        </div>
        <p className="mt-4 text-sm text-slate-400">{wallet.balanceDetail}</p>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#070b14] p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

export function CreatorDiscoverPage({ challenges }: { session: CreatorSession; challenges: CreatorChallengeCard[] }) {
  return (
    <>
      <SectionHeader eyebrow="Creator Workspace" title="Discover Challenges" />
      {challenges.length ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {challenges.map((challenge) => <ChallengeCard key={challenge.draftId} challenge={challenge} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300"><p className="font-semibold text-white">No open challenges right now</p><p className="mt-2 text-slate-400">Only published, funded campaigns with active submission windows are shown.</p><Link href="/challenges" className="mt-4 inline-flex rounded-xl border border-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/[0.06]">Return to public challenges</Link></div>
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
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          {challenge.coverImageUrl ? (
            <img src={challenge.coverImageUrl} alt={challenge.coverImageAlt} className="mb-6 aspect-[16/7] w-full rounded-xl border border-white/10 object-cover" />
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-cyan-200">{challenge.brandName}</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">{challenge.title}</h1>
              <p className="mt-3 max-w-3xl text-slate-300">{challenge.summary}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(challenge.submissionStatus)}`}>
              {challenge.submissionStatus}
            </span>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <Info label="Prize Pool" value={challenge.prizePool} />
            <Info label="Deadline" value={challenge.submissionDeadline} />
            <Info label="Submissions" value={String(challenge.submissionCount)} />
          </div>
          <div className="mt-6 space-y-5 text-sm text-slate-300">
            <TextBlock title="Brief" value={challenge.description} />
            <TextBlock title="Primary deliverable" value={challenge.primaryDeliverable} />
            <TextBlock title="Usage rights" value={challenge.usageRights} />
            <TextBlock title="Review timeline" value={challenge.reviewDeadline} />
          </div>
        </section>
        <aside className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Eligibility</p>
            <p className="mt-3 text-lg font-semibold text-white">{challenge.eligibilityLabel}</p>
            <p className="mt-2 text-sm text-slate-400">Submission access is rechecked server-side on every save and finalize action.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Review criteria</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {challenge.judgingCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}
            </ul>
          </div>
        </aside>
      </div>
      <section className="mt-6">
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
      <p className="mt-1 leading-6 text-slate-400">{value || "Not provided"}</p>
    </div>
  );
}

export function CreatorSubmissionsPage({ submissions }: { session: CreatorSession; submissions: CreatorSubmissionListItem[] }) {
  return (
    <>
      <SectionHeader eyebrow="Creator Workspace" title="My Submissions" />
      {submissions.length ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
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
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-cyan-200">{submission.challengeTitle}</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{submission.title}</h1>
            <p className="mt-2 text-slate-400">{submission.anonymousEntryCode}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(submission.resultStatus)}`}>
            {submission.resultStatus}
          </span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Info label="Updated" value={submission.updatedAt} />
          <Info label="Submitted" value={submission.submittedAt ?? "Draft"} />
          <Info label="Immutable" value={submission.immutable ? "Yes" : "No"} />
        </div>
        <div className="mt-6 space-y-5 text-sm text-slate-300">
          <TextBlock title="Description" value={submission.description} />
          <TextBlock title="Main project link" value={submission.primaryAssetUrl} />
          <TextBlock title="Supporting links" value={submission.supportingLinks.join(", ") || "None"} />
        </div>
      </section>
      {submission.reward ? (
        <section className="mt-6">
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
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          {rewards.map((reward) => <RewardRow key={reward.submissionId} reward={reward} />)}
        </div>
      ) : (
        <EmptyState title="No rewards yet" detail="Winner and payout evidence will appear here after canonical settlement." />
      )}
    </>
  );
}

export function CreatorWalletPage({ wallet, appId }: { session: CreatorSession; wallet: CreatorWalletSummary; appId: string }) {
  return (
    <>
      <SectionHeader eyebrow="Creator Workspace" title="Wallet" />
      <WalletPanel wallet={wallet} />
      <div className="mt-6">
        <CreatorPayoutWalletSetup appId={appId} available={wallet.available} />
      </div>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400">
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
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          {notifications.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="grid gap-4 border-b border-white/10 px-5 py-4 text-sm last:border-b-0 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-start"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-500/15 text-sm font-bold text-violet-100" aria-hidden="true">
                {item.iconLabel}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-white">{item.headline}</span>
                <span className="mt-1 block text-slate-400">{item.message}</span>
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-violet-700 text-lg font-semibold text-white">
              {profile.avatarImageUrl ? <img src={profile.avatarImageUrl} alt="" className="h-full w-full object-cover" /> : profile.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{profile.displayName}</p>
              <p className="mt-1 text-sm text-slate-400">{profile.username ? `@${profile.username}` : "Creator account"}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
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
