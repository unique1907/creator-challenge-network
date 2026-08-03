import "server-only";

import { cache } from "react";
import {
  CREATE_CHALLENGE_BRAND_ACCOUNT_ID,
  CREATE_CHALLENGE_ESCROW_CONTRACT,
  listCreateChallengeDraftStates,
  listOnChainVerificationsForDraft,
  listWinnerFinalizationAttempts,
  type WinnerFinalizationAttemptRecord,
} from "@/services/create-challenge/create-challenge-store.server";
import { getCreatorProfileIdentity, getVerifiedCreatorPayoutWallet } from "@/services/creator-foundation/creator-foundation.server";
import { resolveAccountImageUrl, resolveCampaignCover } from "@/services/media/brand-media.server";
import {
  countSubmittedEntriesForChallenge,
  getCreatorSubmissionById,
  getCreatorSubmissionStatus,
  listCreatorSubmissions,
} from "@/services/submissions/submission-store.server";
import type { CreatorSession } from "@/services/creator-session.server";
import type { CreateChallengeDraftState } from "@/types/create-challenge";
import type { Submission } from "@/types/submission";
import { ARC_TESTNET_USDC_CONTRACT } from "@/services/circle/user-controlled-wallets.server";

export type CreatorSubmissionStatus =
  | "No submission"
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "Winner"
  | "Not Selected"
  | "Reward Processing"
  | "Reward Paid";

export type CreatorChallengeCard = {
  draftId: string;
  challengeId: string;
  slug: string;
  title: string;
  brandName: string;
  category: string;
  prizePool: string;
  submissionDeadline: string;
  submissionDeadlineIso: string | null;
  timeLeftLabel: string;
  submissionCountLabel: string;
  featured: boolean;
  submissionStatus: CreatorSubmissionStatus;
  actionLabel: string;
  coverImageUrl: string | null;
  coverImageAlt: string;
};

export type CreatorSubmissionListItem = {
  submissionId: string;
  draftId: string | null;
  challengeId: string;
  challengeTitle: string;
  brandName: string;
  title: string;
  status: CreatorSubmissionStatus;
  updatedAt: string;
  submittedAt: string | null;
  anonymousEntryCode: string;
  actionLabel: string;
  challengeSlug: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string;
  progressLabel: string;
};

export type CreatorRewardItem = {
  submissionId: string;
  challengeTitle: string;
  brandName: string;
  status: "Pending Settlement" | "Processing" | "Paid" | "Settlement Failed";
  amount: string;
  amountUnits: string;
  network: "Arc Testnet";
  paidAt: string | null;
  walletAddressMasked: string;
  transactionHash: string | null;
};

export type CreatorWalletSummary = {
  available: boolean;
  walletAddressMasked: string;
  walletAddress: string | null;
  walletState: string;
  network: string;
  purpose: "PAYOUT";
  mappingStatus: string;
  balanceLabel: string;
  balanceDetail: string;
  balanceStatus: "ready" | "unavailable" | "error";
  balanceUnits: string | null;
  balanceReadAt: string | null;
  explorerUrl: string | null;
};

export type CreatorProfileSummary = {
  displayName: string;
  username: string | null;
  country: string | null;
  avatarImageKey: string | null;
  avatarImageUrl: string | null;
};


export type CreatorNextAction = {
  kind:
    | "wallet_setup"
    | "continue_draft"
    | "submit_work"
    | "submission_under_review"
    | "reward_available"
    | "explore";
  headline: string;
  detail: string;
  href: string;
  ctaLabel: string;
  statusLabel: string;
  metaLabel?: string;
};


export type CreatorMetricItem = {
  label: string;
  value: string;
  detail: string;
  tone: "violet" | "blue" | "green";
  iconLabel: string;
};

export type CreatorNotificationItem = {
  id: string;
  headline: string;
  message: string;
  timeLabel: string;
  href: string;
  tone: "blue" | "green" | "amber" | "violet";
  iconLabel: string;
  unread: boolean;
};
export type CreatorActivityItem = {
  label: string;
  detail: string;
  at?: string | null;
  tone: "blue" | "green" | "amber" | "violet";
};

export type CreatorWorkspaceOverview = {
  session: CreatorSession;
  availableChallenges: CreatorChallengeCard[];
  submissions: CreatorSubmissionListItem[];
  rewards: CreatorRewardItem[];
  wallet: CreatorWalletSummary;
  activity: CreatorActivityItem[];
  notifications: CreatorNotificationItem[];
  metrics: CreatorMetricItem[];
  profile: CreatorProfileSummary;
  nextAction: CreatorNextAction;
  stats: {
    availableChallenges: number;
    activeSubmissions: number;
    submittedEntries: number;
    rewardsPaid: number;
  };
};

