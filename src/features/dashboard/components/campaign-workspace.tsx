/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CCNLogo } from "@/components/ui/ccn-logo";
import { CampaignWorkspaceTabs } from "./campaign-workspace-tabs";
import { AiTemplatesBetaButton, BrandAccountControls, type BrandAccountControlsProps } from "@/features/dashboard/components/brand-workspace-navigation";
import {
  CREATE_CHALLENGE_BRAND_ACCOUNT_ID,
  CREATE_CHALLENGE_ESCROW_CONTRACT,
  type ApprovalAttemptRecord,
  type FundingAttemptRecord,
  type OnChainVerificationRecord,
  type WinnerFinalizationAttemptRecord,
} from "@/services/create-challenge/create-challenge-store.server";
import { resolveCampaignCover } from "@/services/media/brand-media.server";
import type { CreateChallengeDraftState } from "@/types/create-challenge";
import type { SubmissionReviewRecord } from "@/types/review";
import type { BlindReviewEntry } from "@/types/submission";
import { parseChallengeDeadline } from "@/utils/challenge-deadlines";

type CampaignWorkspaceProps = {
  draft: CreateChallengeDraftState;
  approvalAttempts: ApprovalAttemptRecord[];
  fundingAttempts: FundingAttemptRecord[];
  winnerAttempt: WinnerFinalizationAttemptRecord | null;
  verification: OnChainVerificationRecord | null;
  blindEntries: BlindReviewEntry[];
  reviewScores: SubmissionReviewRecord[];
  circleAppId: string;
  accountControls: BrandAccountControlsProps;
};

type LifecycleState =
  | "draft"
  | "funding"
  | "published"
  | "review"
  | "closed-not-enough-submissions"
  | "winner"
  | "settlement"
  | "completed";

type PrimaryAction = {
  label: string;
  href: string;
  primary: boolean;
  external?: boolean;
};

type ActivityItem = {
  label: string;
  detail: string;
  at?: string;
  tone: "blue" | "green" | "amber" | "violet";
};

const lifecycleOrder: { id: LifecycleState; label: string }[] = [
  { id: "draft", label: "Problem Draft" },
  { id: "funding", label: "Funding" },
  { id: "published", label: "Open for Solutions" },
  { id: "review", label: "Evaluation" },
  { id: "winner", label: "Selection" },
  { id: "settlement", label: "Settlement" },
  { id: "completed", label: "Completed" },
];

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Business Challenges", href: "/dashboard/campaigns" },
  { label: "Wallet", href: "/dashboard/wallet" },
  { label: "Payments", href: "/dashboard/payments" },
  { label: "Settings", href: "/dashboard/settings/profile" },
];

