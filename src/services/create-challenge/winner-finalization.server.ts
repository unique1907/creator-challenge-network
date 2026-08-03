import "server-only";

import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import { createOrFetchCircleUser } from "@/services/circle/user-controlled-wallets.server";
import {
  createPayoutContractExecutionChallenge,
  getArcReceipt,
  getPayoutChallengeTransaction,
  getPayoutTransactionStatus,
  normalizeCircleTransactionState,
  payoutExecutionFacts,
  readEscrowChallengeSnapshot,
  readEscrowChallengeStatus,
  resolveAuthorizedPayoutWallet,
  simulateReleasePayout,
  verifyPayoutWalletResolverRole,
  verifyWinnersPaidReceipt,
} from "@/services/circle/payout-contract-execution.server";
import {
  CREATE_CHALLENGE_ESCROW_CONTRACT,
  StoreConflictError,
  acquireWinnerFinalizationAttemptLock,
  findOnChainVerificationForDraft,
  getCreateChallengeDraftStrict,
  getWinnerFinalizationAttemptForScope,
  patchWinnerFinalizationAttempt,
  patchWinnerFinalizationAttemptForOwner,
  stableUuid,
  upsertLifecycleEvent,
  upsertOnChainVerification,
} from "@/services/create-challenge/create-challenge-store.server";
import { verifyCanonicalChallengeForPayout } from "@/services/submissions/canonical-challenge-lifecycle.server";
import { resolveSubmittedSelections } from "@/services/submissions/submission-store.server";
import { getVerifiedCreatorPayoutMapping } from "@/services/circle/creator-payout-account.server";
import type {
  WinnerFinalizationAuthority,
  WinnerFinalizationRecord,
  WinnerFinalizationSelection,
  WinnerFinalizationState,
  WinnerFinalizationSummary,
} from "@/types/winner-finalization";

const ARC_TESTNET_CHAIN_ID = 5_042_002;
const ARC_EXPLORER_BASE_URL = "https://testnet.arcscan.app";
const RELEASE_PAYOUT_SIGNATURE = "releasePayout(bytes32,address[])";
const WINNERS_PAID_EVENT =
  "WinnersPaid(bytes32 indexed challengeId,address[] winners,uint256[] amounts,uint256 platformFee,address indexed treasury)";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const PLACEHOLDER_WINNER_WALLETS = new Set([
  "0x1111111111111111111111111111111111111111",
]);
const PAYOUT_TREASURY_ENV = "CCN_PAYOUT_TREASURY_ADDRESS";
const PAYOUT_ACCOUNT_ENV = "CCN_PAYOUT_ACCOUNT_ID";

type WinnerFinalizationScope = {
  ccnAccountId: string;
  draftId: string;
  challengeId: `0x${string}`;
  fundingIntentId: string;
};

type PayoutCircleSession = {
  ccnAccountId: string;
  userToken: string;
  encryptionKey: string;
};

type PayoutReadinessVerification = {
  verified: boolean;
  mismatches: string[];
  snapshot: Awaited<ReturnType<typeof readEscrowChallengeSnapshot>>;
};

class WinnerOperationConflictError extends CircleSpikeError {
  constructor(message = "Winner payout approval is already being prepared.") {
    super({ message, status: 409 });
    this.name = "WinnerOperationConflictError";
  }
}

export function winnerFinalizationIntegrationFacts() {
  return {
    chainId: ARC_TESTNET_CHAIN_ID,
    explorerBaseUrl: ARC_EXPLORER_BASE_URL,
    escrowContractAddress: CREATE_CHALLENGE_ESCROW_CONTRACT,
    releasePayoutSignature: RELEASE_PAYOUT_SIGNATURE,
    winnersPaidEvent: WINNERS_PAID_EVENT,
    payoutExecution: payoutExecutionFacts(),
    mvpFinalActionLabel: "Confirm Winners and Release Payment" as const,
  };
}

function isAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function normalizeAddress(value: `0x${string}`): `0x${string}` {
  return value.toLowerCase() as `0x${string}`;
}

function safeError(message: string, status = 400): never {
  throw new CircleSpikeError({ message, status });
}

function unixSeconds(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.floor(parsed / 1000);
}

function normalizedUnits(value: string | number | bigint) {
  return BigInt(value).toString();
}

function sameAddress(left: string | undefined, right: string | undefined) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

function isTerminalNegativeCircleState(value: unknown) {
  const normalized = normalizeCircleTransactionState(value);
  return normalized === "FAILED" || normalized === "CANCELLED";
}

function assertPayoutReadiness(verification: PayoutReadinessVerification) {
  if (verification.verified) return verification;
  throw new CircleSpikeError({
    message: `Payout readiness verification failed: ${verification.mismatches.join(", ")}.`,
    status: 409,
  });
}

function resolvePayoutAccountId() {
  const accountId = process.env[PAYOUT_ACCOUNT_ENV];
  if (!accountId || !/^[A-Za-z0-9._:-]{5,50}$/.test(accountId)) {
    safeError("Configured payout account is not available.", 501);
  }
  return accountId;
}

async function createTrustedPayoutCircleSession(): Promise<PayoutCircleSession> {
  const ccnAccountId = resolvePayoutAccountId();
  const session = await createOrFetchCircleUser({
    ccnAccountId,
    authProvider: "email",
  });
  return {
    ccnAccountId,
    userToken: session.userToken,
    encryptionKey: session.encryptionKey,
  };
}

async function assertConfiguredPayoutAuthority() {
  const authority = await resolveAuthorizedPayoutWallet();
  const hasResolverRole = await verifyPayoutWalletResolverRole(
    authority.walletAddress,
    authority.escrowContractAddress,
  );
  if (!hasResolverRole) {
    safeError("Configured payout wallet is not authorized with RESOLVER_ROLE.", 422);
  }
  return authority;
}

async function assertPayoutSimulationReady(input: {
  summary: WinnerFinalizationSummary;
  payoutWalletAddress: `0x${string}`;
}) {
  const simulation = await simulateReleasePayout({
    escrowContractAddress: input.summary.escrowContractAddress,
    from: input.payoutWalletAddress,
    challengeId: input.summary.challengeId,
    winners: input.summary.winnerWalletAddresses,
  });
  if (!simulation.success) {
    safeError("Payout contract simulation did not return a successful result.", 422);
  }
  return simulation;
}

function scopeFor(input: {
  draftId: string;
  summary: WinnerFinalizationSummary;
  fundingIntentId: string;
}): WinnerFinalizationScope {
  return {
    ccnAccountId: resolvePayoutAccountId(),
    draftId: input.draftId,
    challengeId: input.summary.challengeId,
    fundingIntentId: input.fundingIntentId,
  };
}