export type CreatorChallengeDetail = CreatorChallengeCard & {
  summary: string;
  description: string;
  primaryDeliverable: string;
  supportingDeliverables: string[];
  usageRights: string;
  reviewDeadline: string;
  judgingCriteria: string[];
  acceptsSubmissions: boolean;
  eligibilityLabel: string;
  submission: Submission | null;
  submissionCount: number;
};

export type CreatorSubmissionDetail = CreatorSubmissionListItem & {
  description: string;
  primaryAssetUrl: string;
  supportingLinks: string[];
  resultStatus: CreatorSubmissionStatus;
  immutable: boolean;
  reward: CreatorRewardItem | null;
};

export type CreatorPerformanceRoute =
  | "overview"
  | "discover"
  | "challenge-detail"
  | "submissions"
  | "submission-detail"
  | "rewards"
  | "wallet";

function creatorPerformanceLogsEnabled() {
  return process.env.NODE_ENV === "development";
}

export async function measureCreatorPerformance<T>(
  route: CreatorPerformanceRoute,
  step: string,
  work: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await work();
  } finally {
    if (creatorPerformanceLogsEnabled()) {
      console.info("[creator-performance] route=" + route + " " + step + "=" + (Date.now() - startedAt) + "ms");
    }
  }
}

function formatUsdcFromUnits(units: bigint) {
  const divisor = BigInt(1_000_000);
  const whole = units / divisor;
  const fraction = (units % divisor).toString().padStart(6, "0").slice(0, 2);
  return `${whole.toLocaleString()}.${fraction} USDC`;
}

function timeLeftLabel(value?: string | null) {
  if (!value) return "Deadline unset";
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return "Deadline unset";
  const diff = target - Date.now();
  if (diff <= 0) return "Closed";
  const minutes = Math.ceil(diff / 60000);
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} hours left`;
  const days = Math.ceil(hours / 24);
  return `${days} days left`;
}

function relativeTimeLabel(value?: string | null) {
  if (!value) return "Recently";
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return "Recently";
  const diff = Date.now() - target;
  if (diff < 60000) return "Just now";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
function formatUnits(value?: string) {
  if (!value) return "Not available";
  try {
    const units = BigInt(value);
    const divisor = BigInt(1_000_000);
    const whole = units / divisor;
    const fraction = (units % divisor).toString().padStart(6, "0").replace(/0+$/, "");
    return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ""} test USDC`;
  } catch {
    return "Not available";
  }
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function mask(value?: string | null) {
  if (!value) return "Not available";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const ARC_EXPLORER_URL = "https://testnet.arcscan.app";
const BALANCE_OF_SELECTOR = "0x70a08231";
const CREATOR_BALANCE_CACHE_TTL_MS = 30_000;
const creatorBalanceCache = new Map<string, { expiresAt: number; value: { units: string; label: string; readAt: string } }>();

function strip0x(value: string) {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function addressWord(address: string) {
  return strip0x(address).toLowerCase().padStart(64, "0");
}

async function readCreatorUsdcBalance(walletAddress: string) {
  const normalized = walletAddress.toLowerCase();
  const cached = creatorBalanceCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetch(ARC_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        {
          to: ARC_TESTNET_USDC_CONTRACT,
          data: `${BALANCE_OF_SELECTOR}${addressWord(walletAddress)}`,
        },
        "latest",
      ],
    }),
  });

  if (!response.ok) throw new Error(`Arc RPC balance query returned HTTP ${response.status}.`);
  const payload = await response.json() as { result?: string; error?: { message?: string } };
  if (payload.error) throw new Error(payload.error.message ?? "Arc RPC balance query failed.");
  if (!payload.result || !/^0x[a-fA-F0-9]+$/.test(payload.result)) {
    throw new Error("Arc RPC balance query returned an invalid result.");
  }

  const units = BigInt(payload.result).toString();
  const value = {
    units,
    label: formatUsdcFromUnits(BigInt(units)),
    readAt: new Date().toISOString(),
  };
  creatorBalanceCache.set(normalized, { expiresAt: Date.now() + CREATOR_BALANCE_CACHE_TTL_MS, value });
  return value;
}

export async function getCreatorNotificationPreview(session: CreatorSession) {
  const [drafts, submissions, attempts] = await Promise.all([
    listDrafts(),
    listCreatorSubmissions(session.ccnAccountId),
    listWinnerFinalizationAttempts().catch(() => []),
  ]);
  const items = await Promise.all(submissions.map((submission) => submissionItem(submission, drafts, attempts)));
  return buildCreatorNotifications({ submissions: items, rewards: [] });
}