function formatDate(value?: string) {
  if (!value) return "Not set";
  const parsed = parseChallengeDeadline(value);
  const date = parsed ? new Date(parsed.iso) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatUnits(value?: string) {
  if (!value) return "Not available";
  try {
    const divisor = BigInt(1_000_000);
    const units = BigInt(value);
    const whole = units / divisor;
    const fraction = (units % divisor).toString().padStart(6, "0").replace(/0+$/, "");
    return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ""} test USDC`;
  } catch {
    return "Not available";
  }
}

function mask(value?: string | null) {
  if (!value) return "Not available";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getArcScanTxUrl(txHash: string) {
  return `https://testnet.arcscan.app/tx/${txHash}`;
}

function currentLifecycleState(input: {
  draft: CreateChallengeDraftState;
  winnerAttempt: WinnerFinalizationAttemptRecord | null;
  submissionCount: number;
}) {
  const { draft, winnerAttempt, submissionCount } = input;
  if (winnerAttempt?.state === "PAYOUT_CONFIRMED") return "completed";
  if (
    winnerAttempt?.state === "TRANSACTION_SUBMITTED" ||
    winnerAttempt?.state === "RECONCILIATION_REQUIRED" ||
    winnerAttempt?.state === "ACTION_REQUIRED" ||
    winnerAttempt?.state === "APPROVAL_CREATED_RECONCILIATION_REQUIRED"
  ) {
    return "settlement";
  }
  if (winnerAttempt?.finalizedAt) return "settlement";
  if (winnerAttempt?.state === "READY_FOR_FINAL_SELECTION") return "winner";
  const submissionDeadline = parseChallengeDeadline(draft.reviewRules.submissionDeadline);
  const deadlineClosed = Boolean(submissionDeadline && Date.now() >= submissionDeadline.unix * 1000);
  if (
    draft.deployment.publicationStatus === "live" &&
    deadlineClosed &&
    submissionCount > 0 &&
    submissionCount < draft.prizePool.winnerCount
  ) {
    return "closed-not-enough-submissions";
  }
  if (draft.deployment.publicationStatus === "live" && submissionCount > 0) return "review";
  if (draft.deployment.publicationStatus === "live") return "published";
  if (
    draft.deployment.publicationStatus === "ready-to-publish" ||
    draft.funding.fundingStatus === "funded" ||
    draft.funding.escrowStatus === "verified"
  ) {
    return "published";
  }
  if (
    draft.deployment.currentStep === "funding" ||
    draft.deployment.currentStep === "publish" ||
    draft.funding.fundingStatus !== "not-started"
  ) {
    return "funding";
  }
  return "draft";
}

function statusLabel(state: LifecycleState) {
  switch (state) {
    case "completed":
      return "Completed";
    case "settlement":
      return "Settlement";
    case "winner":
      return "Selection ready";
    case "review":
      return "In evaluation";
    case "closed-not-enough-submissions":
      return "Closed - Not Enough Submissions";
    case "published":
      return "Open for Solutions";
    case "funding":
      return "Funding";
    default:
      return "Problem Draft";
  }
}

function statusClassName(state: LifecycleState) {
  if (state === "completed") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  if (state === "funding" || state === "settlement") return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  if (state === "published" || state === "review" || state === "winner") return "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
  if (state === "closed-not-enough-submissions") return "border-slate-400/35 bg-slate-400/10 text-slate-200";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function activityToneClass(tone: ActivityItem["tone"] = "blue") {
  if (tone === "green") return "bg-emerald-400/15 text-emerald-200";
  if (tone === "amber") return "bg-amber-400/15 text-amber-200";
  if (tone === "violet") return "bg-violet-400/15 text-violet-200";
  return "bg-blue-400/15 text-blue-200";
}

function activityFeed(input: CampaignWorkspaceProps): ActivityItem[] {
  const { draft, fundingAttempts, approvalAttempts, winnerAttempt, verification, blindEntries } = input;
  const events: ActivityItem[] = [
    {
      label: "Business challenge created",
      detail: draft.challenge.brandName || CREATE_CHALLENGE_BRAND_ACCOUNT_ID,
      at: draft.updatedAt,
      tone: "blue",
    },
    ...approvalAttempts.map((attempt) => ({
      label: "Payment approval updated",
      detail: attempt.circleStatus,
      at: attempt.updatedAt,
      tone: "violet" as const,
    })),
    ...fundingAttempts.map((attempt) => ({
      label: attempt.transactionHash ? "Funding transaction recorded" : "Funding attempt updated",
      detail: attempt.transactionHash ? mask(attempt.transactionHash) : attempt.circleStatus,
      at: attempt.updatedAt,
      tone: "green" as const,
    })),
    ...(draft.funding.eventVerified
      ? [{
          label: "Funding confirmed",
          detail: mask(draft.funding.transactionHash),
          at: verification?.verifiedAt ?? draft.updatedAt,
          tone: "green" as const,
        }]
      : []),
    ...(draft.deployment.publicationStatus === "live"
      ? [{
          label: "Opened",
          detail: draft.challenge.slug ?? "Public challenge is live",
          at: draft.updatedAt,
          tone: "blue" as const,
        }]
      : []),
    ...blindEntries.map((entry) => ({
      label: "Submission received",
      detail: entry.anonymousEntryCode,
      at: entry.submittedAt,
      tone: "amber" as const,
    })),
    ...(winnerAttempt?.finalizedAt
      ? [{
          label: "Solution selected",
          detail: `${winnerAttempt.selectedWinnerEntryIds.length} anonymous entry`,
          at: winnerAttempt.finalizedAt,
          tone: "amber" as const,
        }]
      : []),
    ...(winnerAttempt?.approvalCreatedAt
      ? [{
          label: "Payout approval requested",
          detail: mask(winnerAttempt.circleChallengeId),
          at: winnerAttempt.approvalCreatedAt,
          tone: "violet" as const,
        }]
      : []),
    ...(winnerAttempt?.transactionHash
      ? [{
          label: "Payout executed",
          detail: mask(winnerAttempt.transactionHash),
          at: winnerAttempt.lastCheckedAt ?? winnerAttempt.updatedAt,
          tone: "blue" as const,
        }]
      : []),
    ...(winnerAttempt?.payoutConfirmedAt
      ? [{
          label: "Payout verified on Arc",
          detail: mask(winnerAttempt.transactionHash),
          at: winnerAttempt.payoutConfirmedAt,
          tone: "green" as const,
        }]
      : []),
  ];

  return events
    .filter((event) => Boolean(event.at))
    .sort((left, right) => new Date(right.at ?? 0).getTime() - new Date(left.at ?? 0).getTime());
}

function primaryActions(input: {
  draft: CreateChallengeDraftState;
  state: LifecycleState;
  submissionCount: number;
  fundingTx?: string;
  payoutTx?: string;
}): PrimaryAction[] {
  const { draft, state, submissionCount, fundingTx, payoutTx } = input;
  const draftId = draft.challenge.id ?? "";
  const workspaceHref = `/dashboard/challenges/${encodeURIComponent(draftId)}`;
  const publicSlug = draft.challenge.slug ? `/challenges/${draft.challenge.slug}` : workspaceHref;
  const actions: PrimaryAction[] = [];

  if (state === "draft" || state === "funding") {
    actions.push({ label: "Continue Funding", href: `/create-challenge?draftId=${encodeURIComponent(draftId)}`, primary: true });
  } else if (draft.deployment.publicationStatus === "ready-to-publish") {
    actions.push({ label: "Open Business Challenge", href: `/create-challenge?draftId=${encodeURIComponent(draftId)}`, primary: true });
  } else if (state === "published") {
    actions.push({ label: "View Public Challenge", href: publicSlug, primary: false });
  } else if (state === "review" && submissionCount > 0) {
    actions.push({ label: "Evaluate Solutions", href: "#review", primary: true });
    actions.push({ label: "View Public Challenge", href: publicSlug, primary: false });
  } else if (state === "closed-not-enough-submissions") {
    actions.push({ label: "View Public Challenge", href: publicSlug, primary: false });
  } else if (state === "winner") {
    actions.push({ label: "Finalize Winner", href: "#finalize-review", primary: true });
    actions.push({ label: "Review Submissions", href: "#review", primary: false });
  } else if (state === "settlement") {
    actions.push({ label: "Approve Payout", href: `/dashboard/challenges/${encodeURIComponent(draftId)}#settlement`, primary: true });
    actions.push({ label: "Review Submissions", href: "#review", primary: false });
  } else if (state === "completed") {
    if (payoutTx) {
      actions.push({ label: "View Payout Transaction", href: `https://testnet.arcscan.app/tx/${payoutTx}`, primary: true, external: true });
    }
    actions.push({ label: "Export Report", href: "#activity-feed", primary: false });
  }

  if (fundingTx) {
    actions.push({ label: "View funding transaction", href: `https://testnet.arcscan.app/tx/${fundingTx}`, primary: false, external: true });
  }
  if (state === "completed" && payoutTx) {
    actions.push({ label: "View payout transaction", href: `https://testnet.arcscan.app/tx/${payoutTx}`, primary: false, external: true });
  }

  return actions;
}
function navIcon(label: string) {
  const icons: Record<string, string> = {
    Dashboard: "D",
    Campaigns: "C",
    Templates: "T",
    Analytics: "A",
    Wallet: "W",
    Payments: "P",
    Team: "M",
    Settings: "S",
  };
  return icons[label] ?? label.slice(0, 1);
}

export function CampaignWorkspace(props: CampaignWorkspaceProps) {
  const { draft, approvalAttempts, fundingAttempts, winnerAttempt, verification, blindEntries, reviewScores, circleAppId, accountControls } = props;
  const challengeId = draft.challenge.challengeId ?? draft.deployment.challengeId;
  const submissionCount = blindEntries.length;
  const creatorCount = new Set(blindEntries.map((entry) => entry.anonymousEntryCode)).size;
  const state = currentLifecycleState({ draft, winnerAttempt, submissionCount });
  const currentIndex = state === "closed-not-enough-submissions"
    ? lifecycleOrder.findIndex((item) => item.id === "review")
    : lifecycleOrder.findIndex((item) => item.id === state);
  const activities = activityFeed(props);
  const fundingTx = draft.funding.transactionHash || fundingAttempts.find((attempt) => attempt.transactionHash)?.transactionHash;
  const payoutTx = winnerAttempt?.transactionHash;
  const actions = primaryActions({ draft, state, submissionCount, fundingTx, payoutTx });
  const approval = approvalAttempts.at(-1);
  const funding = fundingAttempts.at(-1);
  const isVerified = Boolean(verification?.eventVerified || draft.funding.eventVerified);
  const completedReviewCount = reviewScores.filter((review) => review.status === "COMPLETED").length;
  const reviewProgress = submissionCount > 0 ? `${completedReviewCount}/${submissionCount}` : "0/0";
  const nextAction = actions[0]?.label ?? "No action";
  const campaignHealth = winnerAttempt?.state === "PAYOUT_CONFIRMED"
      ? "Settled"
    : winnerAttempt?.finalizedAt
      ? "Winner locked"
    : state === "closed-not-enough-submissions"
      ? "Closed"
    : isVerified
      ? submissionCount > 0
        ? "Healthy"
        : "Waiting for creators"
      : state === "funding"
        ? "Needs funding"
        : "In progress";
  const overviewCards = [
    { label: "Prize Pool", value: `${draft.prizePool.totalAmount.toLocaleString()} USDC`, detail: `Top ${draft.prizePool.winnerCount}`, tone: "blue" as const },
    { label: "Evaluation Progress", value: reviewProgress, detail: winnerAttempt?.finalizedAt ? "locked" : "blind evaluation", tone: "violet" as const },
    { label: "Submissions", value: String(submissionCount), detail: "entries", tone: "amber" as const },
    { label: "Funding Status", value: isVerified ? "Verified" : statusLabel(state), detail: draft.funding.escrowStatus, tone: "green" as const },
    { label: "Next Action", value: nextAction, detail: actions.length > 1 ? `${actions.length} actions available` : "current lifecycle", tone: "blue" as const },
    { label: "Challenge Status", value: campaignHealth, detail: winnerAttempt?.state === "PAYOUT_CONFIRMED" ? "completed" : draft.deployment.publicationStatus, tone: isVerified ? "green" as const : "amber" as const },
  ];
  const fundingItems = [
    { label: "Current funding", value: formatUnits(draft.prizePool.totalRequiredUnits) },
    { label: "Approval", value: approval ? `${approval.circleStatus} / ${mask(approval.transactionHash)}` : "No approval attempt" },
    { label: "Funding attempts", value: String(fundingAttempts.length) },
    {
      label: "Transaction",
      value: fundingTx ? (
        <a
          href={getArcScanTxUrl(fundingTx)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-sm text-cyan-200 underline-offset-2 transition hover:text-cyan-100 hover:underline focus:outline-none focus:ring-2 focus:ring-cyan-300/50"
        >
          {mask(fundingTx)}
        </a>
      ) : (
        mask(fundingTx)
      ),
    },
    { label: "Latest funding state", value: funding ? funding.circleStatus : draft.funding.fundingStatus },
  ];
  const creatorItems = [
    { label: "Participants", value: String(creatorCount) },
    { label: "Submission count", value: String(submissionCount) },
    { label: "Anonymous state", value: draft.reviewRules.blindReview ? "Anonymous until review" : "Identity visible" },
  ];
  const settlementFundingAmount = formatUnits(draft.prizePool.totalRequiredUnits);
  const blockchainItems = [
    { label: "Arc contract", value: mask(CREATE_CHALLENGE_ESCROW_CONTRACT) },
    { label: "Funding", value: fundingTx ? mask(fundingTx) : "No funding transaction" },
    { label: "Payout", value: payoutTx ? mask(payoutTx) : "No payout transaction" },
    { label: "Verification", value: isVerified ? "Verified" : "No verified transaction yet" },
  ];
  const cover = resolveCampaignCover({
    coverImageKey: draft.challenge.coverImageKey,
    coverImageAlt: draft.challenge.coverImageAlt,
    title: draft.challenge.title,
    category: draft.challenge.category,
  });

  return (
    <main className="min-h-screen bg-[#020713] text-white">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[276px] border-r border-white/10 bg-[#050a14]/95 px-5 py-6 xl:block">
        <Link href="/dashboard" className="flex items-center gap-3">
          <CCNLogo size="md" priority />
        </Link>

        <div className="mt-6 block rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
          <p className="text-[10px] uppercase tracking-[0.07em] text-slate-500">Brand</p>
          <div className="mt-1 flex items-center justify-between text-[12px] font-semibold text-slate-200">
            <span>Workspace</span>
            <span className="text-slate-500">v</span>
          </div>
        </div>

        <nav className="mt-4 space-y-1">
          {navItems.slice(0, 4).map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition ${
                item.label === "Campaigns"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-950/30"
                  : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <span className="grid h-5 w-5 place-items-center rounded-md border border-white/10 text-[10px]">{navIcon(item.label)}</span>
              {item.label}
            </Link>
          ))}
          <AiTemplatesBetaButton />
          {navItems.slice(4).map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              <span className="grid h-5 w-5 place-items-center rounded-md border border-white/10 text-[10px]">{navIcon(item.label)}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="absolute inset-x-5 bottom-24 rounded-xl border border-violet-300/20 bg-gradient-to-br from-violet-600/25 to-blue-600/10 p-2.5">
        <p className="text-[13px] font-semibold">Solution Ops</p>
        <p className="mt-1 text-[11px] leading-4 text-slate-300">Track funding, solution submissions, evaluation and settlement from one workspace.</p>
        </div>

        <div className="absolute inset-x-5 bottom-5 flex items-center gap-2.5 border-t border-white/10 pt-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-[12px] font-semibold">
            FK
          </div>
          <div>
            <p className="text-[12px] font-semibold">Firat Kaya</p>
            <p className="text-[11px] text-slate-400">Brand Admin</p>
          </div>
        </div>
      </aside>

      <section className="min-h-screen xl:pl-[276px]">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#020713]/90 px-4 py-2 backdrop-blur md:px-5">
          <div className="mx-auto flex max-w-[1580px] items-center justify-between gap-3">
            <Link href="/dashboard" className="text-[13px] font-semibold text-cyan-200 transition hover:text-cyan-100">
              Back to dashboard
            </Link>
            <div className="hidden h-9 min-w-[360px] items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 text-[12px] text-slate-400 lg:flex">
              <span className="text-sm">Q</span>
              <span>Search Business Challenges...</span>
              <span className="ml-auto rounded-md border border-white/10 px-1.5 py-0.5 text-[10px]">K</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] md:block">
                <p className="font-semibold">{mask(draft.funding.walletAddress)}</p>
                <p className="text-xs text-blue-300">Challenge funding: {formatUnits(draft.prizePool.totalRequiredUnits)}</p>
              </div>
              <BrandAccountControls {...accountControls} />
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1580px] px-3 py-3 md:px-5">
          <section id="campaign-header" className="rounded-xl border border-white/10 bg-[#0a1020]/90 p-2.5 shadow-lg shadow-black/20">
            {cover.imageUrl ? (
              <img src={cover.imageUrl} alt={cover.alt} className="mb-2 aspect-[16/5] max-h-[150px] w-full rounded-md border border-white/10 object-cover" />
            ) : null}
            <div className="flex flex-wrap items-start justify-between gap-2.5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-cyan-200">Business Challenge Workspace</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h1 className="max-w-4xl text-[17px] font-semibold leading-[1.12] tracking-normal md:text-[19px]">
                    {draft.challenge.title || "Untitled Business Challenge"}
                  </h1>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClassName(state)}`}>
                    {statusLabel(state)}
                  </span>
                </div>
              </div>
              <div className="text-right text-[12px] text-slate-400">
                <p>Deadline</p>
                <p className="mt-1 font-semibold text-white">{formatDate(draft.reviewRules.submissionDeadline)}</p>
              </div>
            </div>

            <div className="mt-2 grid gap-1.5 md:grid-cols-2 xl:grid-cols-5">
              <Info label="Current State" value={statusLabel(state)} />
              <Info label="Deadline" value={formatDate(draft.reviewRules.submissionDeadline)} />
              <Info label="Funding Status" value={isVerified ? "Verified" : draft.funding.fundingStatus} />
              <Info label="Evaluation Progress" value={reviewProgress} />
              <Info label="Next Action" value={nextAction} />
            </div>
            <div className="mt-1.5 grid gap-1.5 text-slate-300 md:grid-cols-3">
              <Info label="Brand" value={draft.challenge.brandName || "Brand not set"} quiet />
              <Info label="Challenge ID" value={mask(challengeId)} quiet />
              <Info label="Wallet" value={mask(draft.funding.walletAddress)} quiet />
            </div>
          </section>

          <Section id="lifecycle-timeline" title="Challenge Progress" className="mt-2.5">
            <div className="grid gap-1.5 md:grid-cols-7">
              {lifecycleOrder.map((item, index) => {
                const completed = index < currentIndex;
                const active = index === currentIndex;
                return (
                  <div
                    key={item.id}
                    className={`rounded-md border p-2 ${
                      active
                        ? "border-cyan-300/40 bg-cyan-300/10 shadow-lg shadow-cyan-950/20"
                        : completed
                          ? "border-emerald-300/25 bg-emerald-300/10"
                          : "border-white/10 bg-slate-950/40 opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold ${
                          completed
                            ? "bg-emerald-400 text-slate-950"
                            : active
                              ? "bg-cyan-300 text-slate-950"
                              : "bg-white/10 text-slate-400"
                        }`}
                      >
                        {completed ? "OK" : index + 1}
                      </span>
                      <p className="text-[11px] font-semibold">{item.label}</p>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">{active ? "Current state" : completed ? "Completed" : "Locked"}</p>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section id="activity-feed" title="Activity" className="mt-2.5">
            <div className="grid gap-1.5 lg:grid-cols-2">
              {activities.length ? (
                activities.slice(0, 6).map((event) => (
                  <div key={`${event.label}-${event.at}-${event.detail}`} className="flex gap-2 rounded-md border border-white/10 bg-slate-950/40 p-2">
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-[10px] font-semibold ${activityToneClass(event.tone)}`}>
                      {event.label.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-white">{event.label}</p>
                      <p className="mt-0.5 break-all text-[11px] leading-4 text-slate-300">{event.detail}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{event.at ? new Date(event.at).toLocaleString() : "Not available"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-white/15 bg-slate-950/30 p-3 text-[12px] text-slate-400">
                  No activity recorded yet.
                </div>
              )}
            </div>
          </Section>

          <CampaignWorkspaceTabs
            draftId={draft.challenge.id ?? ""}
            blindEntries={blindEntries}
            initialReviews={reviewScores}
            reviewCriteria={draft.reviewRules.judgingCriteria}
            overviewCards={overviewCards}
            actions={actions}
            fundingItems={fundingItems}
            creatorItems={creatorItems}
            blockchainItems={blockchainItems}
            winnerAttempt={winnerAttempt}
            winnerCount={draft.prizePool.winnerCount}
            finalizationUnavailableReason={state === "closed-not-enough-submissions" ? "This Business Challenge received fewer eligible Solution Proposals than the configured Winner count." : undefined}
            circleAppId={circleAppId}
            prizePool={formatUnits(draft.prizePool.prizePoolUnits)}
            fundedAmount={settlementFundingAmount}
            fundingTransaction={mask(fundingTx)}
            escrowStatus={draft.funding.escrowStatus}
            contractAddress={mask(CREATE_CHALLENGE_ESCROW_CONTRACT)}
            verificationState={isVerified ? "Verified" : "Not verified"}
          />
        </div>
      </section>
    </main>
  );
}

function Section({ id, title, className = "", children }: { id?: string; title: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-24 rounded-xl border border-white/10 bg-[#0a1020]/90 p-2.5 shadow-lg shadow-black/10 ${className}`}>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-300">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Info({ label, value, quiet = false }: { label: string; value: string; quiet?: boolean }) {
  return (
    <div className={quiet ? "rounded-md border border-white/10 bg-slate-950/25 p-1.5" : "rounded-md border border-white/10 bg-slate-950/40 p-1.5"}>
      <dt className="text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-400">{label}</dt>
      <dd className={quiet ? "mt-0.5 break-words text-[11px] font-medium text-slate-300" : "mt-0.5 break-words text-[11px] font-semibold text-white"}>{value}</dd>
    </div>
  );
}