function resolvePayoutTreasuryRecipient(): `0x${string}` {
  const treasuryRecipient = process.env[PAYOUT_TREASURY_ENV];
  if (!treasuryRecipient || !isAddress(treasuryRecipient)) {
    safeError("Payout treasury recipient is not configured on the server.", 501);
  }
  return treasuryRecipient;
}

export async function verifyOnChainPayoutReadiness(input: {
  draftId: string;
  summary: WinnerFinalizationSummary;
}): Promise<PayoutReadinessVerification> {
  const draft = await getCreateChallengeDraftStrict(input.draftId);
  const snapshot = await readEscrowChallengeSnapshot({
    escrowContractAddress: input.summary.escrowContractAddress,
    challengeId: input.summary.challengeId,
  });
  const mismatches: string[] = [];
  const expectedSubmissionDeadline = unixSeconds(draft.reviewRules.submissionDeadline);
  const expectedReviewDeadline = unixSeconds(draft.reviewRules.reviewDeadline);

  if (snapshot.challengeId.toLowerCase() !== input.summary.challengeId.toLowerCase()) {
    mismatches.push("challengeId");
  }
  if (!snapshot.isFunded) mismatches.push("isFunded");
  if (snapshot.status !== "FUNDED") mismatches.push("contractStatus");
  if (!sameAddress(snapshot.sponsor, draft.funding.walletAddress)) mismatches.push("sponsor");
  if (normalizedUnits(snapshot.prizePool) !== normalizedUnits(input.summary.totalPrizePool)) {
    mismatches.push("prizePool");
  }
  if (normalizedUnits(snapshot.platformFee) !== normalizedUnits(input.summary.platformFee)) {
    mismatches.push("platformFee");
  }
  if (snapshot.winnerCount !== draft.prizePool.winnerCount) mismatches.push("winnerCount");
  if (
    snapshot.prizeDistribution.map(normalizedUnits).join(":") !==
    input.summary.payoutAmounts.map(normalizedUnits).join(":")
  ) {
    mismatches.push("prizeDistribution");
  }
  if (snapshot.submissionDeadline !== expectedSubmissionDeadline) mismatches.push("submissionDeadline");
  if (snapshot.reviewDeadline !== expectedReviewDeadline) mismatches.push("reviewDeadline");
  if (
    snapshot.escrowContractAddress.toLowerCase() !==
    CREATE_CHALLENGE_ESCROW_CONTRACT.toLowerCase()
  ) {
    mismatches.push("runtimeEscrowContract");
  }
  if (!sameAddress(snapshot.treasury, input.summary.treasuryRecipient)) {
    mismatches.push("treasury");
  }

  return {
    verified: mismatches.length === 0,
    mismatches,
    snapshot,
  };
}

async function assertPayoutPhaseReady(draftId: string) {
  const challenge = await verifyCanonicalChallengeForPayout(draftId);
  if (!challenge.verified) safeError(challenge.blockers.join(" "));
  return challenge;
}

function assertNoDuplicate(values: string[], message: string) {
  if (new Set(values.map((value) => value.toLowerCase())).size !== values.length) {
    safeError(message);
  }
}

function sumUnits(values: string[]) {
  return values.reduce((total, value) => total + BigInt(value), BigInt(0)).toString();
}

function canonicalOperationKey(input: {
  summary: WinnerFinalizationSummary;
  selectedWinnerEntryIds: string[];
  fundingIntentId: string;
}) {
  return stableUuid("winner-payout-operation", [
    input.summary.escrowContractAddress.toLowerCase(),
    input.summary.challengeId.toLowerCase(),
    input.fundingIntentId,
    input.selectedWinnerEntryIds.join(":"),
    input.summary.winnerWalletAddresses.map((wallet) => wallet.toLowerCase()).join(":"),
    input.summary.payoutAmounts.join(":"),
    input.summary.totalPrizePool,
    input.summary.platformFee,
    "releasePayout",
  ].join("|"));
}