export async function getCreatorNotificationCount(session: CreatorSession) {
  return (await getCreatorNotificationPreview(session)).filter((item) => item.unread).length;
}

export async function getCreatorProfileSummary(session: CreatorSession): Promise<CreatorProfileSummary> {
  const profile = await getCreatorProfileIdentity(session.ccnAccountId).catch(() => null);
  const username = profile?.username?.trim() || null;
  const displayName = profile?.displayName?.trim() || username || session.displayName;
  const avatarImageKey = profile?.avatarImageKey ?? null;
  return {
    displayName,
    username,
    country: profile?.country?.trim() || null,
    avatarImageKey,
    avatarImageUrl: profile?.avatarImageUrl ?? resolveAccountImageUrl(avatarImageKey),
  };
}
function isSubmissionOpen(draft: CreateChallengeDraftState) {
  const deadline = new Date(draft.reviewRules.submissionDeadline);
  return Number.isFinite(deadline.getTime()) && Date.now() < deadline.getTime();
}

function creatorEligibilityDiagnosticEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.CCN_CREATOR_ELIGIBILITY_DIAGNOSTICS === "true";
}

function explainCreatorEligibility(draft: CreateChallengeDraftState) {
  const fundingStatus = String(draft.funding.fundingStatus);
  const slug = draft.challenge.slug ?? "";
  const reasons: string[] = [];
  if (draft.deployment.publicationStatus !== "live") reasons.push("publication-not-live");
  if (fundingStatus !== "funded" && fundingStatus !== "live") reasons.push("funding-not-live");
  if (draft.funding.escrowStatus !== "verified") reasons.push("escrow-not-verified");
  if (draft.funding.eventVerified !== true) reasons.push("funding-event-not-verified");
  if (!draft.funding.transactionHash) reasons.push("funding-transaction-missing");
  if (!slug || slug === "new-challenge") reasons.push("public-slug-missing");
  if (!isSubmissionOpen(draft)) reasons.push("submission-window-closed");

  return {
    eligible: reasons.length === 0,
    reasons,
    row: {
      draftId: draft.challenge.id ?? null,
      challengeId: draft.challenge.challengeId ?? draft.deployment.challengeId ?? null,
      slug: slug || null,
      title: draft.challenge.title || "Untitled draft",
      publicationStatus: draft.deployment.publicationStatus,
      fundingStatus,
      escrowStatus: draft.funding.escrowStatus,
      eventVerified: draft.funding.eventVerified === true,
      submissionDeadline: draft.reviewRules.submissionDeadline,
      reviewDeadline: draft.reviewRules.reviewDeadline,
    },
  };
}

function isDiscoverable(draft: CreateChallengeDraftState) {
  return explainCreatorEligibility(draft).eligible;
}

const listDrafts = cache(async function listDrafts() {
  return listCreateChallengeDraftStates();
});

function listCreatorEligiblePublicDraftsFromDrafts(drafts: CreateChallengeDraftState[]) {
  const diagnostics = drafts.map((draft) => explainCreatorEligibility(draft));
  if (creatorEligibilityDiagnosticEnabled()) {
    console.info("[creator-challenge-eligibility]", diagnostics.map((item) => ({
      ...item.row,
      eligible: item.eligible,
      exclusionReasons: item.reasons,
    })));
  }
  return drafts.filter(isDiscoverable);
}

async function listCreatorEligiblePublicDrafts() {
  return listCreatorEligiblePublicDraftsFromDrafts(await listDrafts());
}

function draftId(draft: CreateChallengeDraftState) {
  return draft.challenge.id ?? "";
}

function challengeId(draft: CreateChallengeDraftState) {
  return draft.challenge.challengeId ?? draft.deployment.challengeId;
}

function statusForSubmission(input: {
  submission: Submission | null;
  draft: CreateChallengeDraftState | null;
  winnerAttempt: WinnerFinalizationAttemptRecord | null;
  reward: CreatorRewardItem | null;
}): CreatorSubmissionStatus {
  const { submission, draft, winnerAttempt, reward } = input;
  if (!submission) return "No submission";
  if (reward?.status === "Paid") return "Reward Paid";
  if (winnerAttempt?.selectedWinnerEntryIds.includes(submission.id)) {
    return winnerAttempt.state === "PAYOUT_CONFIRMED" ? "Reward Paid" : "Winner";
  }
  if (winnerAttempt?.finalizedAt && !winnerAttempt.selectedWinnerEntryIds.includes(submission.id)) {
    return "Not Selected";
  }
  if (submission.status === "DRAFT") return "Draft";
  if (draft && !isSubmissionOpen(draft)) return "Under Review";
  return "Submitted";
}

