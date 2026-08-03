import "server-only";

import { CREATE_CHALLENGE_ESCROW_CONTRACT } from "@/services/create-challenge/create-challenge-store.server";
import { getScopedStoredWallet } from "@/services/circle/wallet-spike-store.server";
import {
  CIRCLE_BASE_URL,
  CircleSpikeError,
  USER_WALLET_ACCOUNT_TYPE,
  USER_WALLET_BLOCKCHAIN,
  circleFetch,
} from "@/services/circle/user-controlled-wallets.server";

const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const ARC_CHAIN_ID = 5_042_002;
const ARC_EXPLORER_URL = "https://testnet.arcscan.app";
const RELEASE_PAYOUT_SIGNATURE = "releasePayout(bytes32,address[])";
const RELEASE_PAYOUT_SELECTOR = "0x92b2bccb";
const WINNERS_PAID_TOPIC =
  "0xffbc3b39ee493311a037f1057a395db2c239850d5c5e21888062165b8ace664a";
const SELECTORS = {
  resolverRole: "0x78fab260",
  hasRole: "0x91d14854",
  getChallenge: "0x458d2bf1",
  getPrizeDistribution: "0x5237a2a4",
  isFunded: "0x2b5fe3d9",
  treasury: "0x61d027b3",
} as const;
const MAX_RPC_ATTEMPTS = 4;
const RESOLVER_ROLE_CACHE_TTL_MS = 30_000;
const resolverRoleCache = new Map<string, { value: string; verifiedAt: number }>();

export const PAYOUT_EXECUTION_ENV_NAMES = [
  "CCN_PAYOUT_ACCOUNT_ID",
  "CCN_PAYOUT_WALLET_ID",
  "CCN_PAYOUT_WALLET_ADDRESS",
  "CCN_PAYOUT_TREASURY_ADDRESS",
  "CCN_ESCROW_CONTRACT_ADDRESS",
] as const;

type CircleContractExecutionResponse = {
  challengeId?: string;
};

type CircleTransactionResponse = {
  transaction?: {
    id?: string;
    state?: string;
    status?: string;
    txHash?: `0x${string}`;
    transactionHash?: `0x${string}`;
  };
};

type CircleChallengeResponse = {
  challenge?: {
    id?: string;
    status?: string;
    state?: string;
    correlationIds?: unknown;
    transactionId?: string;
    transactionIds?: unknown;
    transactions?: unknown;
  };
};

type RpcResponse<T> = {
  id?: number;
  result?: T;
  error?: { code: number; message: string };
};

type RpcCall = {
  method: string;
  params: unknown[];
};

type ReceiptLog = {
  address: string;
  topics: string[];
  data?: string;
  logIndex?: string;
  blockNumber?: string;
  transactionHash?: `0x${string}`;
};

type Receipt = {
  status?: string;
  to?: string;
  blockNumber?: string;
  transactionHash?: `0x${string}`;
  logs?: ReceiptLog[];
};

export type NormalizedCircleTransactionState =
  | "CREATED"
  | "ACTION_REQUIRED"
  | "PENDING"
  | "BROADCAST"
  | "CONFIRMED"
  | "FAILED"
  | "CANCELLED"
  | "UNKNOWN";

export type PayoutWalletAuthority = {
  ccnAccountId: string;
  walletId: string;
  walletAddress: `0x${string}`;
  blockchain: "ARC-TESTNET";
  accountType: "SCA";
  walletState: "LIVE";
  escrowContractAddress: `0x${string}`;
  treasuryAddress: `0x${string}`;
};

export type WinnersPaidVerification = {
  receiptVerified: boolean;
  eventVerified: boolean;
  challengeVerified: boolean;
  winnersVerified: boolean;
  amountsVerified: boolean;
  feeVerified: boolean;
  treasuryVerified: boolean;
};

export type EscrowChallengeStatus = "NONE" | "FUNDED" | "CANCELLED" | "PAID" | "REFUNDED" | "UNKNOWN";

export type EscrowChallengeSnapshot = {
  escrowContractAddress: `0x${string}`;
  challengeId: `0x${string}`;
  sponsor: `0x${string}`;
  prizePool: string;
  platformFee: string;
  submissionDeadline: number;
  reviewDeadline: number;
  winnerCount: number;
  status: EscrowChallengeStatus;
  isFunded: boolean;
  prizeDistribution: string[];
  treasury: `0x${string}`;
};