function arraysEqual(left: string[] = [], right: string[] = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertMatchesFinalizedWinnerRecord(input: {
  existing: Awaited<ReturnType<typeof getWinnerFinalizationAttemptForScope>>;
  summary: WinnerFinalizationSummary;
  selectedWinnerEntryIds: string[];
}) {
  const existing = input.existing;
  if (!existing?.finalizedAt) {
    safeError("Winner selection must be finalized before payout preparation.", 409);
  }
  if (existing.challengeId.toLowerCase() !== input.summary.challengeId.toLowerCase()) {
    safeError("Finalized winner record does not match this challenge.", 409);
  }
  if (!arraysEqual(existing.selectedWinnerEntryIds, input.selectedWinnerEntryIds)) {
    safeError("Winner selection does not match the finalized record.", 409);
  }
  if (
    !arraysEqual(
      existing.winnerWalletAddresses.map((wallet) => wallet.toLowerCase()),
      input.summary.winnerWalletAddresses.map((wallet) => wallet.toLowerCase()),
    )
  ) {
    safeError("Finalized winner wallets do not match this payout operation.", 409);
  }
}

function ensureSelectionBelongsToChallenge(
  challengeId: `0x${string}`,
  selection: WinnerFinalizationSelection[],
) {
  for (const winner of selection) {
    if (!isAddress(winner.creatorWalletAddress)) {
      safeError("Winner wallet address is invalid.");
    }
    if (normalizeAddress(winner.creatorWalletAddress) === ZERO_ADDRESS) {
      safeError("Winner wallet address is invalid.");
    }
    if (winner.challengeId.toLowerCase() !== challengeId.toLowerCase()) {
      safeError("Selected entry does not belong to this challenge.");
    }
    if (!winner.reviewable) {
      safeError("Selected entry is not reviewable.");
    }
  }
}

async function assertVerifiedWinnerPayoutWallets(input: {
  draftId: string;
  selectedWinners: WinnerFinalizationSelection[];
  summary: WinnerFinalizationSummary;
  payoutWalletAddress: `0x${string}`;
}) {
  const draft = await getCreateChallengeDraftStrict(input.draftId);
  const forbidden = new Set([
    ZERO_ADDRESS,
    CREATE_CHALLENGE_ESCROW_CONTRACT.toLowerCase(),
    input.summary.treasuryRecipient.toLowerCase(),
    input.payoutWalletAddress.toLowerCase(),
    draft.funding.walletAddress.toLowerCase(),
    ...PLACEHOLDER_WINNER_WALLETS,
  ]);

  for (const winner of input.selectedWinners) {
    const walletAddress = normalizeAddress(winner.creatorWalletAddress);
    if (forbidden.has(walletAddress)) {
      safeError("Winner payout wallet is not verified for this creator.", 422);
    }

    let mapping: Awaited<ReturnType<typeof getVerifiedCreatorPayoutMapping>>;
    try {
      mapping = await getVerifiedCreatorPayoutMapping(winner.creatorAccountId);
    } catch {
      safeError("Winner payout wallet is not verified for this creator.", 422);
    }
    if (
      mapping.blockchain !== "ARC-TESTNET" ||
      mapping.accountType !== "SCA" ||
      mapping.walletState.toLowerCase() !== "live" ||
      mapping.walletAddress.toLowerCase() !== walletAddress
    ) {
      safeError("Winner payout wallet is not verified for this creator.", 422);
    }
  }
}

function expectedRanks(winnerCount: 1 | 3) {
  return winnerCount === 1 ? [1] : [1, 2, 3];
}

export async function buildWinnerFinalizationSummary(input: {
  draftId: string;
  authority: WinnerFinalizationAuthority;
  selectedWinners: WinnerFinalizationSelection[];
}): Promise<WinnerFinalizationSummary> {
  const draft = await getCreateChallengeDraftStrict(input.draftId);
  const challengeId = draft.challenge.challengeId ?? draft.deployment.challengeId;
  if (!challengeId) safeError("Challenge ID is required.");
  if (!/^0x[a-fA-F0-9]{64}$/.test(challengeId)) safeError("Challenge ID must be bytes32.");
  const typedChallengeId = challengeId as `0x${string}`;
  const winnerCount = draft.prizePool.winnerCount;

  if (input.selectedWinners.length !== winnerCount) {
    safeError(`Exactly ${winnerCount} winner${winnerCount === 1 ? "" : "s"} must be selected.`);
  }

  const ranks = input.selectedWinners.map((winner) => winner.rank).sort();
  if (ranks.join(",") !== expectedRanks(winnerCount).join(",")) {
    safeError("Selected winner ranks do not match the configured winner model.");
  }

  ensureSelectionBelongsToChallenge(typedChallengeId, input.selectedWinners);
  assertNoDuplicate(
    input.selectedWinners.map((winner) => winner.creatorWalletAddress),
    "Winner wallet addresses must be distinct.",
  );
  assertNoDuplicate(
    input.selectedWinners.map((winner) => winner.entryId),
    "Winner entries must be distinct.",
  );
  assertNoDuplicate(
    input.selectedWinners.map((winner) => winner.creatorAccountId),
    "Winner creators must be distinct.",
  );

  const sortedWinners = [...input.selectedWinners].sort((a, b) => a.rank - b.rank);
  const payoutAmounts = sortedWinners.map((winner) => winner.payoutAmountUnits);
  if (sumUnits(payoutAmounts) !== draft.prizePool.prizePoolUnits) {
    safeError("Winner payout amounts must sum exactly to the configured Prize Pool.");
  }
  if (
    payoutAmounts.join(":") !== draft.prizePool.distributionUnits.slice(0, winnerCount).join(":")
  ) {
    safeError("Winner payout amounts must match the configured prize distribution.");
  }

  const fundingEvidence = await findOnChainVerificationForDraft({
    draftId: input.draftId,
    challengeId: typedChallengeId,
    fundingIntentId: draft.funding.fundingIntentId,
  });
  if (!fundingEvidence?.eventVerified || !draft.funding.eventVerified) {
    safeError("Escrow funding must be verified before final winner selection.");
  }
  if (
    draft.deployment.publicationStatus !== "live" &&
    draft.deployment.publicationStatus !== "ready-to-publish"
  ) {
    safeError("Challenge must be funded and published before winner finalization.");
  }

  const treasuryRecipient = resolvePayoutTreasuryRecipient();

  return {
    label: "Confirm Winners and Release Payment",
    state: "READY_FOR_FINAL_SELECTION",
    authority: input.authority,
    challengeId: typedChallengeId,
    escrowContractAddress: CREATE_CHALLENGE_ESCROW_CONTRACT,
    winnerWalletAddresses: sortedWinners.map((winner) => winner.creatorWalletAddress),
    payoutAmounts,
    totalPrizePool: draft.prizePool.prizePoolUnits,
    platformFee: draft.prizePool.platformFeeUnits,
    treasuryRecipient,
    totalTransactionEffect: (
      BigInt(draft.prizePool.prizePoolUnits) + BigInt(draft.prizePool.platformFeeUnits)
    ).toString(),
    irreversible: true,
  };
}

async function resolveFinalizedWinnerOperation(input: {
  draftId: string;
  authority: WinnerFinalizationAuthority;
}) {
  const draft = await getCreateChallengeDraftStrict(input.draftId);
  const challengeId = draft.challenge.challengeId ?? draft.deployment.challengeId;
  if (!challengeId) safeError("Challenge ID is required.");
  if (!/^0x[a-fA-F0-9]{64}$/.test(challengeId)) safeError("Challenge ID must be bytes32.");
  const typedChallengeId = challengeId as `0x${string}`;
  const scope: WinnerFinalizationScope = {
    ccnAccountId: resolvePayoutAccountId(),
    draftId: input.draftId,
    challengeId: typedChallengeId,
    fundingIntentId: draft.funding.fundingIntentId,
  };
  const attempt = await getWinnerFinalizationAttemptForScope(scope);
  if (!attempt?.finalizedAt) {
    safeError("Winner selection must be finalized before payout reconciliation.", 409);
  }
  if (attempt.challengeId.toLowerCase() !== typedChallengeId.toLowerCase()) {
    safeError("Finalized payout attempt does not match this challenge.", 409);
  }
  if (attempt.fundingIntentId !== draft.funding.fundingIntentId) {
    safeError("Finalized payout attempt does not match this funding intent.", 409);
  }
  const winnerCount = draft.prizePool.winnerCount;
  if (attempt.winnerWalletAddresses.length !== winnerCount) {
    safeError("Finalized payout attempt winner count does not match the challenge.", 409);
  }
  if (attempt.selectedWinnerEntryIds.length !== winnerCount) {
    safeError("Finalized payout attempt entries do not match the winner model.", 409);
  }

  const payoutAmounts = draft.prizePool.distributionUnits.slice(0, winnerCount);
  if (sumUnits(payoutAmounts) !== draft.prizePool.prizePoolUnits) {
    safeError("Finalized payout amounts do not match the configured Prize Pool.", 409);
  }
  const winnerWalletAddresses = attempt.winnerWalletAddresses.map((wallet) => {
    if (!isAddress(wallet)) safeError("Finalized winner wallet address is invalid.", 409);
    return wallet as `0x${string}`;
  });
  assertNoDuplicate(winnerWalletAddresses, "Finalized winner wallet addresses must be distinct.");

  const treasuryRecipient = resolvePayoutTreasuryRecipient();
  const summary: WinnerFinalizationSummary = {
    label: "Confirm Winners and Release Payment",
    state: attempt.state,
    authority: input.authority,
    challengeId: typedChallengeId,
    escrowContractAddress: CREATE_CHALLENGE_ESCROW_CONTRACT,
    winnerWalletAddresses,
    payoutAmounts,
    totalPrizePool: draft.prizePool.prizePoolUnits,
    platformFee: draft.prizePool.platformFeeUnits,
    treasuryRecipient,
    totalTransactionEffect: (
      BigInt(draft.prizePool.prizePoolUnits) + BigInt(draft.prizePool.platformFeeUnits)
    ).toString(),
    irreversible: true,
  };
  const submissions = await resolveSubmittedSelections({
    challengeId: typedChallengeId,
    blindEntryIds: attempt.selectedWinnerEntryIds,
  });
  const selectedWinners = attempt.selectedWinnerEntryIds.map((entryId, index) => {
    const submission = submissions.find((item) => item.id === entryId);
    if (!submission) safeError("Finalized winner submission could not be resolved.", 409);
    if (submission.creatorWalletAddress.toLowerCase() !== winnerWalletAddresses[index].toLowerCase()) {
      safeError("Finalized winner wallet does not match the canonical submission.", 409);
    }
    return {
      entryId,
      creatorAccountId: submission.creatorAccountId,
      creatorWalletAddress: winnerWalletAddresses[index],
      challengeId: typedChallengeId,
      reviewable: submission.status === "SUBMITTED",
      rank: (index + 1) as 1 | 2 | 3,
      payoutAmountUnits: payoutAmounts[index],
    };
  });
  assertMatchesFinalizedWinnerRecord({
    existing: attempt,
    summary,
    selectedWinnerEntryIds: selectedWinners.map((winner) => winner.entryId),
  });
  return { draft, scope, attempt, summary, selectedWinners };
}

function parsePayoutTransactionHash(value: string | undefined) {
  if (!value) return null;
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    safeError("Payout transaction hash is invalid.", 422);
  }
  return value as `0x${string}`;
}