function challengeCard(
  draft: CreateChallengeDraftState,
  submission: Submission | null,
  status: CreatorSubmissionStatus,
): CreatorChallengeCard {
  const cover = resolveCampaignCover({
    coverImageKey: draft.challenge.coverImageKey,
    coverImageAlt: draft.challenge.coverImageAlt,
    title: draft.challenge.title,
    category: draft.challenge.category,
  });
  return {
    draftId: draftId(draft),
    challengeId: challengeId(draft),
    slug: draft.challenge.slug || draftId(draft),
    title: draft.challenge.title || "Untitled challenge",
    brandName: draft.challenge.brandName || "Brand not set",
    category: draft.challenge.category || "Creative",
    prizePool: formatUnits(draft.prizePool.prizePoolUnits),
    submissionDeadline: formatDate(draft.reviewRules.submissionDeadline),
    submissionDeadlineIso: draft.reviewRules.submissionDeadline ?? null,
    timeLeftLabel: timeLeftLabel(draft.reviewRules.submissionDeadline),
    submissionCountLabel: "Submission count available on detail",
    featured: Boolean(draft.challenge.coverImageKey),
    submissionStatus: status,

    coverImageUrl: cover.imageUrl,
    coverImageAlt: cover.alt,
    actionLabel: submission?.status === "SUBMITTED"
      ? "View Submission"
      : submission?.status === "DRAFT"
        ? "Continue Draft"
        : isSubmissionOpen(draft)
          ? "View Challenge"
          : "Submissions Closed",
  };
}

async function rewardForSubmission(
  submission: Submission,
  draft: CreateChallengeDraftState | null,
  attempts: WinnerFinalizationAttemptRecord[],
): Promise<CreatorRewardItem | null> {
  if (!draft) return null;
  const attempt = attempts.find(
    (item) =>
      item.challengeId.toLowerCase() === submission.challengeId.toLowerCase() &&
      item.selectedWinnerEntryIds.includes(submission.id),
  );
  if (!attempt) return null;

  const winnerIndex = attempt.selectedWinnerEntryIds.indexOf(submission.id);
  const verifications = await listOnChainVerificationsForDraft({
    draftId: draftId(draft),
    challengeId: challengeId(draft),
    fundingIntentId: draft.funding.fundingIntentId,
  }).catch(() => []);
  const payoutEvidence = verifications.find(
    (record) =>
      record.eventType === "ChallengePayout" &&
      record.txHash.toLowerCase() === attempt.transactionHash?.toLowerCase() &&
      record.receiptVerified &&
      record.eventVerified &&
      record.winnersVerified,
  );
  const paid = attempt.state === "PAYOUT_CONFIRMED" && Boolean(payoutEvidence);

  return {
    submissionId: submission.id,
    challengeTitle: draft.challenge.title || "Untitled challenge",
    brandName: draft.challenge.brandName || "Brand not set",
    status: paid
      ? "Paid"
      : attempt.state === "FINALIZATION_FAILED"
        ? "Settlement Failed"
        : attempt.circleChallengeId || attempt.transactionHash
          ? "Processing"
          : "Pending Settlement",
    amount: formatUnits(draft.prizePool.distributionUnits[winnerIndex]),
    amountUnits: draft.prizePool.distributionUnits[winnerIndex] ?? "0",
    network: "Arc Testnet",
    paidAt: paid ? attempt.payoutConfirmedAt ?? payoutEvidence?.verifiedAt ?? null : null,
    walletAddressMasked: mask(submission.creatorWalletAddress),
    transactionHash: paid ? attempt.transactionHash ?? null : null,
  };
}

