import "server-only";

import { getVerifiedCreatorPayoutMapping } from "@/services/circle/creator-payout-account.server";
import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import {
  CREATE_CHALLENGE_ESCROW_CONTRACT,
  findOnChainVerificationForDraft,
  getCreateChallengeDraftStrict,
  getCreateChallengeDraftOwnerAccountId,
  getFundingIntentFromDraft,
} from "@/services/create-challenge/create-challenge-store.server";
import {
  finalizeCreatorSubmission,
  getCreatorSubmissionStatus,
  listBlindReviewEntries,
  resolveSubmittedSelections,
  saveCreatorDraft,
} from "@/services/submissions/submission-store.server";
import type { FundedChallengeRead, SubmissionDraftInput } from "@/types/submission";
import type { WinnerFinalizationSelection } from "@/types/winner-finalization";
import { unixFromLocal } from "@/utils/create-challenge-launch-readiness";

const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const IS_FUNDED_SELECTOR = "0x2b5fe3d9";
const ACTIVE_ESCROW_FUNDING_CACHE_TTL_MS = 30_000;
const activeEscrowFundingCache = new Map<string, { value: boolean; verifiedAt: number }>();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeError(message: string, status = 400): never {
  throw new CircleSpikeError({ message, status });
}

function assertAddress(value: string): asserts value is `0x${string}` {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) safeError("Creator wallet address is invalid.");
}

async function assertCreatorIsNotChallengeOwner(draftId: string, creatorAccountId: string) {
  const ownerAccountId = await getCreateChallengeDraftOwnerAccountId(draftId);
  if (ownerAccountId && ownerAccountId === creatorAccountId) {
    safeError("Challenge owners cannot submit to their own challenge.", 403);
  }
}

async function readActiveEscrowIsFunded(challengeId: string) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(challengeId)) return false;

  const cacheKey = `${CREATE_CHALLENGE_ESCROW_CONTRACT.toLowerCase()}:${challengeId.toLowerCase()}`;
  const cached = activeEscrowFundingCache.get(cacheKey);
  if (cached && Date.now() - cached.verifiedAt < ACTIVE_ESCROW_FUNDING_CACHE_TTL_MS) {
    return cached.value;
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(ARC_RPC_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [
            {
              to: CREATE_CHALLENGE_ESCROW_CONTRACT,
              data: `${IS_FUNDED_SELECTOR}${challengeId.slice(2)}`,
            },
            "latest",
          ],
        }),
      });
      if (!response.ok) throw new Error(`Arc RPC returned HTTP ${response.status}`);
      const payload = await response.json() as { result?: string; error?: { message?: string } };
      if (payload.error) throw new Error(payload.error.message ?? "Arc RPC call failed.");
      const value = payload.result === `0x${"0".repeat(63)}1`;
      activeEscrowFundingCache.set(cacheKey, { value, verifiedAt: Date.now() });
      return value;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(150 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Arc RPC call failed.");
}

function assertBlindEntryIds(value: unknown) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    safeError("selectedBlindEntryIds must be a non-empty string array.");
  }
  return value.map((item) => String(item));
}

type LifecyclePhase = "submission" | "blind-review" | "winner-finalization" | "payout";

type PhaseVerificationOptions = {
  phase: LifecyclePhase;
  nowSeconds?: number;
};

