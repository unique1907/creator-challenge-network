import "server-only";

import {
  ARC_TESTNET_USDC_CONTRACT,
  CircleSpikeError,
  USER_WALLET_ACCOUNT_TYPE,
  USER_WALLET_BLOCKCHAIN,
  createOrFetchCircleUser,
  getScopedWallet,
} from "@/services/circle/user-controlled-wallets.server";
import { CREATE_CHALLENGE_BALANCE_TTL_MS } from "@/config/create-challenge-payment";
import { createChallengeTraceId, logCreateChallengeTrace, type CreateChallengeTraceSource } from "@/utils/create-challenge-payment-trace";
import type { CreateChallengeDraftState, CreateChallengePaymentProgressItem, CreateChallengePaymentState } from "@/types/create-challenge";
import { formatUsdcUnits } from "@/utils/create-challenge-finance";
import {
  CREATE_CHALLENGE_BRAND_ACCOUNT_ID,
  findOnChainVerificationForDraft,
  getCreateChallengeDraft,
  getFundingIntentFromDraft,
  listApprovalAttemptsForScope,
  listFundingAttemptsForScope,
  patchCreateChallengeDraft,
  upsertOnChainVerification,
} from "./create-challenge-store.server";
import type { FundingAttemptRecord, FundingIntentSnapshot } from "./create-challenge-store.server";

const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const ARC_CHAIN_ID = 5_042_002;
const ARC_EXPLORER_URL = "https://testnet.arcscan.app";

const BALANCE_OF_SELECTOR = "0x70a08231";
const ALLOWANCE_SELECTOR = "0xdd62ed3e";
const PAUSED_SELECTOR = "0x5c975abb";
const IS_FUNDED_SELECTOR = "0x2b5fe3d9";
const CHALLENGE_FUNDED_TOPIC =
  "0xa23f31b7501da448a32cfd845dabd7febd27b63e242c5364c7b8c4bac456432c";
const RPC_TIMEOUT_MS = 10_000;
const BRAND_ROLE = "BRAND";
const CANONICAL_BRAND_WALLET =
  "0xB1E2700290381396BC2A85bb6C286EaD5e80A5dd";

type RpcResponse<T> = {
  result?: T;
  error?: { code: number; message: string };
};

type BalanceResult = {
  units: string;
  display: string;
  readAt: string;
  status: "ready";
};

export type BrandPaymentAccount = {
  ccnAccountId: string;
  role: typeof BRAND_ROLE;
  circleUserId: string;
  walletId: string;
  walletAddress: `0x${string}`;
  walletAddressMasked: string;
  blockchain: "ARC-TESTNET";
  accountType: "SCA";
  walletState: string;
  usdcBalanceUnits: string;
  usdcBalanceDisplay: string;
  balanceReadAt: string;
  balanceStatus: "ready" | "unavailable";
  explorerUrl: string;
  safeMessage?: string;
};

export type BrandPaymentAccountSnapshot = {
  accountStatus: "READY" | "BALANCE_UNAVAILABLE" | "ERROR";
  walletId: string;
  circleUserId: string;
  walletAddressMasked: string;
  walletAddress: `0x${string}`;
  walletState: string;
  network: "ARC-TESTNET";
  chainId: number;
  balanceUnits: string;
  balanceDisplay: string;
  balanceReadAt: string;
  canAfford: boolean | null;
  totalRequiredUnits: string;
  totalRequiredDisplay: string;
  remainingAfterFundingUnits: string;
  remainingAfterFundingDisplay: string;
  nextState:
    | "ACCOUNT_READY"
    | "BALANCE_READY"
    | "INSUFFICIENT_BALANCE"
    | "ERROR";
  safeMessage: string;
  explorerUrl: string;
};

const balanceCache = new Map<string, { expiresAt: number; value: BalanceResult }>();
const inFlightBalances = new Map<string, Promise<BalanceResult>>();

function mask(value: string) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";
}