function submissionForChallenge(submissions: Submission[], draft: CreateChallengeDraftState) {
  const normalizedChallengeId = challengeId(draft).toLowerCase();
  return (
    submissions.find(
      (submission) =>
        submission.challengeId.toLowerCase() === normalizedChallengeId &&
        (submission.status === "DRAFT" || submission.status === "SUBMITTED"),
    ) ?? null
  );
}
async function submissionItem(
  submission: Submission,
  drafts: CreateChallengeDraftState[],
  attempts: WinnerFinalizationAttemptRecord[],
  options: { includeReward?: boolean } = {},
): Promise<CreatorSubmissionListItem> {
  const draft = drafts.find((item) => challengeId(item).toLowerCase() === submission.challengeId.toLowerCase()) ?? null;
  const reward = options.includeReward ? await rewardForSubmission(submission, draft, attempts) : null;
  const winnerAttempt = attempts.find((item) => item.selectedWinnerEntryIds.includes(submission.id)) ?? null;
  const status = statusForSubmission({ submission, draft, winnerAttempt, reward });
  return {
    submissionId: submission.id,
    draftId: draft ? draftId(draft) : null,
    challengeId: submission.challengeId,
    challengeTitle: draft?.challenge.title || "Challenge unavailable",
    brandName: draft?.challenge.brandName || "Brand not set",
    title: submission.title,
    status,
    updatedAt: formatDate(submission.updatedAt),
    submittedAt: submission.submittedAt ? formatDate(submission.submittedAt) : null,
    anonymousEntryCode: submission.anonymousEntryCode,
    challengeSlug: draft?.challenge.slug ?? null,
    coverImageUrl: draft ? resolveCampaignCover({ coverImageKey: draft.challenge.coverImageKey, coverImageAlt: draft.challenge.coverImageAlt, title: draft.challenge.title, category: draft.challenge.category }).imageUrl : null,
    coverImageAlt: draft ? resolveCampaignCover({ coverImageKey: draft.challenge.coverImageKey, coverImageAlt: draft.challenge.coverImageAlt, title: draft.challenge.title, category: draft.challenge.category }).alt : "Submission cover",
    progressLabel: submission.status === "DRAFT" ? "Draft saved" : status,
    actionLabel:
 submission.status === "DRAFT" ? "Continue Draft" : "View Submission",
  };
}

export async function getCreatorWalletSummary(session: CreatorSession): Promise<CreatorWalletSummary> {
  const mapping = await getVerifiedCreatorPayoutWallet(session.ccnAccountId).catch(() => null);

  if (!mapping) {
    return {
      available: false,
      walletAddressMasked: "Not connected",
      walletAddress: null,
      walletState: "Unavailable",
      network: "Arc Testnet",
      purpose: "PAYOUT",
      mappingStatus: "No verified creator payout wallet mapping",
      balanceLabel: "Balance unavailable",
      balanceDetail: "Set up a verified Creator payout wallet to read balance.",
      balanceStatus: "unavailable",
      balanceUnits: null,
      balanceReadAt: null,
      explorerUrl: null,
    };

  }

  const available =
    mapping.blockchain === "ARC-TESTNET" &&
    mapping.accountType === "SCA" &&
    mapping.walletState === "live";
  let balanceResult: Awaited<ReturnType<typeof readCreatorUsdcBalance>> | null = null;
  let balanceError = false;
  if (available) {
    try {
      balanceResult = await readCreatorUsdcBalance(mapping.walletAddress);
    } catch {
      balanceError = true;
    }
  }

  return {
    available,
    walletAddressMasked: mask(mapping.walletAddress),
    walletAddress: mapping.walletAddress,
    walletState: mapping.walletState === "live" ? "Ready" : mapping.walletState,
    network: mapping.blockchain,
    purpose: "PAYOUT",
    mappingStatus: "CREATOR_PAYOUT",
    balanceLabel: balanceResult ? balanceResult.label : "Balance unavailable",
    balanceDetail: balanceResult
      ? `Read from Arc Testnet ${formatDate(balanceResult.readAt)}`
      : balanceError
        ? "Arc balance query failed. Use Refresh balance to try again."
        : "Balance query unavailable.",
    balanceStatus: balanceResult ? "ready" : balanceError ? "error" : "unavailable",
    balanceUnits: balanceResult?.units ?? null,
    balanceReadAt: balanceResult?.readAt ?? null,
    explorerUrl: `${ARC_EXPLORER_URL}/address/${mapping.walletAddress}`,
  };

}