async function verifyCanonicalChallengeForPhase(
  draftId: string,
  options: PhaseVerificationOptions,
): Promise<FundedChallengeRead> {
  const draft = await getCreateChallengeDraftStrict(draftId);
  const intent = getFundingIntentFromDraft(draft);
  const challengeId = intent.challengeId;
  const submissionDeadline = unixFromLocal(draft.reviewRules.submissionDeadline);
  const reviewDeadline = unixFromLocal(draft.reviewRules.reviewDeadline);
  const fundingEvidence = await findOnChainVerificationForDraft({
    draftId,
    challengeId,
    fundingIntentId: draft.funding.fundingIntentId,
  });
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const blockers: string[] = [];
  let activeEscrowIsFunded = false;
  try {
    activeEscrowIsFunded = await readActiveEscrowIsFunded(challengeId);
  } catch {
    blockers.push("Active escrow funding could not be verified.");
  }

  if (!challengeId) blockers.push("Challenge ID is missing.");
  if (intent.escrowContractAddress.toLowerCase() !== CREATE_CHALLENGE_ESCROW_CONTRACT.toLowerCase()) {
    blockers.push("Challenge is not tied to the active escrow contract.");
  }
  if (draft.deployment.publicationStatus !== "live") blockers.push("Challenge is not live.");
  if (!activeEscrowIsFunded) blockers.push("Challenge is not funded on the active escrow contract.");
  if (draft.funding.fundingStatus !== "funded" && draft.funding.fundingStatus !== "live") {
    blockers.push("Challenge funding is not confirmed.");
  }
  if (draft.funding.escrowStatus !== "verified" || !draft.funding.eventVerified) {
    blockers.push("Escrow funding event is not verified.");
  }
  if (!fundingEvidence?.receiptVerified || !fundingEvidence.eventVerified || !fundingEvidence.challengeVerified) {
    blockers.push("On-chain funding evidence is incomplete.");
  }
  if (!submissionDeadline) blockers.push("Submission deadline is missing.");
  if (!reviewDeadline) blockers.push("Review deadline is missing.");
  if (submissionDeadline && reviewDeadline && reviewDeadline <= submissionDeadline) {
    blockers.push("Review deadline must be after submission deadline.");
  }

  if (options.phase === "submission" && submissionDeadline && now >= submissionDeadline) {
    blockers.push("Submission deadline has passed.");
  }
  if (options.phase === "blind-review" && submissionDeadline && now < submissionDeadline) {
    blockers.push("Blind review has not started yet.");
  }
  if (options.phase === "winner-finalization" && submissionDeadline && now < submissionDeadline) {
    blockers.push("Winner finalization is not available before submission close.");
  }
  if (options.phase === "payout") {
    if (submissionDeadline && now < submissionDeadline) blockers.push("Payout is not available before submission close.");
    if (reviewDeadline && now <= reviewDeadline) blockers.push("Review deadline has not passed.");
  }

  return {
    challengeId,
    draftId,
    fundingIntentId: draft.funding.fundingIntentId,
    escrowContractAddress: intent.escrowContractAddress,
    bytecodeExists: true,
    isFunded: blockers.length === 0,
    sponsorMatchesBrand: true,
    prizePool: draft.prizePool.prizePoolUnits,
    platformFee: draft.prizePool.platformFeeUnits,
    winnerCount: draft.prizePool.winnerCount,
    prizeDistribution: draft.prizePool.distributionUnits.slice(0, draft.prizePool.winnerCount),
    submissionDeadline,
    reviewDeadline,
    acceptsSubmissions: Boolean(submissionDeadline && now < submissionDeadline),
    paused: false,
    publicationStatus: draft.deployment.publicationStatus,
    verified: blockers.length === 0,
    blockers,
  };
}

export async function verifyCanonicalChallengeForSubmission(draftId: string): Promise<FundedChallengeRead> {
  return verifyCanonicalChallengeForPhase(draftId, { phase: "submission" });
}

export async function verifyCanonicalChallengeForBlindReview(draftId: string): Promise<FundedChallengeRead> {
  const challenge = await verifyCanonicalChallengeForPhase(draftId, { phase: "blind-review" });
  const entries = challenge.challengeId ? await listBlindReviewEntries(challenge.challengeId) : [];
  if (challenge.verified && entries.length === 0) {
    return {
      ...challenge,
      verified: false,
      isFunded: false,
      blockers: [...challenge.blockers, "No finalized submissions are available for blind review."],
    };
  }
  return challenge;
}

export async function verifyCanonicalChallengeForWinnerFinalization(draftId: string): Promise<FundedChallengeRead> {
  const challenge = await verifyCanonicalChallengeForPhase(draftId, { phase: "winner-finalization" });
  const entries = challenge.challengeId ? await listBlindReviewEntries(challenge.challengeId) : [];
  if (challenge.verified && entries.length === 0) {
    return {
      ...challenge,
      verified: false,
      isFunded: false,
      blockers: [...challenge.blockers, "No finalized submissions are available for winner finalization."],
    };
  }
  return challenge;
}