function strip0x(value: string) {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function addressWord(address: string) {
  return strip0x(address).toLowerCase().padStart(64, "0");
}

function balanceCacheKey(walletAddress: string) {
  return [
    ARC_CHAIN_ID,
    ARC_TESTNET_USDC_CONTRACT.toLowerCase(),
    walletAddress.toLowerCase(),
  ].join(":");
}

function isTransientRpcError(error?: RpcResponse<unknown>["error"]) {
  return Boolean(error && (error.code === -32011 || /limit|rate/i.test(error.message)));
}

async function rpc<T>(method: string, params: unknown[], trace?: { requestId: string; triggerSource: CreateChallengeTraceSource; functionName: string; draftId?: string }): Promise<T> {
  const requestId = trace?.requestId ?? createChallengeTraceId("rpc");
  const traceSource = trace?.triggerSource ?? "rpc";
  const functionName = trace?.functionName ?? method;
  let lastError: RpcResponse<T>["error"];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 600 * 2 ** attempt));
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
    let payload: RpcResponse<T>;
    logCreateChallengeTrace({ requestId, route: ARC_RPC_URL, functionName, draftId: trace?.draftId, triggerSource: traceSource, startedAt: new Date().toISOString(), attemptedErrorUpdate: false });
    try {
      const response = await fetch(ARC_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
        signal: controller.signal,
      });
      payload = (await response.json()) as RpcResponse<T>;
    } catch (error) {
      lastError = { code: 503, message: error instanceof Error ? error.message : "RPC request failed." };
      if (!isTransientRpcError(lastError)) break;
      continue;
    } finally {
      clearTimeout(timeout);
    }
    if (!payload.error && typeof payload.result !== "undefined") {
      logCreateChallengeTrace({ requestId, route: ARC_RPC_URL, functionName, draftId: trace?.draftId, triggerSource: traceSource, completedAt: new Date().toISOString(), success: true, status: "rpc-ok", attemptedErrorUpdate: false });
      return payload.result;
    }
    lastError = payload.error;
    if (!isTransientRpcError(lastError)) break;
  }
  throw new CircleSpikeError({
    message: "We couldn't refresh your balance. Please try again.",
    status: 503,
    endpoint: `${ARC_RPC_URL}:${method}`,
    code: lastError?.code,
  });
}

export async function readBrandUsdcBalance(walletAddress = CANONICAL_BRAND_WALLET, trace?: { requestId: string; triggerSource: CreateChallengeTraceSource; draftId?: string }) {
  logCreateChallengeTrace({ requestId: trace?.requestId ?? createChallengeTraceId("balance"), route: "readBrandUsdcBalance", functionName: "readBrandUsdcBalance", draftId: trace?.draftId, triggerSource: trace?.triggerSource ?? "server", startedAt: new Date().toISOString(), attemptedErrorUpdate: false });
  const key = balanceCacheKey(walletAddress);
  const cached = balanceCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const existing = inFlightBalances.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const data = `${BALANCE_OF_SELECTOR}${addressWord(walletAddress)}`;
    const result = await rpc<string>("eth_call", [
      { to: ARC_TESTNET_USDC_CONTRACT, data },
      "latest",
    ], trace ? { ...trace, functionName: "readBrandUsdcBalance" } : undefined);
    const value = {
      units: BigInt(result).toString(),
      display: `${formatUsdcUnits(BigInt(result))} test USDC`,
      readAt: new Date().toISOString(),
      status: "ready" as const,
    };
    balanceCache.set(key, {
      expiresAt: Date.now() + CREATE_CHALLENGE_BALANCE_TTL_MS,
      value,
    });
    return value;
  })().finally(() => {
    inFlightBalances.delete(key);
  });

  inFlightBalances.set(key, promise);
  return promise;
}

