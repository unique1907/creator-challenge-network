import type { CreateChallengeDraftState } from "@/types/create-challenge";
import type { ChallengeStatus } from "@/types/ccn";
import { parseChallengeDeadline } from "@/utils/challenge-deadlines";

export type PublicLiveEligibilityDiagnostic = {
  eligible: boolean;
  reasons: string[];
};

export function isSubmissionWindowOpen(draft: CreateChallengeDraftState, now = Date.now()) {
  const deadline = parseChallengeDeadline(draft.reviewRules.submissionDeadline);
  return Boolean(deadline && now < deadline.unix * 1000);
}

export function explainPublicLiveEligibility(draft: CreateChallengeDraftState, now = Date.now()): PublicLiveEligibilityDiagnostic {
  const fundingStatus = String(draft.funding.fundingStatus);
  const slug = draft.challenge.slug ?? "";
  const reasons: string[] = [];

  if (draft.deployment.publicationStatus !== "live") reasons.push("publication-not-live");
  if (fundingStatus !== "funded" && fundingStatus !== "live") reasons.push("funding-not-live");
  if (draft.funding.escrowStatus !== "verified") reasons.push("escrow-not-verified");
  if (draft.funding.eventVerified !== true) reasons.push("funding-event-not-verified");
  if (!draft.funding.transactionHash) reasons.push("funding-transaction-missing");
  if (!slug || slug === "new-challenge") reasons.push("public-slug-missing");
  if (!isSubmissionWindowOpen(draft, now)) reasons.push("submission-window-closed");

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

export function isPublicLiveEligibleDraft(draft: CreateChallengeDraftState, now = Date.now()) {
  return explainPublicLiveEligibility(draft, now).eligible;
}

export type SharedChallengeLifecycleState =
  | "draft"
  | "not-live"
  | "live"
  | "review"
  | "closed-no-submissions"
  | "closed-not-enough-submissions"
  | "selection"
  | "settlement"
  | "completed";

export type ChallengeLifecycleEvidence = {
  publicationStatus: string | null | undefined;
  fundingStatus: string | null | undefined;
  escrowStatus: string | null | undefined;
  eventVerified: boolean | null | undefined;
  fundingTransactionHash: string | null | undefined;
  slug: string | null | undefined;
  submissionDeadline: string | null | undefined;
  submittedCount: number;
  configuredWinnerCount?: number | null;
  winnerFinalizationState?: string | null;
  winnerFinalizedAt?: string | null;
  payoutApprovalCreatedAt?: string | null;
  payoutTransactionHash?: string | null;
  payoutConfirmedAt?: string | null;
};

export type ChallengeLifecycleClassification = {
  lifecycle: SharedChallengeLifecycleState;
  publicStatus: ChallengeStatus | null;
  publicStatusLabel: string;
  publicCtaLabel: string;
  isLiveOpportunity: boolean;
  acceptsSubmissions: boolean;
  brandBucket: "Drafts" | "Active" | "Needs Action" | "Closed" | "Completed";
};

export function classifyChallengeLifecycle(
  evidence: ChallengeLifecycleEvidence,
  now = Date.now(),
): ChallengeLifecycleClassification {
  const deadline = parseChallengeDeadline(evidence.submissionDeadline ?? undefined);
  const deadlineClosed = Boolean(deadline && now >= deadline.unix * 1000);
  const fundingStatus = String(evidence.fundingStatus ?? "");
  const isPublished = evidence.publicationStatus === "live";
  const isFunded = fundingStatus === "funded" || fundingStatus === "live";
  const hasVerifiedFunding =
    isFunded &&
    evidence.escrowStatus === "verified" &&
    evidence.eventVerified === true &&
    Boolean(evidence.fundingTransactionHash);
  const hasPublicSlug = Boolean(evidence.slug && evidence.slug !== "new-challenge");
  const submittedCount = Math.max(0, evidence.submittedCount);
  const configuredWinnerCount = Math.max(1, Number(evidence.configuredWinnerCount ?? 1));
  const settlementStates = new Set([
    "TRANSACTION_SUBMITTED",
    "RECONCILIATION_REQUIRED",
    "ACTION_REQUIRED",
    "APPROVAL_CREATED_RECONCILIATION_REQUIRED",
  ]);

  if (evidence.winnerFinalizationState === "PAYOUT_CONFIRMED" && evidence.payoutConfirmedAt) {
    return {
      lifecycle: "completed",
      publicStatus: "completed",
      publicStatusLabel: "Completed",
      publicCtaLabel: "View Outcome",
      isLiveOpportunity: false,
      acceptsSubmissions: false,
      brandBucket: "Completed",
    };
  }

  if (
    (evidence.winnerFinalizationState && settlementStates.has(evidence.winnerFinalizationState)) ||
    evidence.payoutTransactionHash ||
    evidence.payoutApprovalCreatedAt
  ) {
    return {
      lifecycle: "settlement",
      publicStatus: "settlement",
      publicStatusLabel: "Settlement",
      publicCtaLabel: "View Progress",
      isLiveOpportunity: false,
      acceptsSubmissions: false,
      brandBucket: "Needs Action",
    };
  }

  if (evidence.winnerFinalizedAt || evidence.winnerFinalizationState === "READY_FOR_FINAL_SELECTION") {
    return {
      lifecycle: "selection",
      publicStatus: "selection",
      publicStatusLabel: "Selection",
      publicCtaLabel: "View Progress",
      isLiveOpportunity: false,
      acceptsSubmissions: false,
      brandBucket: "Needs Action",
    };
  }

  if (isPublished && hasVerifiedFunding && hasPublicSlug && deadline && !deadlineClosed) {
    return {
      lifecycle: "live",
      publicStatus: "open",
      publicStatusLabel: "Open for Solutions",
      publicCtaLabel: "View Challenge",
      isLiveOpportunity: true,
      acceptsSubmissions: true,
      brandBucket: "Active",
    };
  }

  if (isPublished && hasVerifiedFunding && deadlineClosed) {
    if (submittedCount === 0) {
      return {
          lifecycle: "closed-no-submissions",
          publicStatus: "closed",
          publicStatusLabel: "Closed - No Submissions",
          publicCtaLabel: "View Details",
          isLiveOpportunity: false,
          acceptsSubmissions: false,
          brandBucket: "Closed",
        };
    }
    if (submittedCount < configuredWinnerCount) {
      return {
        lifecycle: "closed-not-enough-submissions",
        publicStatus: "closed",
        publicStatusLabel: "Closed — Not Enough Submissions",
        publicCtaLabel: "View Details",
        isLiveOpportunity: false,
        acceptsSubmissions: false,
        brandBucket: "Closed",
      };
    }
    return {
      lifecycle: "review",
      publicStatus: "reviewing",
      publicStatusLabel: "Evaluation",
      publicCtaLabel: "View Progress",
      isLiveOpportunity: false,
      acceptsSubmissions: false,
      brandBucket: "Needs Action",
    };
  }

  if (isPublished || isFunded || evidence.escrowStatus === "verified") {
    return {
      lifecycle: "not-live",
      publicStatus: null,
      publicStatusLabel: "Not Live",
      publicCtaLabel: "View Details",
      isLiveOpportunity: false,
      acceptsSubmissions: false,
      brandBucket: "Needs Action",
    };
  }

  return {
    lifecycle: "draft",
    publicStatus: null,
    publicStatusLabel: "Draft",
    publicCtaLabel: "Continue Draft",
    isLiveOpportunity: false,
    acceptsSubmissions: false,
    brandBucket: "Drafts",
  };
}

export function classifyCreateChallengeDraftLifecycle(input: {
  draft: CreateChallengeDraftState;
  submittedCount: number;
  winnerAttempt?: {
    state?: string | null;
    finalizedAt?: string | null;
    approvalCreatedAt?: string | null;
    transactionHash?: string | null;
    payoutConfirmedAt?: string | null;
  } | null;
  now?: number;
}) {
  const { draft, submittedCount, winnerAttempt, now } = input;
  return classifyChallengeLifecycle({
    publicationStatus: draft.deployment.publicationStatus,
    fundingStatus: String(draft.funding.fundingStatus),
    escrowStatus: draft.funding.escrowStatus,
    eventVerified: draft.funding.eventVerified,
    fundingTransactionHash: draft.funding.transactionHash,
    slug: draft.challenge.slug,
    submissionDeadline: draft.reviewRules.submissionDeadline,
    submittedCount,
    configuredWinnerCount: draft.prizePool.winnerCount,
    winnerFinalizationState: winnerAttempt?.state,
    winnerFinalizedAt: winnerAttempt?.finalizedAt,
    payoutApprovalCreatedAt: winnerAttempt?.approvalCreatedAt,
    payoutTransactionHash: winnerAttempt?.transactionHash,
    payoutConfirmedAt: winnerAttempt?.payoutConfirmedAt,
  }, now);
}