export async function verifyCanonicalChallengeForPayout(draftId: string): Promise<FundedChallengeRead> {
  return verifyCanonicalChallengeForPhase(draftId, { phase: "payout" });
}

export async function saveCanonicalCreatorDraft(input: {
  draftId: string;
  creatorAccountId: string;
  creatorWalletAddress?: string;
  draft: SubmissionDraftInput;
}) {
  await assertCreatorIsNotChallengeOwner(input.draftId, input.creatorAccountId);
  const creatorPayout = await getVerifiedCreatorPayoutMapping(input.creatorAccountId);
  if (
    input.creatorWalletAddress &&
    input.creatorWalletAddress.toLowerCase() !== creatorPayout.walletAddress.toLowerCase()
  ) {
    safeError("Client-supplied creator wallet does not match the verified payout mapping.");
  }
  assertAddress(creatorPayout.walletAddress);
  const challenge = await verifyCanonicalChallengeForSubmission(input.draftId);
  if (!challenge.verified) safeError(challenge.blockers.join(" "));
  const submission = await saveCreatorDraft({
    challengeId: challenge.challengeId,
    creatorAccountId: input.creatorAccountId,
    creatorWalletAddress: creatorPayout.walletAddress,
    draft: input.draft,
  });
  return { submission, challenge };
}

export async function finalizeCanonicalCreatorSubmission(input: {
  draftId: string;
  creatorAccountId: string;
  idempotencyKey: unknown;
}) {
  await assertCreatorIsNotChallengeOwner(input.draftId, input.creatorAccountId);
  const challenge = await verifyCanonicalChallengeForSubmission(input.draftId);
  if (!challenge.verified) safeError(challenge.blockers.join(" "));
  const submission = await finalizeCreatorSubmission({
    challengeId: challenge.challengeId,
    creatorAccountId: input.creatorAccountId,
    idempotencyKey: input.idempotencyKey,
  });
  return { submission, challenge };
}

export async function getCanonicalSubmissionStatus(input: { draftId: string; creatorAccountId: string }) {
  const challenge = await verifyCanonicalChallengeForSubmission(input.draftId);
  const submission = await getCreatorSubmissionStatus({
    challengeId: challenge.challengeId,
    creatorAccountId: input.creatorAccountId,
  });
  return { submission, challenge };
}

export async function listCanonicalBlindReviewEntries(input: { draftId: string }) {
  const challenge = await verifyCanonicalChallengeForBlindReview(input.draftId);
  if (!challenge.verified) safeError(challenge.blockers.join(" "));
  const entries = await listBlindReviewEntries(challenge.challengeId);
  return { entries, challenge };
}

export async function resolveCanonicalWinnerSelection(input: {
  draftId: string;
  selectedBlindEntryIds: unknown;
}): Promise<WinnerFinalizationSelection[]> {
  const blindEntryIds = assertBlindEntryIds(input.selectedBlindEntryIds);
  const draft = await getCreateChallengeDraftStrict(input.draftId);
  const challenge = await verifyCanonicalChallengeForWinnerFinalization(input.draftId);
  if (!challenge.verified) safeError(challenge.blockers.join(" "));
  if (blindEntryIds.length !== draft.prizePool.winnerCount) {
    safeError(`Exactly ${draft.prizePool.winnerCount} winner${draft.prizePool.winnerCount === 1 ? "" : "s"} must be selected.`);
  }
  const submissions = await resolveSubmittedSelections({
    challengeId: challenge.challengeId,
    blindEntryIds,
  });
  return submissions.map((submission, index) => ({
    entryId: submission.id,
    creatorAccountId: submission.creatorAccountId,
    creatorWalletAddress: submission.creatorWalletAddress,
    challengeId: submission.challengeId,
    reviewable: submission.status === "SUBMITTED",
    rank: (index + 1) as 1 | 2 | 3,
    payoutAmountUnits: draft.prizePool.distributionUnits[index],
  }));
}