export async function getBrandPaymentAccount(
  ccnAccountId = CREATE_CHALLENGE_BRAND_ACCOUNT_ID,
  trace?: { requestId: string; triggerSource: CreateChallengeTraceSource; draftId?: string },
): Promise<BrandPaymentAccount> {
  const session = await createOrFetchCircleUser({
    ccnAccountId,
    authProvider: "email",
  });
  const wallet = await getScopedWallet({
    ccnAccountId,
    authProvider: "email",
    userToken: session.userToken,
    role: "BRAND",
    purpose: "PAYMENT",
    expectedWalletAddress: CANONICAL_BRAND_WALLET,
  });

  if (!wallet?.walletId) {
    throw new CircleSpikeError({ message: "Brand payment account was not found." });
  }
  if (wallet.walletAddress.toLowerCase() !== CANONICAL_BRAND_WALLET.toLowerCase()) {
    throw new CircleSpikeError({ message: "Brand payment account mapping is not canonical." });
  }

  try {
    const balance = await readBrandUsdcBalance(wallet.walletAddress, trace);
    return {
      ccnAccountId,
      role: BRAND_ROLE,
      circleUserId: session.circleUserId,
      walletId: wallet.walletId,
      walletAddress: wallet.walletAddress as `0x${string}`,
      walletAddressMasked: mask(wallet.walletAddress),
      blockchain: USER_WALLET_BLOCKCHAIN,
      accountType: USER_WALLET_ACCOUNT_TYPE,
      walletState: wallet.walletState === "live" ? "Ready" : wallet.walletState,
      usdcBalanceUnits: balance.units,
      usdcBalanceDisplay: balance.display,
      balanceReadAt: balance.readAt,
      balanceStatus: "ready",
      explorerUrl: `${ARC_EXPLORER_URL}/address/${wallet.walletAddress}`,
    };
  } catch (error) {
    if (error instanceof CircleSpikeError) {
      return {
        ccnAccountId,
        role: BRAND_ROLE,
        circleUserId: session.circleUserId,
        walletId: wallet.walletId,
        walletAddress: wallet.walletAddress as `0x${string}`,
        walletAddressMasked: mask(wallet.walletAddress),
        blockchain: USER_WALLET_BLOCKCHAIN,
        accountType: USER_WALLET_ACCOUNT_TYPE,
        walletState: wallet.walletState === "live" ? "Ready" : wallet.walletState,
        usdcBalanceUnits: "0",
        usdcBalanceDisplay: "Balance unavailable",
        balanceReadAt: "",
        balanceStatus: "unavailable",
        explorerUrl: `${ARC_EXPLORER_URL}/address/${wallet.walletAddress}`,
        safeMessage: "We couldn't refresh your balance. Please try again.",
      };
    }
    throw error;
  }
}

export function toPaymentAccountSnapshot(input: {
  account: BrandPaymentAccount;
  totalRequiredUnits: string;
}): BrandPaymentAccountSnapshot {
  const available = BigInt(input.account.usdcBalanceUnits || "0");
  const required = BigInt(input.totalRequiredUnits || "0");
  const remaining = available > required ? available - required : BigInt(0);
  const balanceReady = input.account.balanceStatus === "ready";
  const canAfford = balanceReady ? available >= required : null;

  return {
    accountStatus: balanceReady ? "READY" : "BALANCE_UNAVAILABLE",
    walletId: input.account.walletId,
    circleUserId: input.account.circleUserId,
    walletAddressMasked: input.account.walletAddressMasked,
    walletAddress: input.account.walletAddress,
    walletState: input.account.walletState,
    network: input.account.blockchain,
    chainId: ARC_CHAIN_ID,
    balanceUnits: input.account.usdcBalanceUnits,
    balanceDisplay: input.account.usdcBalanceDisplay,
    balanceReadAt: input.account.balanceReadAt,
    canAfford,
    totalRequiredUnits: input.totalRequiredUnits,
    totalRequiredDisplay: `${formatUsdcUnits(input.totalRequiredUnits)} test USDC`,
    remainingAfterFundingUnits: remaining.toString(),
    remainingAfterFundingDisplay: `${formatUsdcUnits(remaining)} test USDC`,
  nextState: !balanceReady
      ? "ACCOUNT_READY"
      : canAfford
        ? "BALANCE_READY"
        : "INSUFFICIENT_BALANCE",
    safeMessage: input.account.safeMessage ?? "",
    explorerUrl: input.account.explorerUrl,
  };
}