function buildCreatorMetrics(input: {
  submissions: CreatorSubmissionListItem[];
  rewards: CreatorRewardItem[];
}) {
  const paidRewards = input.rewards.filter((reward) => reward.status === "Paid");
  const totalPaid = paidRewards.reduce((total, reward) => {
    try {
      return total + BigInt(reward.amountUnits);
    } catch {
      return total;
    }
  }, BigInt(0));
  const submittedCount = input.submissions.filter((submission) => submission.status !== "Draft").length;
  const wonCount = input.submissions.filter((submission) =>
    submission.status === "Winner" || submission.status === "Reward Paid",
  ).length;
  const winRate = submittedCount > 0 ? Math.round((wonCount / submittedCount) * 100) : 0;

  return [
    {
      label: "Total Earnings",
      value: paidRewards.length ? formatUsdcFromUnits(totalPaid) : "0.00 USDC",
      detail: "Verified paid rewards",
      tone: "violet" as const,
      iconLabel: "$",
    },
    {
      label: "Submissions",
      value: String(input.submissions.length),
      detail: "All time",
      tone: "blue" as const,
      iconLabel: "S",
    },
    {
      label: "Win Rate",
      value: submittedCount > 0 ? `${winRate}%` : "0%",
      detail: submittedCount > 0 ? `${wonCount} / ${submittedCount} won` : "No finalized entries",
      tone: "green" as const,
      iconLabel: "%",
    },
  ];
}

function buildCreatorNotifications(input: {
  submissions: CreatorSubmissionListItem[];
  rewards: CreatorRewardItem[];
}): CreatorNotificationItem[] {
  const submissionNotifications = input.submissions.map((submission) => ({
    id: `submission:${submission.submissionId}:${submission.status}`,
    headline: submission.status === "Draft" ? "Draft saved" : "Submission updated",
    message: `${submission.challengeTitle} is ${submission.status}`,
    timeLabel: relativeTimeLabel(submission.submittedAt ?? submission.updatedAt),
    href: `/dashboard/creator/submissions/${submission.submissionId}`,
    tone: submission.status === "Reward Paid" ? "green" as const : submission.status === "Under Review" ? "blue" as const : "violet" as const,
    iconLabel: submission.status === "Reward Paid" ? "$" : "S",
    unread: submission.status !== "Draft",
  }));
  const rewardNotifications = input.rewards.map((reward) => ({
    id: `reward:${reward.submissionId}:${reward.status}`,
    headline: reward.status === "Paid" ? "Reward paid" : "Reward update",
    message: `${reward.challengeTitle} - ${reward.amount}`,
    timeLabel: relativeTimeLabel(reward.paidAt),
    href: "/dashboard/creator/rewards",
    tone: reward.status === "Paid" ? "green" as const : "amber" as const,
    iconLabel: "$",
    unread: reward.status !== "Paid",
  }));

  return [...submissionNotifications, ...rewardNotifications].slice(0, 8);
}

function matchesChallengeQuery(challenge: CreatorChallengeCard, query?: string) {
  const normalized = query?.trim().toLowerCase();
  if (!normalized) return true;
  return [challenge.title, challenge.brandName, challenge.category]
    .some((value) => value.toLowerCase().includes(normalized));
}

export async function listCreatorDiscoverableChallenges(session: CreatorSession, query = "") {
  const [drafts, submissions, attempts] = await Promise.all([
    listCreatorEligiblePublicDrafts(),
    listCreatorSubmissions(session.ccnAccountId),
    listWinnerFinalizationAttempts().catch(() => []),
  ]);
  return drafts
    .map((draft) => {
      const submission = submissionForChallenge(submissions, draft);
      const reward = null;
      const winnerAttempt = submission
        ? attempts.find((item) => item.selectedWinnerEntryIds.includes(submission.id)) ?? null
        : null;
      return challengeCard(draft, submission, statusForSubmission({ submission, draft, winnerAttempt, reward }));
    })
    .filter((challenge) => matchesChallengeQuery(challenge, query));
}