function blockNumberFromReceipt(receipt: Awaited<ReturnType<typeof getArcReceipt>>) {
  return receipt?.blockNumber ? Number(BigInt(receipt.blockNumber)) : undefined;
}

async function persistVerifiedPayoutEvidence(input: {
  scope: WinnerFinalizationScope;
  attempt: Awaited<ReturnType<typeof getWinnerFinalizationAttemptForScope>>;
  summary: WinnerFinalizationSummary;
  transactionHash: `0x${string}`;
  blockNumber?: number;
  verification: NonNullable<WinnerFinalizationRecord["reconciliation"]>;
  contractStatus: string;
}) {
  if (!input.attempt?.circleChallengeId || !input.attempt.circleTransactionId) {
    safeError("Verified payout is missing Circle audit identifiers.", 409);
  }
  const now = new Date().toISOString();
  await upsertOnChainVerification({
    txHash: input.transactionHash,
    circleChallengeId: input.attempt.circleChallengeId,
    circleTransactionId: input.attempt.circleTransactionId,
    draftId: input.scope.draftId,
    challengeId: input.scope.challengeId,
    fundingIntentId: input.scope.fundingIntentId,
    walletId: input.attempt.payoutWalletId ?? "unavailable",
    ccnAccountId: input.scope.ccnAccountId,
    eventType: "ChallengePayout",
    eventName: "WinnersPaid",
    runtimeContractAddress: input.summary.escrowContractAddress,
    blockNumber: input.blockNumber ?? null,
    verifiedAt: now,
    receiptStatus: "success",
    receiptVerified: input.verification.receiptVerified,
    eventVerified: input.verification.eventVerified,
    challengeVerified: input.verification.challengeVerified,
    winnersVerified: input.verification.winnersVerified,
    amountVerified: input.verification.amountsVerified,
    feeVerified: input.verification.feeVerified,
    treasuryVerified: input.verification.treasuryVerified,
    finalContractStatus: input.contractStatus,
    winnerWalletAddresses: input.summary.winnerWalletAddresses,
    payoutAmounts: input.summary.payoutAmounts,
    platformFee: input.summary.platformFee,
    treasuryRecipient: input.summary.treasuryRecipient,
  });
  await upsertLifecycleEvent({
    draftId: input.scope.draftId,
    challengeId: input.scope.challengeId,
    eventType: "SETTLEMENT_COMPLETED",
    eventState: {
      transactionHash: input.transactionHash,
      circleChallengeId: input.attempt.circleChallengeId,
      circleTransactionId: input.attempt.circleTransactionId,
      blockNumber: input.blockNumber ?? null,
      finalContractStatus: input.contractStatus,
      eventType: "ChallengePayout",
      contractEventName: "WinnersPaid",
    },
  });
}

export function canRequestRefundDuringFinalization(state: WinnerFinalizationState) {
  return state !== "FINALIZATION_IN_PROGRESS" &&
    state !== "PAYOUT_CONFIRMED" &&
    state !== "ALREADY_FINALIZED";
}

export async function prepareWinnerFinalization(input: {
  draftId: string;
  authority: WinnerFinalizationAuthority;
  selectedWinners: WinnerFinalizationSelection[];
}) {
  await assertPayoutPhaseReady(input.draftId);
  const summary = await buildWinnerFinalizationSummary(input);
  const draft = await getCreateChallengeDraftStrict(input.draftId);
  const scope = scopeFor({
    draftId: input.draftId,
    summary,
    fundingIntentId: draft.funding.fundingIntentId,
  });
  const finalized = await getWinnerFinalizationAttemptForScope(scope);
  if (!finalized?.finalizedAt) {
    safeError("Winner selection must be finalized before payout preparation.", 409);
  }
  if (
    finalized.selectedWinnerEntryIds.join(":") !==
    input.selectedWinners.map((winner) => winner.entryId).join(":")
  ) {
    safeError("Winner selection does not match the finalized record.", 409);
  }
  const payoutAuthority = await assertConfiguredPayoutAuthority();
  await assertVerifiedWinnerPayoutWallets({
    draftId: input.draftId,
    selectedWinners: input.selectedWinners,
    summary,
    payoutWalletAddress: payoutAuthority.walletAddress,
  });
  const readiness = assertPayoutReadiness(await verifyOnChainPayoutReadiness({
    draftId: input.draftId,
    summary,
  }));
  const simulation = await assertPayoutSimulationReady({
    summary,
    payoutWalletAddress: payoutAuthority.walletAddress,
  });
  return {
    ccnAccountId: resolvePayoutAccountId(),
    confirmation: summary,
    payoutAuthority: {
      walletId: payoutAuthority.walletId,
      walletAddress: payoutAuthority.walletAddress,
      escrowContractAddress: payoutAuthority.escrowContractAddress,
      treasuryAddress: payoutAuthority.treasuryAddress,
      resolverRole: true,
    },
    contractCall: {
      signature: RELEASE_PAYOUT_SIGNATURE,
      challengeId: summary.challengeId,
      winners: summary.winnerWalletAddresses,
      simulation: {
        success: simulation.success,
      },
      onChainReadiness: {
        verified: readiness.verified,
        status: readiness.snapshot.status,
      },
    },
    eventToReconcile: WINNERS_PAID_EVENT,
  };
}