export type CreateChallengePaymentOverview = {
  draftScope: {
    ccnAccountId: string;
    draftId: string;
    challengeId: string;
    fundingIntentId: string;
  };
  paymentAccount: BrandPaymentAccountSnapshot;
  balance: {
    units: string;
    display: string;
    readAt: string;
    source: "official-usdc-balance" | "unavailable";
  };
  amounts: {
    prizeAmountUnits: string;
    platformFeeUnits: string;
    totalRequiredUnits: string;
    totalRequiredDisplay: string;
    remainingAfterFundingUnits: string;
    remainingAfterFundingDisplay: string;
  };
  allowance: string;
  requiredAllowance: string;
  approvalRequired: boolean;
  paymentState: CreateChallengePaymentState;
  progress: CreateChallengePaymentProgressItem[];
  availableActions: Array<"CHECK_PAYMENT_ACCOUNT" | "RETRY_BALANCE" | "APPROVE" | "FUND" | "VERIFY" | "CONTINUE_TO_PUBLISH" | "PUBLISH">;
  safeMessage: string;
  diagnostics: {
    network: "ARC-TESTNET";
    chainId: number;
    escrowPaused: boolean | null;
  };
};

function progressForPaymentState(state: CreateChallengePaymentState): CreateChallengePaymentProgressItem[] {
  const labels = [
    "Payment account ready",
    state === "BALANCE_LOADING" ? "Checking balance" : "Balance verified",
    "Approval required",
    "Approval confirmed",
    "Securing prize pool",
    "Funding confirmed",
    "Ready to publish",
  ];
  const doneByState: Record<CreateChallengePaymentState, number> = {
    NOT_STARTED: 0,
    ACCOUNT_LOADING: 0,
    BALANCE_LOADING: 1,
    BALANCE_READY: 2,
    INSUFFICIENT_BALANCE: 2,
    READY_FOR_APPROVAL: 2,
    APPROVAL_PENDING: 2,
    APPROVED: 4,
    FUNDING_PENDING: 4,
    RECONCILING: 5,
    FUNDED_VERIFIED: 7,
    PUBLISHED: 7,
    RECOVERABLE_ERROR: 1,
    FATAL_ERROR: 0,
  };
  const activeByState: Partial<Record<CreateChallengePaymentState, number>> = {
    NOT_STARTED: 0,
    ACCOUNT_LOADING: 0,
    BALANCE_LOADING: 1,
    BALANCE_READY: 2,
    INSUFFICIENT_BALANCE: 2,
    READY_FOR_APPROVAL: 2,
    APPROVAL_PENDING: 2,
    APPROVED: 4,
    FUNDING_PENDING: 4,
    RECONCILING: 5,
    RECOVERABLE_ERROR: 1,
    FATAL_ERROR: 0,
  };
  const doneCount = doneByState[state];
  const activeIndex = activeByState[state];
  return labels.map((label, index) => {
    if (state === "INSUFFICIENT_BALANCE" && index === 2) return { label: "Insufficient balance", status: "warning" };
    if (state === "RECOVERABLE_ERROR" && index === 1) return { label: "Balance unavailable", status: "warning" };
    if (index < doneCount) return { label, status: "done" };
    if (index === activeIndex) return { label, status: "active" };
    return { label, status: "pending" };
  });
}

function actionsForPaymentState(state: CreateChallengePaymentState): CreateChallengePaymentOverview["availableActions"] {
  switch (state) {
    case "NOT_STARTED":
    case "ACCOUNT_LOADING":
      return ["CHECK_PAYMENT_ACCOUNT"];
    case "RECOVERABLE_ERROR":
      return ["RETRY_BALANCE"];
    case "READY_FOR_APPROVAL":
      return ["APPROVE"];
    case "APPROVED":
      return ["FUND"];
    case "RECONCILING":
      return ["VERIFY"];
    case "FUNDED_VERIFIED":
      return ["CONTINUE_TO_PUBLISH"];
    case "PUBLISHED":
      return [];
    default:
      return [];
  }
}