export function resolveCreatorNextAction(input: {
  wallet: CreatorWalletSummary;
  submissions: CreatorSubmissionListItem[];
  availableChallenges: CreatorChallengeCard[];
  rewards: CreatorRewardItem[];
}): CreatorNextAction {
  if (!input.wallet.available) {
    return {
      kind: "wallet_setup",
      headline: "Set up your payout wallet",
      detail: "Connect your Creator payout wallet before submitting work or receiving rewards.",
      href: "/dashboard/creator/wallet",
      ctaLabel: "Complete wallet setup",
      statusLabel: "Wallet setup required before submission",
    };
  }

  const draft = input.submissions.find((item) => item.status === "Draft");
  if (draft) {
    return {
      kind: "continue_draft",
      headline: "Continue your submission",
      detail: `${draft.challengeTitle} is saved but not submitted yet.`,
      href: draft.challengeSlug ? `/dashboard/creator/challenges/${draft.challengeSlug}` : `/dashboard/creator/submissions/${draft.submissionId}`,
      ctaLabel: "Continue Draft",
      statusLabel: draft.progressLabel,
      metaLabel: draft.submittedAt ?? draft.updatedAt,
    };
  }

  const openChallenge = input.availableChallenges.find((challenge) => challenge.submissionStatus === "No submission");
  if (openChallenge) {
    return {
      kind: "submit_work",
      headline: "Open challenge available",
      detail: `${openChallenge.title} is accepting creator submissions.`,
      href: `/dashboard/creator/challenges/${openChallenge.slug}`,
      ctaLabel: "View Challenge",
      statusLabel: openChallenge.timeLeftLabel,
      metaLabel: openChallenge.timeLeftLabel,
    };
  }

  const submitted = input.submissions.find((item) => item.status === "Submitted" || item.status === "Under Review");
  if (submitted) {
    return {
      kind: "submission_under_review",
      headline: "Submission under review",
      detail: `${submitted.challengeTitle} is in the Brand review flow.`,
      href: `/dashboard/creator/submissions/${submitted.submissionId}`,
      ctaLabel: "View Submission",
      statusLabel: submitted.status,
      metaLabel: submitted.submittedAt ?? submitted.updatedAt,
    };
  }

  const reward = input.rewards.find((item) => item.status === "Paid" || item.status === "Pending Settlement" || item.status === "Processing");
  if (reward) {
    return {
      kind: "reward_available",
      headline: reward.status === "Paid" ? "Reward paid" : "Reward in progress",
      detail: `${reward.challengeTitle} - ${reward.amount}`,
      href: "/dashboard/creator/rewards",
      ctaLabel: "View Reward",
      statusLabel: reward.status,
      metaLabel: reward.paidAt ?? reward.status,
    };
  }

  return {
    kind: "explore",
    headline: "No open challenges right now",
    detail: "Funded public challenges will appear when they are ready for creator submissions.",
    href: "/challenges",
    ctaLabel: "Return to public challenges",
    statusLabel: "No active submission yet",
  };
}