export async function finalizeWinnerSelection(input: {
  draftId: string;
  authority: WinnerFinalizationAuthority;
  selectedWinners: WinnerFinalizationSelection[];
}): Promise<WinnerFinalizationRecord> {
  const summary = await buildWinnerFinalizationSummary(input);
  const draft = await getCreateChallengeDraftStrict(input.draftId);
  const scope = scopeFor({
    draftId: input.draftId,
    summary,
    fundingIntentId: draft.funding.fundingIntentId,
  });
  const existing = await getWinnerFinalizationAttemptForScope(scope);
  if (existing?.finalizedAt || existing?.state === "PAYOUT_CONFIRMED") {
    assertMatchesFinalizedWinnerRecord({
      existing,
      summary,
      selectedWinnerEntryIds: input.selectedWinners.map((winner) => winner.entryId),
    });
    return {
      ...summary,
      state: existing.state,
      draftId: input.draftId,
      lockId: existing.lockId,
      circleChallengeId: existing.circleChallengeId,
      circleTransactionId: existing.circleTransactionId ?? null,
      transactionHash: existing.transactionHash as `0x${string}` | undefined,
      blockNumber: existing.blockNumber,
      receiptStatus: existing.receiptStatus,
      payoutConfirmedAt: existing.payoutConfirmedAt,
      reconciliationSource: existing.reconciliationSource,
      finalContractStatus: existing.finalContractStatus,
      finalizedAt: existing.finalizedAt,
      errorMessage: existing.errorMessage,
      reconciliation: existing.reconciliation as WinnerFinalizationRecord["reconciliation"],
    };
  }
  if (existing && isActivePayoutState(existing.state)) {
    safeError("Winner finalization is already in progress.", 409);
  }

  const attempt = await acquireWinnerFinalizationAttemptLock({
    ccnAccountId: scope.ccnAccountId,
    draftId: scope.draftId,
    challengeId: scope.challengeId,
    fundingIntentId: scope.fundingIntentId,
    selectedWinnerEntryIds: input.selectedWinners.map((winner) => winner.entryId),
    winnerWalletAddresses: summary.winnerWalletAddresses,
  }).catch((error) => {
    if (error instanceof StoreConflictError) {
      safeError("Winner selection is already finalized.", 409);
    }
    throw error;
  });
  const finalizedAt = new Date().toISOString();
  await patchWinnerFinalizationAttempt({
    scope,
    patch: {
      state: "READY_FOR_FINAL_SELECTION",
      finalizedAt,
      lastCheckedAt: finalizedAt,
      errorMessage: undefined,
    },
  });
  await upsertLifecycleEvent({
    draftId: input.draftId,
    challengeId: scope.challengeId,
    eventType: "winner_finalized",
    eventState: {
      authority: input.authority,
      state: "READY_FOR_FINAL_SELECTION",
      finalizedAt,
      selectedWinnerEntryIds: input.selectedWinners.map((winner) => winner.entryId),
      winnerCount: input.selectedWinners.length,
    },
  });

  return {
    ...summary,
    state: "READY_FOR_FINAL_SELECTION",
    draftId: input.draftId,
    lockId: attempt.lockId,
    finalizedAt,
  };
}

function isActivePayoutState(state: WinnerFinalizationState) {
  return state === "ACTION_REQUIRED" ||
    state === "APPROVAL_CREATION_IN_PROGRESS" ||
    state === "APPROVAL_CREATED_RECONCILIATION_REQUIRED" ||
    state === "FINALIZATION_IN_PROGRESS" ||
    state === "TRANSACTION_SUBMITTED" ||
    state === "RECONCILIATION_REQUIRED";
}

async function getOrCreateWinnerFinalizationAttempt(input: {
  draftId: string;
  summary: WinnerFinalizationSummary;
  fundingIntentId: string;
  selectedWinners: WinnerFinalizationSelection[];
}) {
  const scope = scopeFor({
    draftId: input.draftId,
    summary: input.summary,
    fundingIntentId: input.fundingIntentId,
  });
  const existing = await getWinnerFinalizationAttemptForScope(scope);
  assertMatchesFinalizedWinnerRecord({
    existing,
    summary: input.summary,
    selectedWinnerEntryIds: input.selectedWinners.map((winner) => winner.entryId),
  });
  const operationKey = canonicalOperationKey({
    summary: input.summary,
    selectedWinnerEntryIds: input.selectedWinners.map((winner) => winner.entryId),
    fundingIntentId: input.fundingIntentId,
  });
  if (existing?.circleChallengeId) {
    return { scope, attempt: existing, reused: true, owner: false, operationKey };
  }
  if (existing && isActivePayoutState(existing.state)) {
    throw new WinnerOperationConflictError();
  }

  const attempt = await acquireWinnerFinalizationAttemptLock({
    ccnAccountId: scope.ccnAccountId,
    draftId: scope.draftId,
    challengeId: scope.challengeId,
    fundingIntentId: scope.fundingIntentId,
    selectedWinnerEntryIds: input.selectedWinners.map((winner) => winner.entryId),
    winnerWalletAddresses: input.summary.winnerWalletAddresses,
  }).catch((error) => {
    if (error instanceof StoreConflictError) {
      throw new WinnerOperationConflictError();
    }
    throw error;
  });
  await patchWinnerFinalizationAttemptForOwner({
    scope,
    ownerToken: attempt.operationOwnerToken ?? "",
    patch: {
      state: "APPROVAL_CREATION_IN_PROGRESS",
      operationKey,
      approvalCreationStartedAt: new Date().toISOString(),
      errorMessage: undefined,
    },
  });
  const reserved = await getWinnerFinalizationAttemptForScope(scope);
  return { scope, attempt: reserved ?? attempt, reused: false, owner: true, operationKey };
}