function attemptIsActive(status: string) {
  return ["PENDING", "IN_PROGRESS", "COMPLETE", "COMPLETED", "APPROVED"].includes(status);
}

function stateFromDraftAndAccount(input: {
  draft: Awaited<ReturnType<typeof getCreateChallengeDraft>>;
  account: BrandPaymentAccount;
  totalRequiredUnits: string;
  allowance: string;
  escrowPaused: boolean | null;
  hasVerifiedFundingEvidence: boolean;
  hasActiveFundingAttempt: boolean;
  hasActiveApprovalAttempt: boolean;
}): CreateChallengePaymentState {
  const {
    draft,
    account,
    totalRequiredUnits,
    allowance,
    escrowPaused,
    hasVerifiedFundingEvidence,
    hasActiveFundingAttempt,
    hasActiveApprovalAttempt,
  } = input;
  if (draft.deployment.publicationStatus === "live") return "PUBLISHED";
  if (hasVerifiedFundingEvidence) return "FUNDED_VERIFIED";
  if (hasActiveFundingAttempt) return "FUNDING_PENDING";
  if (escrowPaused) return "FATAL_ERROR";
  if (account.balanceStatus !== "ready") return "RECOVERABLE_ERROR";
  if (BigInt(account.usdcBalanceUnits) < BigInt(totalRequiredUnits)) return "INSUFFICIENT_BALANCE";
  if (BigInt(allowance) >= BigInt(totalRequiredUnits)) return "APPROVED";
  if (hasActiveApprovalAttempt) return "APPROVAL_PENDING";
  return "READY_FOR_APPROVAL";
}

async function readApprovalAllowance(owner: string, spender: string, trace?: { requestId: string; triggerSource: CreateChallengeTraceSource; draftId?: string }) {
  const data = `${ALLOWANCE_SELECTOR}${addressWord(owner)}${addressWord(spender)}`;
  const raw = await rpc<string>("eth_call", [{ to: ARC_TESTNET_USDC_CONTRACT, data }, "latest"], trace ? { ...trace, functionName: "readApprovalAllowance" } : undefined);
  return BigInt(raw).toString();
}

async function readEscrowPaused(escrowAddress: string, trace?: { requestId: string; triggerSource: CreateChallengeTraceSource; draftId?: string }) {
  try {
    const raw = await rpc<string>("eth_call", [{ to: escrowAddress, data: PAUSED_SELECTOR }, "latest"], trace ? { ...trace, functionName: "readEscrowPaused" } : undefined);
    return BigInt(raw) === BigInt(1);
  } catch {
    return null;
  }
}

type ReceiptLog = {
  address: string;
  topics: string[];
  data: string;
  blockNumber?: string;
  logIndex?: string;
  transactionHash?: string;
};

type TransactionReceipt = {
  status?: string;
  blockNumber?: string;
  transactionHash?: string;
  logs?: ReceiptLog[];
};