export async function getCreatorWorkspaceOverview(session: CreatorSession): Promise<CreatorWorkspaceOverview> {
  const [drafts, submissions, attempts, wallet, profile] = await Promise.all([
    listDrafts(),
    listCreatorSubmissions(session.ccnAccountId),
    listWinnerFinalizationAttempts().catch(() => []),
    getCreatorWalletSummary(session),
    getCreatorProfileSummary(session),
  ]);
  const eligibleDrafts = listCreatorEligiblePublicDraftsFromDrafts(drafts);
  const availableChallenges = eligibleDrafts.map((draft) => {
    const submission = submissionForChallenge(submissions, draft);
    const reward = null;
    const winnerAttempt = submission
      ? attempts.find((item) => item.selectedWinnerEntryIds.includes(submission.id)) ?? null
      : null;
    return challengeCard(draft, submission, statusForSubmission({ submission, draft, winnerAttempt, reward }));
  });
  const submissionItems = await Promise.all(
    submissions.map((submission) => submissionItem(submission, drafts, attempts, { includeReward: false })),
  );
  const rewards: CreatorRewardItem[] = [];
  const metrics = buildCreatorMetrics({ submissions: submissionItems, rewards });
  const notifications = buildCreatorNotifications({ submissions: submissionItems, rewards });
  const activity: CreatorActivityItem[] = [
    ...submissionItems.map((submission) => ({
      label: submission.status === "Draft" ? "Submission draft updated" : "Submission status updated",
      detail: `${submission.challengeTitle} - ${submission.status}`,
      at: submission.submittedAt ?? submission.updatedAt,
      tone: submission.status === "Reward Paid" ? "green" as const : "blue" as const,
    })),
    ...rewards.map((reward) => ({
      label: reward.status === "Paid" ? "Reward paid" : "Reward in progress",
      detail: `${reward.challengeTitle} - ${reward.amount}`,
      at: reward.paidAt,
      tone: reward.status === "Paid" ? "green" as const : "violet" as const,
    })),
  ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return {
    session,
    availableChallenges,
    submissions: submissionItems,
    rewards,
    wallet,
    activity,
    notifications,
    metrics,
    profile,
    nextAction: resolveCreatorNextAction({ wallet, submissions: submissionItems, availableChallenges, rewards }),
    stats: {
      availableChallenges: availableChallenges.length,
      activeSubmissions: submissionItems.filter((item) => item.status === "Draft").length,
      submittedEntries: submissionItems.filter((item) => item.status !== "Draft").length,
      rewardsPaid: rewards.filter((reward) => reward.status === "Paid").length,
    },
  };
}

export async function getCreatorChallengeDetail(
  identifier: string,
  session: CreatorSession,
): Promise<CreatorChallengeDetail | null> {
  const drafts = await listDrafts();
  const draft = drafts.find((item) => {
    const normalized = identifier.toLowerCase();
    return (
      draftId(item).toLowerCase() === normalized ||
      (item.challenge.slug ?? "").toLowerCase() === normalized ||
      challengeId(item).toLowerCase() === normalized
    );
  });
  if (!draft) return null;

  const [submission, submissionCount, attempts] = await Promise.all([
    getCreatorSubmissionStatus({ challengeId: challengeId(draft), creatorAccountId: session.ccnAccountId }),
    countSubmittedEntriesForChallenge(challengeId(draft)).catch(() => 0),
    listWinnerFinalizationAttempts().catch(() => []),
  ]);
  const reward = submission ? await rewardForSubmission(submission, draft, attempts) : null;
  const winnerAttempt = submission
    ? attempts.find((item) => item.selectedWinnerEntryIds.includes(submission.id)) ?? null
    : null;
  const status = statusForSubmission({ submission, draft, winnerAttempt, reward });
  const discoverable = isDiscoverable(draft);

  if (!discoverable && !submission) return null;

  return {
    ...challengeCard(draft, submission, status),
    summary: draft.challenge.summary,
    description: draft.challenge.description,
    primaryDeliverable: draft.challenge.primaryDeliverable,
    supportingDeliverables: draft.challenge.supportingDeliverables,
    usageRights: draft.reviewRules.usageRights,
    reviewDeadline: formatDate(draft.reviewRules.reviewDeadline),
    judgingCriteria: draft.reviewRules.judgingCriteria,
    acceptsSubmissions: discoverable && status !== "Submitted",
    eligibilityLabel: discoverable ? "Eligible for submission" : "Submissions are not currently open",
    submission,
    submissionCount,
  };
}

export async function listCreatorSubmissionItems(session: CreatorSession) {
  const [drafts, submissions, attempts] = await Promise.all([
    listDrafts(),
    listCreatorSubmissions(session.ccnAccountId),
    listWinnerFinalizationAttempts().catch(() => []),
  ]);
  return Promise.all(submissions.map((submission) => submissionItem(submission, drafts, attempts, { includeReward: false })));
}

export async function getCreatorSubmissionDetail(
  submissionId: string,
  session: CreatorSession,
): Promise<CreatorSubmissionDetail | null> {
  const submission = await getCreatorSubmissionById({
    submissionId,
    creatorAccountId: session.ccnAccountId,
  });
  if (!submission) return null;
  const [drafts, attempts] = await Promise.all([
    listDrafts(),
    listWinnerFinalizationAttempts().catch(() => []),
  ]);
  const listItem = await submissionItem(submission, drafts, attempts, { includeReward: true });
  const draft = drafts.find((item) => challengeId(item).toLowerCase() === submission.challengeId.toLowerCase()) ?? null;
  const reward = draft ? await rewardForSubmission(submission, draft, attempts) : null;
  return {
    ...listItem,
    description: submission.description,
    primaryAssetUrl: submission.primaryAssetUrl,
    supportingLinks: submission.supportingLinks,
    resultStatus: listItem.status,
    immutable: submission.status === "SUBMITTED",
    reward,
  };
}

export async function listCreatorRewards(session: CreatorSession) {
  const [drafts, submissions, attempts] = await Promise.all([
    listDrafts(),
    listCreatorSubmissions(session.ccnAccountId),
    listWinnerFinalizationAttempts().catch(() => []),
  ]);
  return (await Promise.all(
    submissions.map(async (submission) => {
      const draft = drafts.find((item) => challengeId(item).toLowerCase() === submission.challengeId.toLowerCase()) ?? null;
      return rewardForSubmission(submission, draft, attempts);
    }),
  )).filter((reward): reward is CreatorRewardItem => Boolean(reward));
}

export function creatorWorkspaceFacts() {
  return {
    routes: [
      "/dashboard/creator",
      "/dashboard/creator/discover",
      "/dashboard/creator/challenges/[slug]",
      "/dashboard/creator/submissions",
      "/dashboard/creator/submissions/[submissionId]",
      "/dashboard/creator/wallet",
    ],
    serverSession: "getCreatorSession",
    submissionWrites: [
      "/api/creator/submissions/draft",
      "/api/creator/submissions/finalize",
    ],
    productionPersistenceBoundary: "Supabase required when CCN_DEPLOYMENT_ENV or VERCEL_ENV is production",
    escrowContract: CREATE_CHALLENGE_ESCROW_CONTRACT,
    brandAccount: CREATE_CHALLENGE_BRAND_ACCOUNT_ID,
  };
}