function env(name: typeof PAYOUT_EXECUTION_ENV_NAMES[number]) {
  return process.env[name];
}

function assertAddress(value: string | undefined, label: string): asserts value is `0x${string}` {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new CircleSpikeError({ message: `${label} is not configured.`, status: 501 });
  }
}

function assertBytes32(value: string): asserts value is `0x${string}` {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new CircleSpikeError({ message: "Payout challenge ID must be bytes32.", status: 422 });
  }
}

function assertToken(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length < 10) {
    throw new CircleSpikeError({
      message: "User-Controlled payout execution requires a fresh Circle userToken and hosted approval flow.",
      status: 501,
    });
  }
}

function strip0x(value: string) {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function word(value: string | bigint | number) {
  const hex = typeof value === "string" ? strip0x(value) : BigInt(value).toString(16);
  return hex.padStart(64, "0");
}

function addressWord(address: string) {
  assertAddress(address, "Address");
  return word(address.toLowerCase());
}

function boolFromWord(value: string) {
  return BigInt(value) === BigInt(1);
}

function addressFromWord(value: string | undefined) {
  return `0x${(value ?? "").padStart(64, "0").slice(24)}`.toLowerCase() as `0x${string}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rpcDelay(attempt: number) {
  const jitter = Math.floor(Math.random() * 125);
  return delay(250 * 2 ** attempt + jitter);
}

function isRetryableRpcError(error: unknown) {
  if (error instanceof CircleSpikeError) {
    return error.safe.status === 429 ||
      error.safe.status === 503 ||
      error.safe.code === -32011 ||
      /timeout|temporar|rate|limit|request limit/i.test(error.safe.message);
  }
  if (error instanceof Error) {
    return /timeout|temporar|rate|limit|request limit|fetch failed|network/i.test(error.message);
  }
  return false;
}

function rpcError(input: {
  message: string;
  method: string;
  status?: number;
  code?: number;
}) {
  return new CircleSpikeError({
    message: input.message,
    status: input.status ?? 503,
    code: input.code,
    endpoint: `${ARC_RPC_URL}:${input.method}`,
  });
}

function words(data: string) {
  return strip0x(data).match(/.{1,64}/g) ?? [];
}

function collectTransactionIdCandidates(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectTransactionIdCandidates(item));
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [
      ...collectTransactionIdCandidates(record.transactionId),
      ...collectTransactionIdCandidates(record.transactionIds),
      ...collectTransactionIdCandidates(record.id),
      ...collectTransactionIdCandidates(record.correlationIds),
      ...collectTransactionIdCandidates(record.transactions),
    ];
  }
  return [];
}

function isCircleUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function resolveChallengeTransactionId(input: {
  circleChallengeId: string;
  challenge: CircleChallengeResponse["challenge"] | null;
}) {
  const explicitCandidates = collectTransactionIdCandidates([
    input.challenge?.transactionId,
    input.challenge?.transactionIds,
    input.challenge?.transactions,
  ]).filter((candidate) => candidate !== input.circleChallengeId && isCircleUuid(candidate));
  if (explicitCandidates[0]) return explicitCandidates[0];

  const correlationCandidates = collectTransactionIdCandidates(input.challenge?.correlationIds)
    .filter((candidate) => candidate !== input.circleChallengeId && isCircleUuid(candidate));
  return correlationCandidates[0] ?? null;
}

async function postRpc<T>(call: RpcCall): Promise<RpcResponse<T>> {
  const response = await fetch(ARC_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: call.method, params: call.params }),
  });
  if (response.status === 429 || response.status === 503) {
    throw rpcError({
      message: "Unable to verify payout state on Arc Testnet. Please try again.",
      method: call.method,
      status: response.status,
    });
  }
  if (!response.ok) {
    throw rpcError({
      message: `Arc RPC request failed for ${call.method}.`,
      method: call.method,
      status: response.status,
    });
  }
  return (await response.json()) as RpcResponse<T>;
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const call = { method, params };
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RPC_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await rpcDelay(attempt);
    try {
      const payload = await postRpc<T>(call);
      if (payload.error || typeof payload.result === "undefined") {
        const error = rpcError({
          message: payload.error?.message ?? `Arc RPC request failed for ${method}.`,
          method,
          code: payload.error?.code,
          status: payload.error?.code === -32011 ? 503 : 400,
        });
        if (!isRetryableRpcError(error)) throw error;
        lastError = error;
        console.warn("[ccn-payout-rpc]", JSON.stringify({
          endpoint: ARC_RPC_URL,
          method,
          attempt: attempt + 1,
          code: payload.error?.code,
          retryable: true,
        }));
        continue;
      }
      return payload.result;
    } catch (error) {
      lastError = error;
      if (!isRetryableRpcError(error)) throw error;
      console.warn("[ccn-payout-rpc]", JSON.stringify({
        endpoint: ARC_RPC_URL,
        method,
        attempt: attempt + 1,
        retryable: true,
      }));
    }
  }

  if (lastError instanceof CircleSpikeError) {
    throw new CircleSpikeError({
      message: "Unable to verify payout state on Arc Testnet. Please try again.",
      status: 503,
      code: lastError.safe.code,
      endpoint: `${ARC_RPC_URL}:${method}`,
    });
  }
  throw rpcError({
    message: "Unable to verify payout state on Arc Testnet. Please try again.",
    method,
    status: 503,
  });
}

async function ethCall(to: string, data: string, from?: string) {
  return rpc<string>("eth_call", [{ to, data, ...(from ? { from } : {}) }, "latest"]);
}

function memoizedEthCall(memo: Map<string, Promise<string>>, to: string, data: string, from?: string) {
  const key = JSON.stringify({
    to: to.toLowerCase(),
    data: data.toLowerCase(),
    from: from?.toLowerCase(),
  });
  const existing = memo.get(key);
  if (existing) return existing;
  const next = ethCall(to, data, from);
  memo.set(key, next);
  return next;
}

async function readResolverRole(escrowContractAddress: `0x${string}`, memo: Map<string, Promise<string>>) {
  const cacheKey = escrowContractAddress.toLowerCase();
  const cached = resolverRoleCache.get(cacheKey);
  if (cached && Date.now() - cached.verifiedAt < RESOLVER_ROLE_CACHE_TTL_MS) return cached.value;
  const role = await memoizedEthCall(memo, escrowContractAddress, SELECTORS.resolverRole);
  resolverRoleCache.set(cacheKey, { value: role, verifiedAt: Date.now() });
  return role;
}

function encodeAddressArray(values: `0x${string}`[]) {
  return `${word(values.length)}${values.map(addressWord).join("")}`;
}

function releasePayoutCalldata(challengeId: `0x${string}`, winners: `0x${string}`[]) {
  assertBytes32(challengeId);
  winners.forEach((winner) => assertAddress(winner, "Winner wallet address"));
  return `${RELEASE_PAYOUT_SELECTOR}${word(challengeId)}${word(64)}${encodeAddressArray(winners)}`;
}

export async function simulateReleasePayout(input: {
  escrowContractAddress: `0x${string}`;
  from: `0x${string}`;
  challengeId: `0x${string}`;
  winners: `0x${string}`[];
}) {
  const result = await ethCall(
    input.escrowContractAddress,
    releasePayoutCalldata(input.challengeId, input.winners),
    input.from,
  );
  return {
    success: result === "0x" || /^0x0*$/.test(result),
    result,
  };
}

export function normalizeCircleTransactionState(input: unknown): NormalizedCircleTransactionState {
  const value = typeof input === "string" ? input.toUpperCase() : "";
  if (["CREATED", "QUEUED"].includes(value)) return "CREATED";
  if (["ACTION_REQUIRED", "PENDING_RISK_SCREENING", "NEEDS_ATTENTION"].includes(value)) return "ACTION_REQUIRED";
  if (["PENDING", "IN_PROGRESS", "INITIATED"].includes(value)) return "PENDING";
  if (["BROADCAST", "SENT"].includes(value)) return "BROADCAST";
  if (["CONFIRMED", "COMPLETE", "COMPLETED", "SUCCESS"].includes(value)) return "CONFIRMED";
  if (["FAILED", "DENIED", "REJECTED", "DECLINED"].includes(value)) return "FAILED";
  if (["CANCELLED", "CANCELED", "EXPIRED", "TIMED_OUT"].includes(value)) return "CANCELLED";
  return "UNKNOWN";
}

export async function resolveAuthorizedPayoutWallet(): Promise<PayoutWalletAuthority> {
  const ccnAccountId = env("CCN_PAYOUT_ACCOUNT_ID");
  const walletId = env("CCN_PAYOUT_WALLET_ID");
  const walletAddress = env("CCN_PAYOUT_WALLET_ADDRESS");
  const treasuryAddress = env("CCN_PAYOUT_TREASURY_ADDRESS");
  const configuredEscrow = env("CCN_ESCROW_CONTRACT_ADDRESS") ?? CREATE_CHALLENGE_ESCROW_CONTRACT;

  if (!ccnAccountId || !/^[A-Za-z0-9._:-]{5,50}$/.test(ccnAccountId)) {
    throw new CircleSpikeError({ message: "CCN payout account is not configured.", status: 501 });
  }
  if (!walletId) {
    throw new CircleSpikeError({ message: "CCN payout wallet ID is not configured.", status: 501 });
  }
  assertAddress(walletAddress, "CCN payout wallet address");
  assertAddress(treasuryAddress, "CCN payout treasury address");
  assertAddress(configuredEscrow, "CCN escrow contract address");

  if (configuredEscrow.toLowerCase() !== CREATE_CHALLENGE_ESCROW_CONTRACT.toLowerCase()) {
    throw new CircleSpikeError({ message: "Configured escrow contract does not match the audited deployment.", status: 422 });
  }

  const scoped = await getScopedStoredWallet({
    ccnAccountId,
    role: "BRAND",
    purpose: "PAYOUT",
  });
  if (scoped) {
    if (scoped.walletId !== walletId || scoped.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new CircleSpikeError({ message: "Scoped payout wallet mapping does not match server configuration.", status: 409 });
    }
    if (scoped.blockchain !== USER_WALLET_BLOCKCHAIN || scoped.accountType !== USER_WALLET_ACCOUNT_TYPE) {
      throw new CircleSpikeError({ message: "Payout wallet must be an ARC-TESTNET SCA wallet.", status: 422 });
    }
    if (scoped.walletState !== "live") {
      throw new CircleSpikeError({ message: "Payout wallet must be LIVE before payout execution.", status: 422 });
    }
  }

  return {
    ccnAccountId,
    walletId,
    walletAddress,
    blockchain: USER_WALLET_BLOCKCHAIN,
    accountType: USER_WALLET_ACCOUNT_TYPE,
    walletState: "LIVE",
    escrowContractAddress: configuredEscrow,
    treasuryAddress,
  };
}

export async function verifyPayoutWalletResolverRole(walletAddress: `0x${string}`, escrowContractAddress: `0x${string}`) {
  const memo = new Map<string, Promise<string>>();
  const role = await readResolverRole(escrowContractAddress, memo);
  const allowed = await memoizedEthCall(
    memo,
    escrowContractAddress,
    `${SELECTORS.hasRole}${word(role)}${addressWord(walletAddress)}`,
  );
  return boolFromWord(allowed);
}

export async function readEscrowChallengeStatus(input: {
  escrowContractAddress: `0x${string}`;
  challengeId: `0x${string}`;
}): Promise<EscrowChallengeStatus> {
  const result = await ethCall(
    input.escrowContractAddress,
    `${SELECTORS.getChallenge}${word(input.challengeId)}`,
  );
  const dataWords = words(result);
  const rawStatus = Number(BigInt(`0x${dataWords[6] ?? "0"}`));
  if (rawStatus === 0) return "NONE";
  if (rawStatus === 1) return "FUNDED";
  if (rawStatus === 2) return "CANCELLED";
  if (rawStatus === 3) return "PAID";
  if (rawStatus === 4) return "REFUNDED";
  return "UNKNOWN";
}

function escrowStatusFromWord(value: string | undefined): EscrowChallengeStatus {
  const rawStatus = Number(BigInt(`0x${value ?? "0"}`));
  if (rawStatus === 0) return "NONE";
  if (rawStatus === 1) return "FUNDED";
  if (rawStatus === 2) return "CANCELLED";
  if (rawStatus === 3) return "PAID";
  if (rawStatus === 4) return "REFUNDED";
  return "UNKNOWN";
}

export async function readEscrowChallengeSnapshot(input: {
  escrowContractAddress: `0x${string}`;
  challengeId: `0x${string}`;
}): Promise<EscrowChallengeSnapshot> {
  const [challengeResult, distributionResult, fundedResult, treasuryResult] = await Promise.all([
    ethCall(input.escrowContractAddress, `${SELECTORS.getChallenge}${word(input.challengeId)}`),
    ethCall(input.escrowContractAddress, `${SELECTORS.getPrizeDistribution}${word(input.challengeId)}`),
    ethCall(input.escrowContractAddress, `${SELECTORS.isFunded}${word(input.challengeId)}`),
    ethCall(input.escrowContractAddress, SELECTORS.treasury),
  ]);
  const challengeWords = words(challengeResult);
  const distributionWords = words(distributionResult);
  return {
    escrowContractAddress: input.escrowContractAddress,
    challengeId: input.challengeId,
    sponsor: addressFromWord(challengeWords[0]),
    prizePool: BigInt(`0x${challengeWords[1] ?? "0"}`).toString(),
    platformFee: BigInt(`0x${challengeWords[2] ?? "0"}`).toString(),
    submissionDeadline: Number(BigInt(`0x${challengeWords[3] ?? "0"}`)),
    reviewDeadline: Number(BigInt(`0x${challengeWords[4] ?? "0"}`)),
    winnerCount: Number(BigInt(`0x${challengeWords[5] ?? "0"}`)),
    status: escrowStatusFromWord(challengeWords[6]),
    isFunded: boolFromWord(fundedResult),
    prizeDistribution: decodeUintArray(distributionWords, distributionWords[0] ?? "0"),
    treasury: addressFromWord(words(treasuryResult)[0]),
  };
}

export function buildReleasePayoutExecutionBody(input: {
  walletId: string;
  idempotencyKey: string;
  escrowContractAddress: `0x${string}`;
  challengeId: `0x${string}`;
  winners: `0x${string}`[];
}) {
  assertBytes32(input.challengeId);
  input.winners.forEach((winner) => assertAddress(winner, "Winner wallet address"));
  return {
    walletId: input.walletId,
    contractAddress: input.escrowContractAddress,
    idempotencyKey: input.idempotencyKey,
    abiFunctionSignature: RELEASE_PAYOUT_SIGNATURE,
    abiParameters: [input.challengeId, input.winners],
    feeLevel: "MEDIUM",
    refId: `ccn-payout-${input.challengeId.slice(2, 14)}`,
  };
}

export async function createPayoutContractExecutionChallenge(input: {
  userToken: unknown;
  idempotencyKey: string;
  challengeId: `0x${string}`;
  winners: `0x${string}`[];
}) {
  assertToken(input.userToken);
  const authority = await resolveAuthorizedPayoutWallet();
  const hasResolverRole = await verifyPayoutWalletResolverRole(authority.walletAddress, authority.escrowContractAddress);
  if (!hasResolverRole) {
    throw new CircleSpikeError({ message: "Configured payout wallet is not authorized with RESOLVER_ROLE.", status: 422 });
  }

  const body = buildReleasePayoutExecutionBody({
    walletId: authority.walletId,
    idempotencyKey: input.idempotencyKey,
    escrowContractAddress: authority.escrowContractAddress,
    challengeId: input.challengeId,
    winners: input.winners,
  });

  const data = await circleFetch<CircleContractExecutionResponse>({
    endpoint: "/v1/w3s/user/transactions/contractExecution",
    method: "POST",
    userToken: input.userToken,
    body,
  });

  if (!data.challengeId) {
    throw new CircleSpikeError({ message: "Circle payout execution challenge was not returned.", status: 502 });
  }
  return {
    circleChallengeId: data.challengeId,
    state: "ACTION_REQUIRED" as const,
  };
}

export async function getPayoutTransactionStatus(input: {
  userToken: unknown;
  transactionId: string;
}) {
  assertToken(input.userToken);
  const data = await circleFetch<CircleTransactionResponse>({
    endpoint: `/v1/w3s/transactions/${input.transactionId}`,
    method: "GET",
    userToken: input.userToken,
  });
  const transaction = data.transaction ?? null;
  const rawState = transaction?.state ?? transaction?.status;
  return {
    transactionId: transaction?.id ?? input.transactionId,
    state: normalizeCircleTransactionState(rawState),
    transactionHash: transaction?.txHash ?? transaction?.transactionHash,
  };
}

export async function getPayoutChallengeTransaction(input: {
  userToken: unknown;
  circleChallengeId: string;
}) {
  assertToken(input.userToken);
  const data = await circleFetch<CircleChallengeResponse>({
    endpoint: `/v1/w3s/user/challenges/${input.circleChallengeId}`,
    method: "GET",
    userToken: input.userToken,
  });
  const challenge = data.challenge ?? null;
  return {
    circleChallengeId: input.circleChallengeId,
    circleStatus: challenge?.status ?? challenge?.state ?? "UNKNOWN",
    circleTransactionId: resolveChallengeTransactionId({
      circleChallengeId: input.circleChallengeId,
      challenge,
    }),
  };
}

function decodeAddressArray(dataWords: string[], offsetWord: string) {
  const offset = Number(BigInt(`0x${offsetWord}`) / BigInt(32));
  const length = Number(BigInt(`0x${dataWords[offset] ?? "0"}`));
  return dataWords.slice(offset + 1, offset + 1 + length).map((item) => `0x${item.slice(24)}`.toLowerCase() as `0x${string}`);
}

function decodeUintArray(dataWords: string[], offsetWord: string) {
  const offset = Number(BigInt(`0x${offsetWord}`) / BigInt(32));
  const length = Number(BigInt(`0x${dataWords[offset] ?? "0"}`));
  return dataWords.slice(offset + 1, offset + 1 + length).map((item) => BigInt(`0x${item}`).toString());
}

export function verifyWinnersPaidReceipt(input: {
  receipt: Receipt | null;
  escrowContractAddress: `0x${string}`;
  challengeId: `0x${string}`;
  winners: `0x${string}`[];
  amounts: string[];
  platformFee: string;
  treasury: `0x${string}`;
}): WinnersPaidVerification {
  const log = input.receipt?.logs?.find((item) =>
    item.address.toLowerCase() === input.escrowContractAddress.toLowerCase() &&
    item.topics[0]?.toLowerCase() === WINNERS_PAID_TOPIC &&
    item.topics[1]?.toLowerCase() === input.challengeId.toLowerCase() &&
    item.topics[2]?.toLowerCase() === `0x${addressWord(input.treasury)}`.toLowerCase()
  );
  const receiptVerified = input.receipt?.status === "0x1" && Boolean(log);
  if (!receiptVerified || !log?.data) {
    return {
      receiptVerified,
      eventVerified: false,
      challengeVerified: false,
      winnersVerified: false,
      amountsVerified: false,
      feeVerified: false,
      treasuryVerified: false,
    };
  }

  const dataWords = words(log.data);
  const winners = decodeAddressArray(dataWords, dataWords[0] ?? "0");
  const amounts = decodeUintArray(dataWords, dataWords[1] ?? "0");
  const platformFee = BigInt(`0x${dataWords[2] ?? "0"}`).toString();
  const expectedWinners = input.winners.map((winner) => winner.toLowerCase());

  return {
    receiptVerified,
    eventVerified: true,
    challengeVerified: true,
    winnersVerified: winners.join(":") === expectedWinners.join(":"),
    amountsVerified: amounts.join(":") === input.amounts.join(":"),
    feeVerified: platformFee === input.platformFee,
    treasuryVerified: log.topics[2]?.toLowerCase() === `0x${addressWord(input.treasury)}`.toLowerCase(),
  };
}

export async function getArcReceipt(hash: `0x${string}`) {
  return rpc<Receipt | null>("eth_getTransactionReceipt", [hash]);
}

export function payoutExecutionFacts() {
  return {
    circleBaseUrl: CIRCLE_BASE_URL,
    endpoint: "/v1/w3s/user/transactions/contractExecution",
    walletModel: "User-Controlled",
    blockchain: USER_WALLET_BLOCKCHAIN,
    accountType: USER_WALLET_ACCOUNT_TYPE,
    chainId: ARC_CHAIN_ID,
    explorerBaseUrl: ARC_EXPLORER_URL,
    releasePayoutSignature: RELEASE_PAYOUT_SIGNATURE,
    winnersPaidTopic: WINNERS_PAID_TOPIC,
    environmentVariableNames: [...PAYOUT_EXECUTION_ENV_NAMES],
  };
}