function topicAddress(topic: string) {
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function dataWord(data: string, index: number) {
  const stripped = strip0x(data);
  return `0x${stripped.slice(index * 64, index * 64 + 64)}`;
}

function isCompleteFundingAttempt(attempt: FundingAttemptRecord) {
  return ["COMPLETE", "COMPLETED", "APPROVED"].includes(attempt.circleStatus) && Boolean(attempt.transactionHash);
}

async function readIsFunded(escrowAddress: string, challengeId: string, trace?: { requestId: string; triggerSource: CreateChallengeTraceSource; draftId?: string }) {
  const raw = await rpc<string>(
    "eth_call",
    [{ to: escrowAddress, data: `${IS_FUNDED_SELECTOR}${strip0x(challengeId)}` }, "latest"],
    trace ? { ...trace, functionName: "readIsFunded" } : undefined,
  );
  return BigInt(raw) === BigInt(1);
}

async function verifyAndPromoteCompleteFundingAttempt(input: {
  draft: CreateChallengeDraftState;
  intent: FundingIntentSnapshot;
  account: BrandPaymentAccount;
  attempts: FundingAttemptRecord[];
  trace?: { requestId: string; triggerSource: CreateChallengeTraceSource; draftId?: string };
}) {
  const attempt = input.attempts.find(isCompleteFundingAttempt);
  const txHash = attempt?.transactionHash;
  if (!attempt || !txHash) return "none" as const;

  const receipt = await rpc<TransactionReceipt>("eth_getTransactionReceipt", [txHash], input.trace ? { ...input.trace, functionName: "promoteFundingReceipt" } : undefined);
  if (!receipt) return "pending" as const;
  if (receipt.status && receipt.status !== "0x1") return "failed" as const;

  const event = (receipt.logs ?? []).find((log) => {
    const topics = log.topics ?? [];
    return (
      log.address.toLowerCase() === input.intent.escrowContractAddress.toLowerCase() &&
      topics[0]?.toLowerCase() === CHALLENGE_FUNDED_TOPIC.toLowerCase() &&
      topics[1]?.toLowerCase() === input.intent.challengeId.toLowerCase() &&
      topicAddress(topics[2] ?? "") === input.account.walletAddress.toLowerCase()
    );
  });
  if (!event) return "unverified" as const;

  const prizeAmount = BigInt(dataWord(event.data, 0)).toString();
  const platformFee = BigInt(dataWord(event.data, 1)).toString();
  const eventTotal = (BigInt(prizeAmount) + BigInt(platformFee)).toString();
  const expectedTotal = (BigInt(input.intent.prizeAmount) + BigInt(input.intent.platformFee)).toString();
  if (
    prizeAmount !== input.intent.prizeAmount ||
    platformFee !== input.intent.platformFee ||
    eventTotal !== expectedTotal ||
    expectedTotal !== input.intent.totalRequired
  ) {
    return "unverified" as const;
  }

  const isFunded = await readIsFunded(input.intent.escrowContractAddress, input.intent.challengeId, input.trace);
  if (!isFunded) return "unverified" as const;

  await patchCreateChallengeDraft({
    funding: {
      walletId: input.account.walletId,
      walletAddress: input.account.walletAddress,
      fundingStatus: "funded",
      escrowStatus: "verified",
      transactionId: attempt.circleTransactionId ?? "",
      transactionHash: txHash,
      fundingBlockNumber: event.blockNumber ?? receipt.blockNumber,
      fundingLogIndex: event.logIndex,
      eventVerified: true,
      availableBalance: Number(formatUsdcUnits(input.account.usdcBalanceUnits)),
      lastBalanceRefreshAt: input.account.balanceReadAt,
    } as never,
    deployment: { status: "ready", publicationStatus: "ready-to-publish" } as never,
  }, input.draft.challenge.id);

  await upsertOnChainVerification({
    txHash,
    circleTransactionId: attempt.circleTransactionId ?? "",
    circleChallengeId: attempt.circleChallengeId,
    draftId: input.draft.challenge.id ?? "",
    challengeId: input.intent.challengeId,
    fundingIntentId: input.intent.fundingIntentId,
    walletId: input.account.walletId,
    ccnAccountId: input.intent.ccnAccountId,
    eventType: "ChallengeFunded",
    blockNumber: event.blockNumber ? Number(BigInt(event.blockNumber)) : null,
    receiptStatus: "success",
    receiptVerified: true,
    eventVerified: true,
    challengeVerified: true,
    sponsorVerified: true,
    amountVerified: true,
    verifiedAt: new Date().toISOString(),
  });
  return "verified" as const;
}

export async function getCreateChallengePaymentOverview(draftId?: string, trace?: { requestId: string; triggerSource: CreateChallengeTraceSource }): Promise<CreateChallengePaymentOverview> {
  let draft = await getCreateChallengeDraft(draftId);
  const intent = getFundingIntentFromDraft(draft);
  const traceContext = trace ? { ...trace, draftId: draft.challenge.id ?? draftId } : undefined;
  const account = await getBrandPaymentAccount(intent.ccnAccountId, traceContext);
  const escrowPaused = await readEscrowPaused(intent.escrowContractAddress, traceContext);
  const allowance = await readApprovalAllowance(account.walletAddress, intent.escrowContractAddress, traceContext);
  const scope = {
    ccnAccountId: intent.ccnAccountId,
    walletId: account.walletId,
    draftId: draft.challenge.id ?? "",
    challengeId: intent.challengeId,
    fundingIntentId: intent.fundingIntentId,
  };
  const [approvalAttempts, fundingAttempts, initialVerifiedFundingRecord] = await Promise.all([
    listApprovalAttemptsForScope(scope),
    listFundingAttemptsForScope(scope),
    findOnChainVerificationForDraft(scope),
  ]);
  let verifiedFundingRecord = initialVerifiedFundingRecord;
  let fundingAttemptPromotion = "none" as Awaited<ReturnType<typeof verifyAndPromoteCompleteFundingAttempt>>;
  if (!verifiedFundingRecord && !draft.funding.eventVerified) {
    fundingAttemptPromotion = await verifyAndPromoteCompleteFundingAttempt({
      draft,
      intent,
      account,
      attempts: fundingAttempts,
      trace: traceContext,
    });
    if (fundingAttemptPromotion === "verified") {
      draft = await getCreateChallengeDraft(draft.challenge.id);
      verifiedFundingRecord = await findOnChainVerificationForDraft(scope);
    }
  }
  if (fundingAttemptPromotion === "failed") {
    throw new CircleSpikeError({ message: "Funding transaction failed on Arc Testnet.", status: 400 });
  }
  const hasVerifiedFundingEvidence = Boolean(verifiedFundingRecord) || Boolean(draft.funding.eventVerified && draft.funding.transactionHash);
  const snapshot = toPaymentAccountSnapshot({
    account,
    totalRequiredUnits: intent.totalRequired,
  });
  const paymentState = stateFromDraftAndAccount({
    draft,
    account,
    totalRequiredUnits: intent.totalRequired,
    allowance,
    escrowPaused,
    hasVerifiedFundingEvidence,
    hasActiveFundingAttempt: !hasVerifiedFundingEvidence && fundingAttempts.some((attempt) => attemptIsActive(attempt.circleStatus)),
    hasActiveApprovalAttempt: approvalAttempts.some((attempt) => attemptIsActive(attempt.circleStatus)),
  });

  if (paymentState === "APPROVED" && draft.funding.fundingStatus !== "approved") {
    await patchCreateChallengeDraft({
      funding: {
        walletId: account.walletId,
        walletAddress: account.walletAddress,
        fundingStatus: "approved",
        availableBalance: Number(formatUsdcUnits(account.usdcBalanceUnits)),
        lastBalanceRefreshAt: account.balanceReadAt,
      } as never,
    }, draft.challenge.id);
  }

  return {
    draftScope: {
      ccnAccountId: intent.ccnAccountId,
      draftId: draft.challenge.id ?? "",
      challengeId: intent.challengeId,
      fundingIntentId: intent.fundingIntentId,
    },
    paymentAccount: snapshot,
    balance: {
      units: account.usdcBalanceUnits,
      display: account.usdcBalanceDisplay,
      readAt: account.balanceReadAt,
      source: account.balanceStatus === "ready" ? "official-usdc-balance" : "unavailable",
    },
    amounts: {
      prizeAmountUnits: intent.prizeAmount,
      platformFeeUnits: intent.platformFee,
      totalRequiredUnits: intent.totalRequired,
      totalRequiredDisplay: snapshot.totalRequiredDisplay,
      remainingAfterFundingUnits: snapshot.remainingAfterFundingUnits,
      remainingAfterFundingDisplay: snapshot.remainingAfterFundingDisplay,
    },
    allowance,
    requiredAllowance: intent.totalRequired,
    approvalRequired: BigInt(allowance) < BigInt(intent.totalRequired),
    paymentState,
    progress: progressForPaymentState(paymentState),
    availableActions: actionsForPaymentState(paymentState),
    safeMessage: account.safeMessage ?? (escrowPaused ? "Escrow is paused." : ""),
    diagnostics: {
      network: "ARC-TESTNET",
      chainId: ARC_CHAIN_ID,
      escrowPaused,
    },
  };
}