export async function createWinnerPayoutApproval(input: {
  draftId: string;
  authority: WinnerFinalizationAuthority;
  selectedWinners: WinnerFinalizationSelection[];
}): Promise<WinnerFinalizationRecord> {
  await assertPayoutPhaseReady(input.draftId);
  const summary = await buildWinnerFinalizationSummary(input);
  const draft = await getCreateChallengeDraftStrict(input.draftId);
  const authority = await assertConfiguredPayoutAuthority();
  await assertVerifiedWinnerPayoutWallets({
    draftId: input.draftId,
    selectedWinners: input.selectedWinners,
    summary,
    payoutWalletAddress: authority.walletAddress,
  });
  assertPayoutReadiness(await verifyOnChainPayoutReadiness({
    draftId: input.draftId,
    summary,
  }));
  await assertPayoutSimulationReady({
    summary,
    payoutWalletAddress: authority.walletAddress,
  });

  const { scope, attempt, owner } = await getOrCreateWinnerFinalizationAttempt({
    draftId: input.draftId,
    fundingIntentId: draft.funding.fundingIntentId,
    selectedWinners: input.selectedWinners,
    summary,
  });

  const existingChallengeId = attempt.circleChallengeId;
  if (!existingChallengeId && !owner) {
    throw new WinnerOperationConflictError();
  }

  const session = await createTrustedPayoutCircleSession();
  if (session.ccnAccountId !== authority.ccnAccountId) {
    safeError("Circle payout session is not bound to the configured payout account.", 409);
  }

  const challenge = existingChallengeId
    ? { circleChallengeId: existingChallengeId, state: "ACTION_REQUIRED" as const }
    : await createPayoutContractExecutionChallenge({
      userToken: session.userToken,
      idempotencyKey: attempt.idempotencyKey,
      challengeId: summary.challengeId,
      winners: summary.winnerWalletAddresses,
    }).catch(async (error) => {
      if (owner && attempt.operationOwnerToken) {
        await patchWinnerFinalizationAttemptForOwner({
          scope,
          ownerToken: attempt.operationOwnerToken,
          patch: {
            state: "FINALIZATION_FAILED",
            errorMessage: error instanceof Error ? error.message : "Circle payout approval creation failed.",
            lastCheckedAt: new Date().toISOString(),
          },
        }).catch(() => undefined);
      }
      throw error;
    });

  if (owner && attempt.operationOwnerToken) {
    await patchWinnerFinalizationAttemptForOwner({
      scope,
      ownerToken: attempt.operationOwnerToken,
      patch: {
        state: "ACTION_REQUIRED",
        payoutWalletId: authority.walletId,
        payoutWalletAddress: authority.walletAddress,
        circleStatus: challenge.state,
        circleChallengeId: challenge.circleChallengeId,
        approvalCreatedAt: new Date().toISOString(),
        errorMessage: undefined,
        lastCheckedAt: new Date().toISOString(),
      },
    }).catch(async (error) => {
      await patchWinnerFinalizationAttemptForOwner({
        scope,
        ownerToken: attempt.operationOwnerToken ?? "",
        patch: {
          state: "APPROVAL_CREATED_RECONCILIATION_REQUIRED",
          payoutWalletId: authority.walletId,
          payoutWalletAddress: authority.walletAddress,
          circleStatus: challenge.state,
          circleChallengeId: challenge.circleChallengeId,
          errorMessage: error instanceof Error ? error.message : "Circle approval result requires reconciliation.",
          lastCheckedAt: new Date().toISOString(),
        },
      }).catch(() => undefined);
      throw error;
    });
  }

  return {
    ...summary,
    state: "ACTION_REQUIRED",
    draftId: input.draftId,
    lockId: attempt.lockId,
    circleChallengeId: challenge.circleChallengeId,
    userToken: session.userToken,
    encryptionKey: session.encryptionKey,
  } as WinnerFinalizationRecord & {
    circleChallengeId: string;
    userToken: string;
    encryptionKey: string;
  };
}

async function resolvePayoutTransaction(input: {
  scope: WinnerFinalizationScope;
  userToken: string;
  circleChallengeId?: string;
  circleTransactionId?: string;
}) {
  let circleTransactionId = input.circleTransactionId ?? null;
  let circleStatus = "UNKNOWN";
  if (!circleTransactionId && input.circleChallengeId) {
    const challenge = await getPayoutChallengeTransaction({
      userToken: input.userToken,
      circleChallengeId: input.circleChallengeId,
    });
    circleTransactionId = challenge.circleTransactionId;
    circleStatus = challenge.circleStatus;
    const normalizedChallengeState = normalizeCircleTransactionState(circleStatus);
    if (!circleTransactionId && isTerminalNegativeCircleState(circleStatus)) {
      const now = new Date().toISOString();
      await patchWinnerFinalizationAttempt({
        scope: input.scope,
        patch: {
          state: "FINALIZATION_FAILED",
          circleStatus: normalizedChallengeState,
          circleTransactionId: undefined,
          reconciliationSource: "circle",
          errorMessage: "Circle Hosted PAYOUT approval was not completed.",
          lastCheckedAt: now,
        },
      });
      return {
        circleStatus: normalizedChallengeState,
        circleTransactionId: null,
        circleTransactionState: normalizedChallengeState,
        transactionHash: null,
      };
    }
    if (circleTransactionId) {
      await patchWinnerFinalizationAttempt({
        scope: input.scope,
        patch: {
          circleStatus: normalizedChallengeState,
          circleTransactionId,
          lastCheckedAt: new Date().toISOString(),
        },
      });
    }
  }

  if (!circleTransactionId) {
    return {
      circleStatus,
      circleTransactionId: null,
      circleTransactionState: "ACTION_REQUIRED" as const,
      transactionHash: null,
    };
  }

  const transaction = await getPayoutTransactionStatus({
    userToken: input.userToken,
    transactionId: circleTransactionId,
  });
  const terminalFailure = isTerminalNegativeCircleState(transaction.state);
  const nextState: WinnerFinalizationState = terminalFailure
    ? "FINALIZATION_FAILED"
    : transaction.state === "CONFIRMED"
      ? "TRANSACTION_SUBMITTED"
      : "FINALIZATION_IN_PROGRESS";
  await patchWinnerFinalizationAttempt({
    scope: input.scope,
    patch: {
      state: nextState,
      circleStatus: transaction.state,
      circleTransactionId: transaction.transactionId,
      transactionHash: transaction.transactionHash,
      reconciliationSource: terminalFailure ? "circle" : undefined,
      errorMessage: terminalFailure ? "Circle PAYOUT transaction failed before on-chain confirmation." : undefined,
      lastCheckedAt: new Date().toISOString(),
    },
  });
  return {
    circleStatus,
    circleTransactionId: transaction.transactionId,
    circleTransactionState: transaction.state,
    transactionHash: transaction.transactionHash ?? null,
  };
}

export async function getWinnerPayoutStatus(input: {
  draftId: string;
  authority: WinnerFinalizationAuthority;
  selectedWinners: WinnerFinalizationSelection[];
}) {
  const summary = await buildWinnerFinalizationSummary(input);
  const draft = await getCreateChallengeDraftStrict(input.draftId);
  const scope = scopeFor({
    draftId: input.draftId,
    summary,
    fundingIntentId: draft.funding.fundingIntentId,
  });
  const attempt = await getWinnerFinalizationAttemptForScope(scope);
  if (!attempt) safeError("No winner payout attempt exists for this draft.", 404);
  const session = await createTrustedPayoutCircleSession();
  if (session.ccnAccountId !== scope.ccnAccountId) {
    safeError("Circle payout session is not bound to the configured payout account.", 409);
  }
  const status = await resolvePayoutTransaction({
    scope,
    userToken: session.userToken,
    circleChallengeId: attempt.circleChallengeId,
    circleTransactionId: attempt.circleTransactionId,
  });
  return {
    ...summary,
    draftId: input.draftId,
    lockId: attempt.lockId,
    state: attempt.state,
    circleChallengeId: attempt.circleChallengeId,
    circleTransactionId: status.circleTransactionId,
    circleTransactionState: status.circleTransactionState,
    transactionHash: status.transactionHash,
  };
}

export async function getWinnerPayoutStatusForFinalizedAttempt(input: {
  draftId: string;
  authority: WinnerFinalizationAuthority;
}) {
  const { attempt, scope, summary } = await resolveFinalizedWinnerOperation(input);
  if (attempt.state !== "PAYOUT_CONFIRMED" && (attempt.circleChallengeId || attempt.circleTransactionId)) {
    const session = await createTrustedPayoutCircleSession();
    if (session.ccnAccountId !== scope.ccnAccountId) {
      safeError("Circle payout session is not bound to the configured payout account.", 409);
    }
    const status = await resolvePayoutTransaction({
      scope,
      userToken: session.userToken,
      circleChallengeId: attempt.circleChallengeId,
      circleTransactionId: attempt.circleTransactionId,
    });
    if (status.transactionHash) {
      return reconcileFinalizedWinnerPayout({
        draftId: input.draftId,
        authority: input.authority,
        transactionHash: status.transactionHash,
      });
    }
    const refreshed = await getWinnerFinalizationAttemptForScope(scope);
    return {
      ...summary,
      draftId: input.draftId,
      lockId: refreshed?.lockId ?? attempt.lockId,
      state: refreshed?.state ?? attempt.state,
      circleChallengeId: refreshed?.circleChallengeId ?? attempt.circleChallengeId,
      circleTransactionId: refreshed?.circleTransactionId ?? status.circleTransactionId,
      circleTransactionState: refreshed?.circleStatus ?? status.circleTransactionState,
      transactionHash: refreshed?.transactionHash,
      blockNumber: refreshed?.blockNumber,
      receiptStatus: refreshed?.receiptStatus,
      payoutConfirmedAt: refreshed?.payoutConfirmedAt,
      reconciliationSource: refreshed?.reconciliationSource,
      finalContractStatus: refreshed?.finalContractStatus,
      reconciliation: refreshed?.reconciliation,
      errorMessage: refreshed?.errorMessage,
    };
  }
  return {
    ...summary,
    draftId: input.draftId,
    lockId: attempt.lockId,
    state: attempt.state,
    circleChallengeId: attempt.circleChallengeId,
    circleTransactionId: attempt.circleTransactionId ?? null,
    circleTransactionState: attempt.circleStatus,
    transactionHash: attempt.transactionHash,
    blockNumber: attempt.blockNumber,
    receiptStatus: attempt.receiptStatus,
    payoutConfirmedAt: attempt.payoutConfirmedAt,
    reconciliationSource: attempt.reconciliationSource,
    finalContractStatus: attempt.finalContractStatus,
    reconciliation: attempt.reconciliation,
    errorMessage: attempt.errorMessage,
  };
}

export async function reconcileWinnerPayout(input: {
  draftId: string;
  authority: WinnerFinalizationAuthority;
  selectedWinners: WinnerFinalizationSelection[];
}) {
  const summary = await buildWinnerFinalizationSummary(input);
  const draft = await getCreateChallengeDraftStrict(input.draftId);
  const scope = scopeFor({
    draftId: input.draftId,
    summary,
    fundingIntentId: draft.funding.fundingIntentId,
  });
  const attempt = await getWinnerFinalizationAttemptForScope(scope);
  if (!attempt) safeError("No winner payout attempt exists for this draft.", 404);
  const session = await createTrustedPayoutCircleSession();
  if (session.ccnAccountId !== scope.ccnAccountId) {
    safeError("Circle payout session is not bound to the configured payout account.", 409);
  }
  const status = await resolvePayoutTransaction({
    scope,
    userToken: session.userToken,
    circleChallengeId: attempt.circleChallengeId,
    circleTransactionId: attempt.circleTransactionId,
  });

  if (!status.transactionHash) {
    if (isTerminalNegativeCircleState(status.circleTransactionState)) {
      return {
        ...summary,
        draftId: input.draftId,
        lockId: attempt.lockId,
        state: "FINALIZATION_FAILED" as WinnerFinalizationState,
        circleTransactionId: status.circleTransactionId,
        circleTransactionState: status.circleTransactionState,
        transactionHash: null,
        errorMessage: "Circle PAYOUT transaction failed before on-chain confirmation.",
      };
    }
    return {
      ...summary,
      draftId: input.draftId,
      lockId: attempt.lockId,
      state: "ACTION_REQUIRED" as WinnerFinalizationState,
      circleTransactionId: status.circleTransactionId,
      circleTransactionState: status.circleTransactionState,
      transactionHash: null,
    };
  }

  const receipt = await getArcReceipt(status.transactionHash);
  const verification = verifyWinnersPaidReceipt({
    receipt,
    escrowContractAddress: CREATE_CHALLENGE_ESCROW_CONTRACT,
    challengeId: summary.challengeId,
    winners: summary.winnerWalletAddresses,
    amounts: summary.payoutAmounts,
    platformFee: summary.platformFee,
    treasury: summary.treasuryRecipient,
  });
  const contractStatus = await readEscrowChallengeStatus({
    escrowContractAddress: CREATE_CHALLENGE_ESCROW_CONTRACT,
    challengeId: summary.challengeId,
  });
  const verified = Object.values(verification).every(Boolean) && contractStatus === "PAID";
  const blockNumber = receipt?.blockNumber ? Number(BigInt(receipt.blockNumber)) : undefined;
  await patchWinnerFinalizationAttempt({
    scope,
    patch: {
      state: verified ? "PAYOUT_CONFIRMED" : "RECONCILIATION_REQUIRED",
      circleStatus: status.circleTransactionState,
      circleTransactionId: status.circleTransactionId ?? undefined,
      transactionHash: status.transactionHash,
      blockNumber,
      receiptStatus: verification.receiptVerified ? "success" : undefined,
      payoutConfirmedAt: verified ? new Date().toISOString() : undefined,
      reconciliationSource: "blockchain-first",
      finalContractStatus: contractStatus,
      lastCheckedAt: new Date().toISOString(),
      reconciliation: verification,
      errorMessage: verified ? undefined : "WinnersPaid reconciliation is incomplete.",
    },
  });
  const persisted = await getWinnerFinalizationAttemptForScope(scope);
  if (verified) {
    await persistVerifiedPayoutEvidence({
      scope,
      attempt: persisted ?? attempt,
      summary,
      transactionHash: status.transactionHash,
      blockNumber,
      verification,
      contractStatus,
    });
  }

  return {
    ...summary,
    draftId: input.draftId,
    lockId: attempt.lockId,
    state: verified ? "PAYOUT_CONFIRMED" : "RECONCILIATION_REQUIRED",
    circleTransactionId: status.circleTransactionId,
    circleTransactionState: status.circleTransactionState,
    transactionHash: status.transactionHash,
    blockNumber,
    receiptStatus: verification.receiptVerified ? "success" as const : undefined,
    payoutConfirmedAt: verified ? new Date().toISOString() : undefined,
    reconciliationSource: "blockchain-first" as const,
    finalContractStatus: contractStatus,
    reconciliation: verification,
    errorMessage: verified ? undefined : "WinnersPaid reconciliation is incomplete.",
  };
}

export async function reconcileFinalizedWinnerPayout(input: {
  draftId: string;
  authority: WinnerFinalizationAuthority;
  transactionHash?: string;
}) {
  const { attempt, scope, summary } = await resolveFinalizedWinnerOperation(input);
  if (attempt.state === "PAYOUT_CONFIRMED" && attempt.transactionHash) {
    return {
      ...summary,
      draftId: input.draftId,
      lockId: attempt.lockId,
      state: "PAYOUT_CONFIRMED" as WinnerFinalizationState,
      circleChallengeId: attempt.circleChallengeId,
      circleTransactionId: attempt.circleTransactionId ?? null,
      circleTransactionState: attempt.circleStatus,
      transactionHash: attempt.transactionHash as `0x${string}`,
      blockNumber: attempt.blockNumber,
      receiptStatus: attempt.receiptStatus,
      payoutConfirmedAt: attempt.payoutConfirmedAt,
      reconciliationSource: attempt.reconciliationSource,
      finalContractStatus: attempt.finalContractStatus,
      reconciliation: attempt.reconciliation,
    };
  }

  const transactionHash = parsePayoutTransactionHash(input.transactionHash ?? attempt.transactionHash);
  if (!transactionHash) {
    safeError("Payout transaction hash is required for blockchain-first reconciliation.", 409);
  }

  const receipt = await getArcReceipt(transactionHash);
  const verification = verifyWinnersPaidReceipt({
    receipt,
    escrowContractAddress: CREATE_CHALLENGE_ESCROW_CONTRACT,
    challengeId: summary.challengeId,
    winners: summary.winnerWalletAddresses,
    amounts: summary.payoutAmounts,
    platformFee: summary.platformFee,
    treasury: summary.treasuryRecipient,
  });
  const contractStatus = await readEscrowChallengeStatus({
    escrowContractAddress: CREATE_CHALLENGE_ESCROW_CONTRACT,
    challengeId: summary.challengeId,
  });
  if (contractStatus === "CANCELLED" || contractStatus === "REFUNDED") {
    safeError("Payout reconciliation rejected because the challenge is not paid.", 409);
  }
  const verified = Object.values(verification).every(Boolean) && contractStatus === "PAID";
  const now = new Date().toISOString();
  const blockNumber = blockNumberFromReceipt(receipt);
  await patchWinnerFinalizationAttempt({
    scope,
    patch: {
      state: verified ? "PAYOUT_CONFIRMED" : "RECONCILIATION_REQUIRED",
      circleStatus: attempt.circleStatus,
      circleChallengeId: attempt.circleChallengeId,
      circleTransactionId: attempt.circleTransactionId,
      transactionHash,
      blockNumber,
      receiptStatus: verification.receiptVerified ? "success" : undefined,
      payoutConfirmedAt: verified ? attempt.payoutConfirmedAt ?? now : undefined,
      reconciliationSource: "blockchain-first",
      finalContractStatus: contractStatus,
      lastCheckedAt: now,
      reconciliation: verification,
      errorMessage: verified ? undefined : "WinnersPaid reconciliation is incomplete.",
    },
  });
  const persisted = await getWinnerFinalizationAttemptForScope(scope);
  if (verified) {
    await persistVerifiedPayoutEvidence({
      scope,
      attempt: persisted ?? attempt,
      summary,
      transactionHash,
      blockNumber,
      verification,
      contractStatus,
    });
  }

  return {
    ...summary,
    draftId: input.draftId,
    lockId: attempt.lockId,
    state: verified ? "PAYOUT_CONFIRMED" as WinnerFinalizationState : "RECONCILIATION_REQUIRED" as WinnerFinalizationState,
    circleChallengeId: attempt.circleChallengeId,
    circleTransactionId: attempt.circleTransactionId ?? null,
    circleTransactionState: attempt.circleStatus,
    transactionHash,
    blockNumber,
    receiptStatus: verification.receiptVerified ? "success" as const : undefined,
    payoutConfirmedAt: verified ? attempt.payoutConfirmedAt ?? now : undefined,
    reconciliationSource: "blockchain-first" as const,
    finalContractStatus: contractStatus,
    reconciliation: verification,
    errorMessage: verified ? undefined : "WinnersPaid reconciliation is incomplete.",
  };
}

export async function requestWinnerFinalization(input: {
  draftId: string;
  authority: WinnerFinalizationAuthority;
  selectedWinners: WinnerFinalizationSelection[];
}): Promise<WinnerFinalizationRecord> {
  try {
    return await createWinnerPayoutApproval(input);
  } catch (error) {
    if (error instanceof WinnerOperationConflictError) throw error;
    const summary = await buildWinnerFinalizationSummary(input);
    const draft = await getCreateChallengeDraftStrict(input.draftId);
    const message = error instanceof Error ? error.message : "Winner finalization failed.";
    const scope = scopeFor({
      draftId: input.draftId,
      summary,
      fundingIntentId: draft.funding.fundingIntentId,
    });
    await patchWinnerFinalizationAttempt({
      scope,
      patch: {
        state: "FINALIZATION_FAILED",
        errorMessage: message,
      },
    });
    const attempt = await getWinnerFinalizationAttemptForScope(scope);
    return {
      ...summary,
      state: "FINALIZATION_FAILED",
      draftId: input.draftId,
      lockId: attempt?.lockId ?? "unavailable",
      errorMessage: message,
    };
  }
}
