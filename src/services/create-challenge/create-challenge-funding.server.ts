import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  EscrowFundingVerification,
  EscrowPreflightSnapshot,
  EscrowTransactionSnapshot,
  EscrowTransactionStage,
} from "@/types/escrow-funding-spike";
import {
  ARC_TESTNET_USDC_CONTRACT,
  CircleSpikeError,
  USER_WALLET_ACCOUNT_TYPE,
  USER_WALLET_BLOCKCHAIN,
  circleFetch,
} from "@/services/circle/user-controlled-wallets.server";
import {
  formatTestUsdc,
  ensureCreateChallengeDraftPublicSlugReservation,
  findOnChainVerificationForDraft,
  getCreateChallengeDraft,
  getFundingIntentFromDraft,
  listApprovalAttemptsForScope,
  listFundingAttemptsForScope,
  listCreateChallengeDrafts,
  patchCreateChallengeDraft,
  stableUuid,
  upsertApprovalAttemptForScope,
  upsertOnChainVerification,
  upsertFundingAttemptForScope,
} from "./create-challenge-store.server";
import type { ApprovalAttemptRecord, ApprovalAttemptStatus, OnChainVerificationRecord } from "./create-challenge-store.server";
import { getBrandPaymentAccount, getCreateChallengePaymentOverview } from "./brand-payment-account.server";
import {
  ARC_TESTNET_CHAIN_ID,
  getCreateChallengeDeadlinePolicy,
  logCreateChallengeDeadlinePolicy,
} from "@/config/create-challenge-deadline-policy";
import { validateCreateChallengeLaunchReadiness } from "@/utils/create-challenge-launch-readiness";

const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const ARC_CHAIN_ID = 5_042_002;
const ARC_EXPLORER_URL = "https://testnet.arcscan.app";
const CHALLENGE_FUNDED_TOPIC =
  "0xa23f31b7501da448a32cfd845dabd7febd27b63e242c5364c7b8c4bac456432c";
const APPROVAL_TOPIC =
  "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
const CCN_ESCROW_DEPLOYMENT_TX =
  "0xfd01e623896253221bc4724b42fb26d6d041dac41f25b47520d53bbd5c02b4a7";
const LOG_BLOCK_CHUNK_SIZE = BigInt(500);
const LOG_CHUNK_RETRY_ATTEMPTS = 2;
const VERIFICATION_CACHE_TTL_MS = 12_000;

const verificationCache = new Map<string, { expiresAt: number; value: CanonicalFundingVerification }>();

function deadlinePolicyForDraft(draft: Awaited<ReturnType<typeof getCreateChallengeDraft>>) {
  const policy = getCreateChallengeDeadlinePolicy({
    runtimeBlockchain: "ARC-TESTNET",
    chainId: ARC_TESTNET_CHAIN_ID,
    isSmokeTestChallenge: draft.challenge.isSmokeTest === true,
  });
  return policy;
}
const verificationInFlight = new Map<string, Promise<CanonicalFundingVerification>>();

const SELECTORS = {
  allowance: "0xdd62ed3e",
  balanceOf: "0x70a08231",
  getChallenge: "0x458d2bf1",
  getPrizeDistribution: "0x5237a2a4",
  getTotalLockedLiabilities: "0x7eb53c97",
  isFunded: "0x2b5fe3d9",
  paused: "0x5c975abb",
  totalLockedPlatformFees: "0x70bb942b",
  totalLockedPrizePools: "0xc457a016",
  treasury: "0x61d027b3",
  usdc: "0x3e413bee",
} as const;

type CircleContractExecutionResponse = {
  challengeId?: string;
};

type CircleChallengeResponse = {
  challenge?: Record<string, unknown>;
};

type CircleChallengeListResponse = {
  challenges?: Array<Record<string, unknown>>;
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

type ApprovalRecoveryResult = {
  attempts: ApprovalAttemptRecord[];
  allowance: string;
  requiredAllowance: string;
  canonicalAttempt: ApprovalAttemptRecord | null;
  restoredState: "APPROVAL_PENDING" | "APPROVED" | "READY_FOR_APPROVAL" | "START_AGAIN";
};

type RpcResponse<T> = {
  id?: number;
  result?: T;
  error?: { code: number; message: string };
};

type CompiledAbiEntry = {
  type: string;
  name?: string;
  inputs?: Array<{ name?: string; type: string; indexed?: boolean }>;
  outputs?: Array<{ name?: string; type: string }>;
};

type ApprovalLog = {
  transactionHash: `0x${string}`;
  blockNumber: string;
  logIndex: string;
  amount: string;
};

type ChallengeFundedLog = {
  transactionHash: `0x${string}`;
  blockNumber: string;
  logIndex: string;
  prizePool: string;
  platformFee: string;
  winnerCount: number;
  submissionDeadline: number;
  reviewDeadline: number;
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
  from?: string;
  blockNumber?: string;
  transactionHash?: `0x${string}`;
  logs?: ReceiptLog[];
};

type Transaction = {
  hash?: `0x${string}`;
  from?: string;
  to?: string;
  blockNumber?: string;
};

export type CanonicalFundingVerification = {
  draft: Awaited<ReturnType<typeof getCreateChallengeDraft>>;
  intent: ReturnType<typeof getFundingIntentFromDraft>;
  wallet: { walletId: string; walletAddress: string; blockchain: string; accountType: string; creationStatus: string };
  walletAddress: `0x${string}`;
  chainId: number;
  bytecodeExists: boolean;
  escrow: {
    chainId: number;
    bytecodeExists: boolean;
    usdc: `0x${string}`;
    treasury: `0x${string}`;
    paused: boolean;
    isFunded: boolean;
    totalLockedPrizePools: string;
    totalLockedPlatformFees: string;
    totalLockedLiabilities: string;
  };
  challenge: {
    sponsor: `0x${string}`;
    prizePool: string;
    platformFee: string;
    submissionDeadline: number;
    reviewDeadline: number;
    winnerCount: number;
    status: number;
  };
  distribution: string[];
  walletBalance: string;
  escrowBalance: string;
  allowance: string;
  approvalTx: `0x${string}` | null;
  fundingTx: `0x${string}` | null;
  receipt: Receipt | null;
  transaction: Transaction | null;
  challengeFundedEvent: ChallengeFundedLog | null;
  blockNumber: string | null;
  eventVerified: boolean;
  challengeVerified: boolean;
  txDestinationMatches: boolean;
  eventMatchesIntent: boolean;
  challengeMatchesIntent: boolean;
  approvalLogCount: number;
  fundingLogCount: number;
  balanceTimestamp: string;
};

function loadEscrowAbi() {
  const artifactPath = join(process.cwd(), "contracts", "out", "CCNEscrow.sol", "CCNEscrow.json");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { abi?: CompiledAbiEntry[] };
  const abi = artifact.abi ?? [];
  const challengeFunded = abi.find((entry) => entry.type === "event" && entry.name === "ChallengeFunded");
  const getChallenge = abi.find((entry) => entry.type === "function" && entry.name === "getChallenge");
  const getPrizeDistribution = abi.find((entry) => entry.type === "function" && entry.name === "getPrizeDistribution");
  if (!challengeFunded || !getChallenge || !getPrizeDistribution) {
    throw new CircleSpikeError({ message: "Compiled CCNEscrow ABI is missing required verification entries." });
  }
  return { challengeFunded, getChallenge, getPrizeDistribution };
}

function assertCompiledEscrowAbi() {
  const { challengeFunded, getChallenge, getPrizeDistribution } = loadEscrowAbi();
  const eventInputs = (challengeFunded.inputs ?? []).map((input) => `${input.indexed ? "indexed " : ""}${input.type} ${input.name ?? ""}`);
  const challengeOutputs = (getChallenge.outputs ?? []).map((output) => output.type);
  const distributionOutputs = (getPrizeDistribution.outputs ?? []).map((output) => output.type);
  const expectedEvent = [
    "indexed bytes32 challengeId",
    "indexed address sponsor",
    "uint256 prizePool",
    "uint256 platformFee",
    "uint8 winnerCount",
    "uint64 submissionDeadline",
    "uint64 reviewDeadline",
  ];
  const expectedChallenge = ["address", "uint256", "uint256", "uint64", "uint64", "uint8", "uint8"];
  if (eventInputs.join("|") !== expectedEvent.join("|") || challengeOutputs.join("|") !== expectedChallenge.join("|") || distributionOutputs.join("|") !== "uint256[]") {
    throw new CircleSpikeError({ message: "Compiled CCNEscrow ABI shape does not match the verifier." });
  }
}

function assertToken(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length < 10) {
    throw new CircleSpikeError({ message: "A fresh userToken is required." });
  }
}

function strip0x(value: string) {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function word(value: string | bigint | number) {
  const hex =
    typeof value === "string" ? strip0x(value) : BigInt(value).toString(16);
  return hex.padStart(64, "0");
}

function addressWord(address: string) {
  return word(address.toLowerCase());
}

function asHexAddress(address: string): `0x${string}` {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new CircleSpikeError({ message: "Invalid Arc wallet address." });
  }
  return address as `0x${string}`;
}

function assertDraftScope(draftId: string | undefined): asserts draftId is string {
  if (!draftId) {
    throw new CircleSpikeError({
      message: "A selected draft is required before checking payment status.",
    });
  }
}

function splitWords(data: string) {
  return strip0x(data).match(/.{1,64}/g) ?? [];
}

function addressFromWord(value: string): `0x${string}` {
  return `0x${value.slice(24)}`;
}

function boolFromWord(value: string) {
  return BigInt(`0x${value}`) === BigInt(1);
}

function isRpcLimitError(error?: RpcResponse<unknown>["error"]) {
  return Boolean(error && (error.code === -32011 || /limit|rate/i.test(error.message)));
}

function isRecoverableLogRpcError(error: unknown): error is CircleSpikeError {
  return error instanceof CircleSpikeError && error.safe.code === -32603;
}

function rpcDelay(attempt: number) {
  const jitter = Math.floor(Math.random() * 125);
  return new Promise((resolve) => setTimeout(resolve, 350 * 2 ** attempt + jitter));
}

function safeRpcRefreshError(method: string, attempts: number, code?: number) {
  console.warn("[ccn-funding-rpc]", JSON.stringify({
    endpoint: ARC_RPC_URL,
    method,
    attempts,
    code,
    message: "Unable to verify funding state on Arc Testnet.",
  }));
  return new CircleSpikeError({
    message: "Unable to verify funding state on Arc Testnet. Please try again.",
    status: 503,
    endpoint: `${ARC_RPC_URL}:${method}`,
    code,
  });
}

function logRangeVerificationError(from: bigint, to: bigint, code?: string | number) {
  console.warn("[ccn-funding-rpc]", JSON.stringify({
    endpoint: ARC_RPC_URL,
    method: "eth_getLogs",
    fromBlock: `0x${from.toString(16)}`,
    toBlock: `0x${to.toString(16)}`,
    code,
    message: "Arc event verification is temporarily unavailable.",
  }));
  return new CircleSpikeError({
    message: `Arc event verification is temporarily unavailable for blocks ${from.toString()}-${to.toString()}. No funding transaction was submitted. Retry verification before funding.`,
    status: 503,
    endpoint: `${ARC_RPC_URL}:eth_getLogs`,
    code,
  });
}

function logScanDelay(attempt: number) {
  return new Promise((resolve) => setTimeout(resolve, 250 * attempt));
}

type RpcCall = { method: string; params: unknown[] };

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const [result] = await rpcBatch<T>([{ method, params }]);
  return result;
}

async function postRpc<T>(body: unknown): Promise<RpcResponse<T> | Array<RpcResponse<T>>> {
  const response = await fetch(ARC_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as RpcResponse<T> | Array<RpcResponse<T>>;
}

function rpcBody(calls: RpcCall[]) {
  const body = calls.map((call, index) => ({
    id: index + 1,
    jsonrpc: "2.0",
    method: call.method,
    params: call.params,
  }));
  return body.length === 1 ? body[0] : body;
}

function rpcPayloads<T>(payload: RpcResponse<T> | Array<RpcResponse<T>>) {
  return Array.isArray(payload) ? payload : [payload];
}

async function rpcSingleWithRetry<T>(call: RpcCall): Promise<T> {
  let lastError: RpcResponse<T>["error"];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await rpcDelay(attempt);
    const payloads = rpcPayloads(await postRpc<T>(rpcBody([call])));
    const first = payloads[0];
    if (!first?.error && typeof first?.result !== "undefined") {
      return first.result as T;
    }
    lastError = first?.error;
    console.warn("[ccn-funding-rpc]", JSON.stringify({ endpoint: ARC_RPC_URL, method: call.method, attempt: attempt + 1, code: lastError?.code }));
    if (!isRpcLimitError(lastError)) break;
  }
  if (isRpcLimitError(lastError)) throw safeRpcRefreshError(call.method, 3, lastError?.code);
  throw new CircleSpikeError({
    message: lastError?.message ?? "Unable to verify funding state on Arc Testnet. Please try again.",
    endpoint: `${ARC_RPC_URL}:${call.method}`,
    code: lastError?.code,
  });
}

async function rpcBatch<T>(calls: RpcCall[]): Promise<T[]> {
  let lastError: RpcResponse<T>["error"];
  let failingMethod = calls[0]?.method ?? "rpcBatch";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await rpcDelay(attempt);
    const payloads = rpcPayloads(await postRpc<T>(rpcBody(calls)));
    const firstErrorPayload = payloads.find((item) => item.error);
    if (!firstErrorPayload && payloads.every((item) => typeof item.result !== "undefined")) {
      return payloads.map((item) => item.result as T);
    }
    lastError = firstErrorPayload?.error;
    const errorIndex = Math.max(0, Number(firstErrorPayload?.id ?? 1) - 1);
    failingMethod = calls[errorIndex]?.method ?? failingMethod;
    console.warn("[ccn-funding-rpc]", JSON.stringify({ endpoint: ARC_RPC_URL, method: failingMethod, attempt: attempt + 1, batchedCalls: calls.length, code: lastError?.code }));
    if (!isRpcLimitError(lastError)) break;
  }

  if (isRpcLimitError(lastError) && calls.length > 1) {
    const results: T[] = [];
    for (const call of calls) {
      results.push(await rpcSingleWithRetry<T>(call));
    }
    return results;
  }

  if (isRpcLimitError(lastError)) throw safeRpcRefreshError(failingMethod, 3, lastError?.code);
  throw new CircleSpikeError({
    message: lastError?.message ?? "Unable to verify funding state on Arc Testnet. Please try again.",
    endpoint: `${ARC_RPC_URL}:${failingMethod}`,
    code: lastError?.code,
  });
}
function decodeChallengeFundedLog(log: ReceiptLog): ChallengeFundedLog | null {
  if (log.topics[0]?.toLowerCase() !== CHALLENGE_FUNDED_TOPIC.toLowerCase()) return null;
  const words = splitWords(log.data ?? "0x");
  if (words.length < 5 || !log.transactionHash || !log.blockNumber || !log.logIndex) return null;
  return {
    transactionHash: log.transactionHash,
    blockNumber: log.blockNumber,
    logIndex: log.logIndex,
    prizePool: BigInt(`0x${words[0]}`).toString(),
    platformFee: BigInt(`0x${words[1]}`).toString(),
    winnerCount: Number(BigInt(`0x${words[2]}`)),
    submissionDeadline: Number(BigInt(`0x${words[3]}`)),
    reviewDeadline: Number(BigInt(`0x${words[4]}`)),
  };
}

function decodeApprovalLog(log: ReceiptLog): ApprovalLog | null {
  if (log.topics[0]?.toLowerCase() !== APPROVAL_TOPIC.toLowerCase()) return null;
  const words = splitWords(log.data ?? "0x");
  if (words.length < 1 || !log.transactionHash || !log.blockNumber || !log.logIndex) return null;
  return {
    transactionHash: log.transactionHash,
    blockNumber: log.blockNumber,
    logIndex: log.logIndex,
    amount: BigInt(`0x${words[0]}`).toString(),
  };
}
async function getDeploymentBlockNumber() {
  const receipt = await getReceipt(CCN_ESCROW_DEPLOYMENT_TX);
  return receipt?.blockNumber ? BigInt(receipt.blockNumber) : BigInt(0);
}

async function getLogsForRange(input: {
  address: string;
  topics: string[];
  fromBlock: bigint;
  toBlock: bigint;
}) {
  for (let attempt = 1; attempt <= LOG_CHUNK_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await rpc<ReceiptLog[]>("eth_getLogs", [
        {
          address: input.address,
          fromBlock: `0x${input.fromBlock.toString(16)}`,
          toBlock: `0x${input.toBlock.toString(16)}`,
          topics: input.topics,
        },
      ]);
    } catch (error) {
      if (!isRecoverableLogRpcError(error) || attempt === LOG_CHUNK_RETRY_ATTEMPTS) {
        if (isRecoverableLogRpcError(error)) {
          throw logRangeVerificationError(input.fromBlock, input.toBlock, error.safe.code);
        }
        throw error;
      }
      await logScanDelay(attempt);
    }
  }
  return [];
}

async function scanDecodedLogs<T>(input: {
  address: string;
  topics: string[];
  decode: (log: ReceiptLog) => T | null;
  direction?: "forward" | "backward";
  stopOnFirstMatch?: boolean;
  exactBlock?: string;
}) {
  if (input.exactBlock) {
    const block = BigInt(input.exactBlock);
    return (await getLogsForRange({
      address: input.address,
      topics: input.topics,
      fromBlock: block,
      toBlock: block,
    })).map(input.decode).filter((log): log is T => Boolean(log));
  }

  const latestHex = await rpc<string>("eth_blockNumber", []);
  const latest = BigInt(latestHex);
  const deploymentBlock = await getDeploymentBlockNumber();
  const logs: T[] = [];
  const chunkSpan = LOG_BLOCK_CHUNK_SIZE - BigInt(1);

  if (input.direction === "backward") {
    for (let to = latest; to >= deploymentBlock;) {
      const from = to - chunkSpan < deploymentBlock ? deploymentBlock : to - chunkSpan;
      const page = (await getLogsForRange({
        address: input.address,
        topics: input.topics,
        fromBlock: from,
        toBlock: to,
      })).map(input.decode).filter((log): log is T => Boolean(log));
      logs.push(...page);
      if (input.stopOnFirstMatch && page.length > 0) break;
      if (from === deploymentBlock) break;
      to = from - BigInt(1);
    }
    return logs;
  }

  for (let from = deploymentBlock; from <= latest;) {
    const to = from + chunkSpan > latest ? latest : from + chunkSpan;
    const page = (await getLogsForRange({
      address: input.address,
      topics: input.topics,
      fromBlock: from,
      toBlock: to,
    })).map(input.decode).filter((log): log is T => Boolean(log));
    logs.push(...page);
    if (input.stopOnFirstMatch && page.length > 0) break;
    from = to + BigInt(1);
  }
  return logs;
}

async function getChallengeFundedLogs(escrow: string, challengeId: string, sponsor: string, options: { exactBlock?: string } = {}) {
  const sponsorTopic = `0x${addressWord(sponsor)}`;
  return scanDecodedLogs({
    address: escrow,
    topics: [CHALLENGE_FUNDED_TOPIC, challengeId, sponsorTopic],
    decode: decodeChallengeFundedLog,
    stopOnFirstMatch: true,
    exactBlock: options.exactBlock,
  });
}
async function getApprovalLogs(owner: string, spender: string) {
  const ownerTopic = `0x${addressWord(owner)}`;
  const spenderTopic = `0x${addressWord(spender)}`;
  return scanDecodedLogs({
    address: ARC_TESTNET_USDC_CONTRACT,
    topics: [APPROVAL_TOPIC, ownerTopic, spenderTopic],
    decode: decodeApprovalLog,
    direction: "backward",
    stopOnFirstMatch: true,
  });
}
async function getTransactionByHash(hash: string) {
  return rpc<Transaction | null>("eth_getTransactionByHash", [hash]);
}

function getChallengeFundedEventFromReceipt(receipt: Receipt | null, intent: ReturnType<typeof getFundingIntentFromDraft>, sponsor: string) {
  const sponsorTopic = `0x${addressWord(sponsor)}`;
  const log = receipt?.logs?.find(
      (log) =>
        log.address.toLowerCase() === intent.escrowContractAddress.toLowerCase() &&
        log.topics[0]?.toLowerCase() === CHALLENGE_FUNDED_TOPIC.toLowerCase() &&
        log.topics[1]?.toLowerCase() === intent.challengeId.toLowerCase() &&
        log.topics[2]?.toLowerCase() === sponsorTopic.toLowerCase(),
  );
  return log ? decodeChallengeFundedLog(log) : null;
}

function receiptContainsChallengeFundedEvent(receipt: Receipt | null, intent: ReturnType<typeof getFundingIntentFromDraft>, sponsor: string) {
  return Boolean(getChallengeFundedEventFromReceipt(receipt, intent, sponsor));
}
type FundingAccountScope = { ccnAccountId?: string };

async function getBrandWallet(userToken: string, draftId?: string, input: FundingAccountScope = {}) {
  assertToken(userToken);
  assertDraftScope(draftId);
  const intent = getFundingIntentFromDraft(await getCreateChallengeDraft(draftId), input);
  const account = await getBrandPaymentAccount(intent.ccnAccountId);
  return {
    walletId: account.walletId,
    walletAddress: account.walletAddress,
    blockchain: account.blockchain,
    accountType: account.accountType,
    creationStatus: account.walletState === "Ready" ? "live" : account.walletState,
  };
}

function cacheKey(input: { draftId: string; walletAddress: string; challengeId: string; fundingIntentId: string }) {
  return [input.draftId, input.walletAddress.toLowerCase(), input.challengeId.toLowerCase(), input.fundingIntentId].join(":");
}

function escrowStatusFromDraftFunding(status: string): "READY_FOR_FUNDING" | "APPROVAL_PENDING" | "APPROVED" | "FUNDING_PENDING" | "FUNDED" | "LIVE" {
  switch (status) {
    case "approval-pending":
      return "APPROVAL_PENDING";
    case "approved":
      return "APPROVED";
    case "funding-pending":
      return "FUNDING_PENDING";
    case "funded":
      return "FUNDED";
    case "live":
      return "LIVE";
    default:
      return "READY_FOR_FUNDING";
  }
}

function latestApprovalTx(logs: ApprovalLog[], totalRequired: string) {
  return logs.filter((log) => BigInt(log.amount) >= BigInt(totalRequired)).at(-1)?.transactionHash ?? null;
}

export async function getCanonicalFundingVerification(
  userToken: unknown,
  draftId?: string,
  options: { useCache?: boolean; ccnAccountId?: string } = {},
): Promise<CanonicalFundingVerification> {
  assertToken(userToken);
  assertDraftScope(draftId);
  const draft = await getCreateChallengeDraft(draftId);
  const intent = getFundingIntentFromDraft(draft, options);
  const wallet = await getBrandWallet(userToken, draftId, options);
  const walletAddress = asHexAddress(wallet.walletAddress);
  const key = cacheKey({
    draftId: draft.challenge.id ?? draftId,
    walletAddress,
    challengeId: intent.challengeId,
    fundingIntentId: intent.fundingIntentId,
  });
  const cached = verificationCache.get(key);
  if (options.useCache && cached && cached.expiresAt > Date.now()) return cached.value;
  const existing = verificationInFlight.get(key);
  if (existing) return existing;
  const promise = buildCanonicalFundingVerification(userToken, draftId, options).finally(() => {
    verificationInFlight.delete(key);
  });
  verificationInFlight.set(key, promise);
  return promise;
}

async function buildCanonicalFundingVerification(
  userToken: unknown,
  draftId?: string,
  options: { useCache?: boolean; ccnAccountId?: string } = {},
): Promise<CanonicalFundingVerification> {
  assertToken(userToken);
  assertDraftScope(draftId);
  const draft = await getCreateChallengeDraft(draftId);
  const intent = getFundingIntentFromDraft(draft, options);
  const wallet = await getBrandWallet(userToken, draftId, options);
  const walletAddress = asHexAddress(wallet.walletAddress);
  const key = cacheKey({
    draftId: draft.challenge.id ?? draftId,
    walletAddress,
    challengeId: intent.challengeId,
    fundingIntentId: intent.fundingIntentId,
  });
  const cached = verificationCache.get(key);
  if (options.useCache && cached && cached.expiresAt > Date.now()) return cached.value;

  assertCompiledEscrowAbi();
  const callResults = await rpcBatch<string>([
    { method: "eth_chainId", params: [] },
    { method: "eth_getCode", params: [intent.escrowContractAddress, "latest"] },
    { method: "eth_call", params: [{ to: intent.escrowContractAddress, data: SELECTORS.usdc }, "latest"] },
    { method: "eth_call", params: [{ to: intent.escrowContractAddress, data: SELECTORS.treasury }, "latest"] },
    { method: "eth_call", params: [{ to: intent.escrowContractAddress, data: SELECTORS.paused }, "latest"] },
    { method: "eth_call", params: [{ to: intent.escrowContractAddress, data: `${SELECTORS.isFunded}${word(intent.challengeId)}` }, "latest"] },
    { method: "eth_call", params: [{ to: intent.escrowContractAddress, data: `${SELECTORS.getChallenge}${word(intent.challengeId)}` }, "latest"] },
    { method: "eth_call", params: [{ to: intent.escrowContractAddress, data: `${SELECTORS.getPrizeDistribution}${word(intent.challengeId)}` }, "latest"] },
    { method: "eth_call", params: [{ to: intent.escrowContractAddress, data: SELECTORS.totalLockedPrizePools }, "latest"] },
    { method: "eth_call", params: [{ to: intent.escrowContractAddress, data: SELECTORS.totalLockedPlatformFees }, "latest"] },
    { method: "eth_call", params: [{ to: intent.escrowContractAddress, data: SELECTORS.getTotalLockedLiabilities }, "latest"] },
    { method: "eth_call", params: [{ to: ARC_TESTNET_USDC_CONTRACT, data: `${SELECTORS.balanceOf}${addressWord(walletAddress)}` }, "latest"] },
    { method: "eth_call", params: [{ to: ARC_TESTNET_USDC_CONTRACT, data: `${SELECTORS.balanceOf}${addressWord(intent.escrowContractAddress)}` }, "latest"] },
    { method: "eth_call", params: [{ to: ARC_TESTNET_USDC_CONTRACT, data: `${SELECTORS.allowance}${addressWord(walletAddress)}${addressWord(intent.escrowContractAddress)}` }, "latest"] },
  ]);
  const [
    chainIdHex,
    bytecode,
    usdcRaw,
    treasuryRaw,
    pausedRaw,
    fundedRaw,
    challengeRaw,
    distributionRaw,
    totalLockedPrizePoolsRaw,
    totalLockedPlatformFeesRaw,
    totalLockedLiabilitiesRaw,
    walletBalanceRaw,
    escrowBalanceRaw,
    allowanceRaw,
  ] = callResults;
  const challengeWords = splitWords(challengeRaw);
  const distributionWords = splitWords(distributionRaw);
  const distributionLength = Number(BigInt(`0x${distributionWords[1] ?? "0"}`));
  const challenge = {
    sponsor: addressFromWord(challengeWords[0] ?? ""),
    prizePool: BigInt(`0x${challengeWords[1] ?? "0"}`).toString(),
    platformFee: BigInt(`0x${challengeWords[2] ?? "0"}`).toString(),
    submissionDeadline: Number(BigInt(`0x${challengeWords[3] ?? "0"}`)),
    reviewDeadline: Number(BigInt(`0x${challengeWords[4] ?? "0"}`)),
    winnerCount: Number(BigInt(`0x${challengeWords[5] ?? "0"}`)),
    status: Number(BigInt(`0x${challengeWords[6] ?? "0"}`)),
  };
  const distribution = distributionWords.slice(2, 2 + distributionLength).map((item) => BigInt(`0x${item}`).toString());
  const walletBalance = BigInt(walletBalanceRaw).toString();
  const escrowBalance = BigInt(escrowBalanceRaw).toString();
  const allowance = BigInt(allowanceRaw).toString();
  const escrow = {
    chainId: Number(BigInt(chainIdHex)),
    bytecodeExists: bytecode !== "0x",
    usdc: addressFromWord(splitWords(usdcRaw)[0] ?? ""),
    treasury: addressFromWord(splitWords(treasuryRaw)[0] ?? ""),
    paused: boolFromWord(splitWords(pausedRaw)[0] ?? "0"),
    isFunded: boolFromWord(splitWords(fundedRaw)[0] ?? "0"),
    totalLockedPrizePools: BigInt(totalLockedPrizePoolsRaw).toString(),
    totalLockedPlatformFees: BigInt(totalLockedPlatformFeesRaw).toString(),
    totalLockedLiabilities: BigInt(totalLockedLiabilitiesRaw).toString(),
  };
  let fundingLogs: ChallengeFundedLog[] = [];
  let approvalLogs: ApprovalLog[] = [];
  const persistedFundingTx = ((draft.funding.transactionHash as `0x${string}` | "") || null);
  let fundingTx = persistedFundingTx;
  let receipt = fundingTx ? await getReceipt(fundingTx) : null;
  const receiptFundedEvent = getChallengeFundedEventFromReceipt(receipt, intent, walletAddress);
  if (receiptFundedEvent) {
    fundingLogs = [receiptFundedEvent];
  } else if (receipt?.blockNumber) {
    fundingLogs = await getChallengeFundedLogs(intent.escrowContractAddress, intent.challengeId, walletAddress, { exactBlock: receipt.blockNumber });
  } else if (escrow.isFunded) {
    fundingLogs = await getChallengeFundedLogs(intent.escrowContractAddress, intent.challengeId, walletAddress);
  }
  const persistedApprovalTx = ((draft.funding.approvalTransactionHash as `0x${string}` | "") || null);
  if (!persistedApprovalTx && BigInt(allowance) >= BigInt(intent.totalRequired)) {
    approvalLogs = await getApprovalLogs(walletAddress, intent.escrowContractAddress);
  }
  const challengeFundedEvent = fundingLogs.length === 1 ? fundingLogs[0] : null;
  fundingTx = challengeFundedEvent?.transactionHash ?? persistedFundingTx;
  if (!receipt && fundingTx) receipt = await getReceipt(fundingTx);
  const approvalTx = persistedApprovalTx ?? latestApprovalTx(approvalLogs, intent.totalRequired);
  const transaction = fundingTx ? await getTransactionByHash(fundingTx) : null;
  const receiptSuccess = receipt?.status === "0x1";
  const txDestinationMatches = Boolean(transaction?.to && transaction.to.toLowerCase() === intent.escrowContractAddress.toLowerCase());
  const eventVerified = receiptContainsChallengeFundedEvent(receipt, intent, walletAddress);
  const eventMatchesIntent = Boolean(
    challengeFundedEvent &&
      challengeFundedEvent.prizePool === intent.prizeAmount &&
      challengeFundedEvent.platformFee === intent.platformFee &&
      challengeFundedEvent.winnerCount === intent.winnerCount &&
      challengeFundedEvent.submissionDeadline === intent.submissionDeadline &&
      challengeFundedEvent.reviewDeadline === intent.reviewDeadline,
  );
  const challengeMatchesIntent =
    challenge.sponsor.toLowerCase() === walletAddress.toLowerCase() &&
    challenge.prizePool === intent.prizeAmount &&
    challenge.platformFee === intent.platformFee &&
    challenge.submissionDeadline === intent.submissionDeadline &&
    challenge.reviewDeadline === intent.reviewDeadline &&
    challenge.winnerCount === intent.winnerCount &&
    distribution.join(",") === intent.prizeDistribution.join(",");
  const challengeVerified = Boolean(
    escrow.chainId === ARC_CHAIN_ID &&
      escrow.bytecodeExists &&
      escrow.usdc.toLowerCase() === intent.usdcContractAddress.toLowerCase() &&
      !escrow.paused &&
      escrow.isFunded &&
      fundingLogs.length === 1 &&
      receiptSuccess &&
      eventVerified &&
      eventMatchesIntent &&
      challengeMatchesIntent,
  );
  const value: CanonicalFundingVerification = {
    draft,
    intent,
    wallet,
    walletAddress,
    chainId: escrow.chainId,
    bytecodeExists: escrow.bytecodeExists,
    escrow,
    challenge,
    distribution,
    walletBalance,
    escrowBalance,
    allowance,
    approvalTx,
    fundingTx,
    receipt,
    transaction,
    challengeFundedEvent,
    blockNumber: challengeFundedEvent?.blockNumber ?? receipt?.blockNumber ?? null,
    eventVerified,
    challengeVerified,
    txDestinationMatches,
    eventMatchesIntent,
    challengeMatchesIntent,
    approvalLogCount: approvalLogs.length,
    fundingLogCount: fundingLogs.length,
    balanceTimestamp: new Date().toISOString(),
  };
  verificationCache.set(key, { expiresAt: Date.now() + VERIFICATION_CACHE_TTL_MS, value });
  return value;
}
export async function getCreateChallengePreflight(userToken: unknown, draftId?: string, input: FundingAccountScope = {}) {
  assertToken(userToken);
  assertDraftScope(draftId);
  const draft = await getCreateChallengeDraft(draftId);
  const intent = getFundingIntentFromDraft(draft, input);
  const overview = await getCreateChallengePaymentOverview(draftId, undefined, input);
  const blockers: string[] = [];

  const deadlinePolicy = deadlinePolicyForDraft(draft);
  logCreateChallengeDeadlinePolicy("/api/create-challenge/preflight", deadlinePolicy);
  blockers.push(...validateCreateChallengeLaunchReadiness(draft, { deadlinePolicy }).errors);

  if (overview.paymentState === "RECOVERABLE_ERROR") blockers.push(overview.safeMessage || "We couldn't refresh your balance. Please try again.");
  if (overview.paymentState === "FATAL_ERROR") blockers.push(overview.safeMessage || "Payment account verification failed.");
  if (overview.paymentState === "INSUFFICIENT_BALANCE") blockers.push("Available test USDC is below the total required amount.");

  const ready = blockers.length === 0 && overview.paymentState === "READY_FOR_APPROVAL";
  const updated = await patchCreateChallengeDraft({
    funding: {
      ...draft.funding,
      walletId: overview.paymentAccount.walletId,
      walletAddress: overview.paymentAccount.walletAddress,
      availableBalance: Number(formatTestUsdc(overview.balance.units).replace(/,/g, "")),
      lastBalanceRefreshAt: overview.balance.readAt,
      fundingStatus: ready ? "ready" : draft.funding.fundingStatus,
    } as never,
  }, draft.challenge.id, { ccnAccountId: intent.ccnAccountId });

  return {
    chainId: overview.diagnostics.chainId,
    wallet: {
      walletId: overview.paymentAccount.walletId,
      walletAddress: overview.paymentAccount.walletAddress,
      blockchain: USER_WALLET_BLOCKCHAIN,
      accountType: USER_WALLET_ACCOUNT_TYPE,
      state: overview.paymentAccount.walletState === "Ready" ? "LIVE" : overview.paymentAccount.walletState,
    },
    challengeId: intent.challengeId,
    fundingIntentId: intent.fundingIntentId,
    status: ready ? "READY_FOR_FUNDING" : escrowStatusFromDraftFunding(updated.funding.fundingStatus),
    amounts: {
      prizeAmount: intent.prizeAmount,
      platformFee: intent.platformFee,
      totalRequired: intent.totalRequired,
    },
    deadlines: {
      submissionDeadline: intent.submissionDeadline,
      reviewDeadline: intent.reviewDeadline,
    },
    balances: {
      brandUsdc: overview.balance.units,
      brandNativeWei: "0",
      escrowUsdc: "0",
    },
    balanceSource: {
      address: overview.paymentAccount.walletAddress,
      source: "Canonical Brand payment wallet",
      timestamp: overview.balance.readAt,
      network: USER_WALLET_BLOCKCHAIN,
      chainId: overview.diagnostics.chainId,
    },
    escrow: {
      address: intent.escrowContractAddress,
      bytecodeExists: true,
      usdc: intent.usdcContractAddress,
      paused: Boolean(overview.diagnostics.escrowPaused),
      isFunded: false,
      totalLockedPrizePools: "0",
      totalLockedPlatformFees: "0",
      totalLockedLiabilities: "0",
    },
    allowance: "0",
    ready,
    blockers,
    paymentOverview: overview,
    display: {
      brandUsdc: formatTestUsdc(overview.balance.units),
      escrowUsdc: "0",
      allowance: "0",
      verifiedCircleBalance: formatTestUsdc(overview.balance.units),
      prizeAmount: formatTestUsdc(intent.prizeAmount),
      platformFee: formatTestUsdc(intent.platformFee),
      totalRequired: formatTestUsdc(intent.totalRequired),
    },
  } satisfies EscrowPreflightSnapshot & { display: Record<string, string>; paymentOverview: unknown };
}

function assertLaunchReadinessBeforeFinancialAction(
  draft: Awaited<ReturnType<typeof getCreateChallengeDraft>>,
  endpoint: string,
) {
  const deadlinePolicy = deadlinePolicyForDraft(draft);
  logCreateChallengeDeadlinePolicy(endpoint, deadlinePolicy);
  const readiness = validateCreateChallengeLaunchReadiness(draft, { deadlinePolicy });
  if (readiness.valid) return;
  throw new CircleSpikeError({
    message: readiness.errors[0] ?? "Complete required Business Challenge details before launch.",
    status: 400,
    code: readiness.items.find((item) => item.status !== "ready")?.id === "campaign-cover"
      ? "CAMPAIGN_COVER_REQUIRED"
      : "CAMPAIGN_LAUNCH_REQUIREMENTS_INCOMPLETE",
    endpoint,
  });
}

export async function createProductApprovalChallenge(userToken: unknown, draftId?: string, input: FundingAccountScope = {}) {
  assertToken(userToken);
  assertDraftScope(draftId);
  const draft = await getCreateChallengeDraft(draftId);
  assertLaunchReadinessBeforeFinancialAction(draft, "/api/create-challenge/approve");
  const intent = getFundingIntentFromDraft(draft, input);
  const wallet = await getBrandWallet(userToken, draftId, input);
  const recovery = await reconcileCurrentApprovalAttempts(userToken, draftId, input);
  if (recovery.restoredState === "APPROVED") {
    return {
      alreadyApproved: true,
      challengeId: recovery.canonicalAttempt?.circleChallengeId,
      attempts: recovery.attempts.length,
    };
  }
  if (recovery.restoredState === "APPROVAL_PENDING" && recovery.canonicalAttempt?.circleChallengeId) {
    return {
      alreadyPending: true,
      challengeId: recovery.canonicalAttempt.circleChallengeId,
      attempts: recovery.attempts.length,
    };
  }
  const preflight = await getCreateChallengePreflight(userToken, draftId, input);
  if (!preflight.ready) throw new CircleSpikeError({ message: preflight.blockers.join(" ") });
  const idempotencyKey = stableUuid(
    "approval",
    [
      intent.ccnAccountId,
      wallet.walletId,
      draft.challenge.id,
      intent.challengeId,
      intent.fundingIntentId,
      "APPROVAL",
    ].join(":"),
  );
  const data = await circleFetch<CircleContractExecutionResponse>({
    endpoint: "/v1/w3s/user/transactions/contractExecution",
    method: "POST",
    userToken,
    body: {
      walletId: preflight.wallet.walletId,
      contractAddress: intent.usdcContractAddress,
      idempotencyKey,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [intent.escrowContractAddress, intent.totalRequired],
      feeLevel: "MEDIUM",
      refId: `ccn-approve-${intent.challengeLogicalId}`,
    },
  });
  if (!data.challengeId) {
    throw new CircleSpikeError({ message: "Payment approval challenge was not returned." });
  }
  await persistApprovalAttempt({
    userToken,
    draftId,
    ccnAccountId: input.ccnAccountId,
    circleChallengeId: data.challengeId,
    idempotencyKey,
    status: "PENDING",
  });
  await patchCreateChallengeDraft({ funding: { fundingStatus: "approval-pending" } as never }, draft.challenge.id, { ccnAccountId: intent.ccnAccountId });
  return { alreadyApproved: false, challengeId: data.challengeId, attempts: recovery.attempts.length + 1 };
}

export async function createProductFundingChallenge(userToken: unknown, draftId?: string, input: FundingAccountScope = {}) {
  assertToken(userToken);
  assertDraftScope(draftId);
  const draft = await getCreateChallengeDraft(draftId);
  assertLaunchReadinessBeforeFinancialAction(draft, "/api/create-challenge/fund");
  const intent = getFundingIntentFromDraft(draft, input);
  const wallet = await getBrandWallet(userToken, draftId, input);
  const scopedDraftId = draft.challenge.id ?? draftId;
  const scope = approvalAttemptScope({
    ccnAccountId: intent.ccnAccountId,
    walletId: wallet.walletId,
    draftId: scopedDraftId,
    challengeId: intent.challengeId,
    fundingIntentId: intent.fundingIntentId,
  });
  const fundingAttempts = await listFundingAttemptsForScope(scope);
  const activeAttempt = fundingAttempts.find((attempt) => activeApprovalStatus(attempt.circleStatus));
  if (activeAttempt) {
    await patchCreateChallengeDraft({
      funding: {
        fundingStatus: "funding-pending",
        fundingChallengeId: activeAttempt.circleChallengeId,
        transactionId: activeAttempt.circleTransactionId ?? draft.funding.transactionId,
        transactionHash: activeAttempt.transactionHash ?? draft.funding.transactionHash,
      } as never,
    }, draft.challenge.id, { ccnAccountId: intent.ccnAccountId });
    return {
      alreadyPending: true,
      challengeId: activeAttempt.circleChallengeId,
      attempts: fundingAttempts.length,
    };
  }
  const verification = await getCanonicalFundingVerification(userToken, draftId, { useCache: true, ccnAccountId: input.ccnAccountId });
  if (verification.escrow.isFunded) {
    await patchCreateChallengeDraft({
      funding: {
        fundingStatus: verification.challengeVerified ? "funded" : draft.funding.fundingStatus,
        escrowStatus: verification.challengeVerified ? "verified" : draft.funding.escrowStatus,
        transactionHash: verification.fundingTx ?? draft.funding.transactionHash,
        eventVerified: verification.eventVerified || draft.funding.eventVerified,
      } as never,
      deployment: verification.challengeVerified ? { publicationStatus: "ready-to-publish" } as never : undefined,
    }, draft.challenge.id, { ccnAccountId: intent.ccnAccountId });
    throw new CircleSpikeError({ message: "This challenge ID is already funded." });
  }
  if (BigInt(verification.allowance) < BigInt(intent.totalRequired)) {
    throw new CircleSpikeError({ message: "Approval is not sufficient for funding." });
  }
  const preflight = { wallet: verification.wallet };
  const idempotencyKey = stableUuid(
    "funding",
    [
      intent.ccnAccountId,
      preflight.wallet.walletId,
      draft.challenge.id,
      intent.challengeId,
      intent.fundingIntentId,
      "FUNDING",
    ].join(":"),
  );
  const data = await circleFetch<CircleContractExecutionResponse>({
    endpoint: "/v1/w3s/user/transactions/contractExecution",
    method: "POST",
    userToken,
    body: {
      walletId: preflight.wallet.walletId,
      contractAddress: intent.escrowContractAddress,
      idempotencyKey,
      abiFunctionSignature: "fundChallenge(bytes32,uint256[],uint256,uint64,uint64)",
      abiParameters: [
        intent.challengeId,
        intent.prizeDistribution,
        intent.platformFee,
        String(intent.submissionDeadline),
        String(intent.reviewDeadline),
      ],
      feeLevel: "MEDIUM",
      refId: `ccn-fund-${intent.challengeLogicalId}`,
    },
  });
  if (!data.challengeId) {
    throw new CircleSpikeError({ message: "Prize pool funding challenge was not returned." });
  }
  await persistFundingAttempt({
    userToken,
    draftId,
    ccnAccountId: input.ccnAccountId,
    circleChallengeId: data.challengeId,
    idempotencyKey,
    status: "PENDING",
  });
  await patchCreateChallengeDraft({
    funding: {
      fundingStatus: "funding-pending",
      fundingChallengeId: data.challengeId,
    } as never,
  }, draft.challenge.id, { ccnAccountId: intent.ccnAccountId });
  return { alreadyPending: false, challengeId: data.challengeId, attempts: fundingAttempts.length + 1 };
}

function collectStringCandidates(
  value: unknown,
  predicate: (key: string) => boolean,
  ids = new Set<string>(),
  parentKey = "",
) {
  if (!value || typeof value !== "object") return ids;
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (typeof item === "string" && predicate(parentKey)) ids.add(item);
      else collectStringCandidates(item, predicate, ids, parentKey);
    });
    return ids;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    if (Array.isArray(item)) {
      collectStringCandidates(item, predicate, ids, key);
    } else if (typeof item === "string" && predicate(key)) {
      ids.add(item);
    } else {
      collectStringCandidates(item, predicate, ids, key);
    }
  });
  return ids;
}

function collectCorrelationIds(value: unknown) {
  return collectStringCandidates(value, (key) => key === "correlationIds" || /correlation/i.test(key));
}

function collectExplicitTransactionIds(value: unknown) {
  return collectStringCandidates(value, (key) => /transaction/i.test(key));
}

export function resolveCircleTransactionIdFromChallenge(challenge: unknown) {
  return Array.from(collectCorrelationIds(challenge)).at(0) ?? Array.from(collectExplicitTransactionIds(challenge)).at(0);
}

function collectStringValues(value: unknown, values = new Set<string>()) {
  if (!value || typeof value !== "object") return values;
  if (Array.isArray(value)) {
    value.forEach((item) => collectStringValues(item, values));
    return values;
  }
  Object.values(value as Record<string, unknown>).forEach((item) => {
    if (typeof item === "string") values.add(item);
    else collectStringValues(item, values);
  });
  return values;
}

function circleChallengeId(challenge: Record<string, unknown>) {
  return typeof challenge.id === "string"
    ? challenge.id
    : typeof challenge.challengeId === "string"
      ? challenge.challengeId
      : "";
}

function circleChallengeStatus(challenge: Record<string, unknown>): ApprovalAttemptStatus {
  const raw =
    typeof challenge.status === "string"
      ? challenge.status
      : typeof challenge.state === "string"
        ? challenge.state
        : "PENDING";
  const normalized = raw.toUpperCase();
  if (normalized === "COMPLETED") return "COMPLETED";
  if (normalized === "COMPLETE") return "COMPLETE";
  if (normalized === "FAILED") return "FAILED";
  if (normalized === "EXPIRED") return "EXPIRED";
  if (normalized === "IN_PROGRESS") return "IN_PROGRESS";
  if (normalized === "APPROVED") return "APPROVED";
  return "PENDING";
}

function circleChallengeType(challenge: Record<string, unknown>) {
  return typeof challenge.type === "string"
    ? challenge.type
    : typeof challenge.challengeType === "string"
      ? challenge.challengeType
      : undefined;
}

function activeApprovalStatus(status: ApprovalAttemptStatus) {
  return status === "PENDING" || status === "IN_PROGRESS" || status === "COMPLETE" || status === "COMPLETED" || status === "APPROVED";
}

function terminalApprovalStatus(status: ApprovalAttemptStatus) {
  return status === "FAILED" || status === "EXPIRED";
}

async function listCircleChallenges(userToken: string) {
  try {
    const data = await circleFetch<CircleChallengeListResponse>({
      endpoint: "/v1/w3s/user/challenges",
      method: "GET",
      userToken,
    });
    return data.challenges ?? [];
  } catch {
    return [];
  }
}

async function getCircleChallenge(challengeId: string, userToken: string) {
  const data = await circleFetch<CircleChallengeResponse>({
    endpoint: `/v1/w3s/user/challenges/${challengeId}`,
    method: "GET",
    userToken,
  });
  return data.challenge ?? null;
}

async function readApprovalAllowance(owner: string, spender: string, token: string) {
  const raw = await rpc<string>("eth_call", [
    {
      to: token,
      data: `${SELECTORS.allowance}${addressWord(owner)}${addressWord(spender)}`,
    },
    "latest",
  ]);
  return BigInt(raw).toString();
}

function approvalAttemptScope(input: {
  ccnAccountId: string;
  walletId: string;
  draftId: string;
  challengeId: string;
  fundingIntentId: string;
}) {
  return {
    ccnAccountId: input.ccnAccountId,
    walletId: input.walletId,
    draftId: input.draftId,
    challengeId: input.challengeId,
    fundingIntentId: input.fundingIntentId,
  };
}

async function persistApprovalAttempt(input: {
  userToken: string;
  draftId: string;
  ccnAccountId?: string;
  circleChallengeId: string;
  idempotencyKey: string;
  status?: ApprovalAttemptStatus;
  transactionId?: string;
  transactionHash?: string;
  errorCode?: string | number;
  errorMessage?: string;
}) {
  const draft = await getCreateChallengeDraft(input.draftId);
  const intent = getFundingIntentFromDraft(draft, { ccnAccountId: input.ccnAccountId });
  const wallet = await getBrandWallet(input.userToken, input.draftId, { ccnAccountId: input.ccnAccountId });
  const challenge =
    input.circleChallengeId ? await getCircleChallenge(input.circleChallengeId, input.userToken).catch(() => null) : null;
  const transactionId =
    input.transactionId ??
    (challenge ? resolveCircleTransactionIdFromChallenge(challenge) : undefined);
  const transaction = transactionId ? await getTransaction(transactionId, input.userToken).catch(() => null) : null;
  const transactionHash = input.transactionHash ?? transaction?.txHash ?? transaction?.transactionHash;
  return upsertApprovalAttemptForScope({
    scope: approvalAttemptScope({
      ccnAccountId: intent.ccnAccountId,
      walletId: wallet.walletId,
      draftId: draft.challenge.id ?? input.draftId,
      challengeId: intent.challengeId,
      fundingIntentId: intent.fundingIntentId,
    }),
    attempt: {
      ccnAccountId: intent.ccnAccountId,
      walletId: wallet.walletId,
      draftId: draft.challenge.id ?? input.draftId,
      challengeId: intent.challengeId,
      fundingIntentId: intent.fundingIntentId,
      purpose: "APPROVAL",
      idempotencyKey: input.idempotencyKey,
      circleChallengeId: input.circleChallengeId,
      circleStatus: input.status ?? (challenge ? circleChallengeStatus(challenge) : "PENDING"),
      circleType: challenge ? circleChallengeType(challenge) : undefined,
      circleTransactionId: transactionId,
      transactionHash,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    },
  });
}

async function persistFundingAttempt(input: {
  userToken: string;
  draftId: string;
  ccnAccountId?: string;
  circleChallengeId: string;
  idempotencyKey: string;
  status?: ApprovalAttemptStatus;
  transactionId?: string;
  transactionHash?: string;
  errorCode?: string | number;
  errorMessage?: string;
}) {
  const draft = await getCreateChallengeDraft(input.draftId);
  const intent = getFundingIntentFromDraft(draft, { ccnAccountId: input.ccnAccountId });
  const wallet = await getBrandWallet(input.userToken, input.draftId, { ccnAccountId: input.ccnAccountId });
  const challenge =
    input.circleChallengeId ? await getCircleChallenge(input.circleChallengeId, input.userToken).catch(() => null) : null;
  const transactionId =
    input.transactionId ??
    (challenge ? resolveCircleTransactionIdFromChallenge(challenge) : undefined);
  const transaction = transactionId ? await getTransaction(transactionId, input.userToken).catch(() => null) : null;
  const transactionHash = input.transactionHash ?? transaction?.txHash ?? transaction?.transactionHash;
  return upsertFundingAttemptForScope({
    scope: approvalAttemptScope({
      ccnAccountId: intent.ccnAccountId,
      walletId: wallet.walletId,
      draftId: draft.challenge.id ?? input.draftId,
      challengeId: intent.challengeId,
      fundingIntentId: intent.fundingIntentId,
    }),
    attempt: {
      ccnAccountId: intent.ccnAccountId,
      walletId: wallet.walletId,
      draftId: draft.challenge.id ?? input.draftId,
      challengeId: intent.challengeId,
      fundingIntentId: intent.fundingIntentId,
      purpose: "FUNDING",
      idempotencyKey: input.idempotencyKey,
      circleChallengeId: input.circleChallengeId,
      circleStatus: input.status ?? (challenge ? circleChallengeStatus(challenge) : "PENDING"),
      circleType: challenge ? circleChallengeType(challenge) : undefined,
      circleTransactionId: transactionId,
      transactionHash,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    },
  });
}

async function findApprovalAttemptsFromCircle(userToken: string, draftId: string, input: FundingAccountScope = {}) {
  const draft = await getCreateChallengeDraft(draftId);
  const intent = getFundingIntentFromDraft(draft, input);
  const wallet = await getBrandWallet(userToken, draftId, input);
  const scope = approvalAttemptScope({
    ccnAccountId: intent.ccnAccountId,
    walletId: wallet.walletId,
    draftId: draft.challenge.id ?? draftId,
    challengeId: intent.challengeId,
    fundingIntentId: intent.fundingIntentId,
  });
  const idempotencyKey = stableUuid(
    "approval",
    [intent.ccnAccountId, wallet.walletId, draft.challenge.id, intent.challengeId, intent.fundingIntentId, "APPROVAL"].join(":"),
  );
  const refId = `ccn-approve-${intent.challengeLogicalId}`;
  const listed = await listCircleChallenges(userToken);
  const matched = listed.filter((challenge) => {
    const values = collectStringValues(challenge);
    return values.has(refId) || values.has(idempotencyKey);
  });
  for (const challenge of matched) {
    const id = circleChallengeId(challenge);
    if (!id) continue;
    await upsertApprovalAttemptForScope({
      scope,
      attempt: {
        ccnAccountId: intent.ccnAccountId,
        walletId: wallet.walletId,
        draftId: draft.challenge.id ?? draftId,
        challengeId: intent.challengeId,
        fundingIntentId: intent.fundingIntentId,
        purpose: "APPROVAL",
        idempotencyKey,
        circleChallengeId: id,
        circleStatus: circleChallengeStatus(challenge),
        circleType: circleChallengeType(challenge),
      },
    });
  }
  return listApprovalAttemptsForScope(scope);
}

export async function reconcileCurrentApprovalAttempts(
  userToken: unknown,
  draftId?: string,
  input: FundingAccountScope = {},
): Promise<ApprovalRecoveryResult> {
  assertToken(userToken);
  assertDraftScope(draftId);
  const draft = await getCreateChallengeDraft(draftId);
  const intent = getFundingIntentFromDraft(draft, input);
  const wallet = await getBrandWallet(userToken, draftId, input);
  const scope = approvalAttemptScope({
    ccnAccountId: intent.ccnAccountId,
    walletId: wallet.walletId,
    draftId: draft.challenge.id ?? draftId,
    challengeId: intent.challengeId,
    fundingIntentId: intent.fundingIntentId,
  });
  let attempts = await listApprovalAttemptsForScope(scope);
  if (attempts.length === 0) {
    attempts = await findApprovalAttemptsFromCircle(userToken, draftId, input);
  }
  attempts = await Promise.all(
    attempts.map(async (attempt) => {
      const challenge = await getCircleChallenge(attempt.circleChallengeId, userToken).catch(() => null);
      if (!challenge) return attempt;
      const transactionId = resolveCircleTransactionIdFromChallenge(challenge) ?? attempt.circleTransactionId;
      const transaction = transactionId ? await getTransaction(transactionId, userToken).catch(() => null) : null;
      return persistApprovalAttempt({
        userToken,
        draftId,
        ccnAccountId: input.ccnAccountId,
        circleChallengeId: attempt.circleChallengeId,
        idempotencyKey: attempt.idempotencyKey,
        status: circleChallengeStatus(challenge),
        transactionId,
        transactionHash: transaction?.txHash ?? transaction?.transactionHash ?? attempt.transactionHash,
      });
    }),
  );
  const allowance = await readApprovalAllowance(wallet.walletAddress, intent.escrowContractAddress, intent.usdcContractAddress);
  const canonicalAttempt = attempts.filter((attempt) => activeApprovalStatus(attempt.circleStatus) || attempt.transactionHash).at(-1) ?? null;

  if (BigInt(allowance) >= BigInt(intent.totalRequired)) {
    await patchCreateChallengeDraft({
      funding: {
        walletId: wallet.walletId,
        walletAddress: wallet.walletAddress,
        approvalTransactionId: canonicalAttempt?.circleTransactionId ?? draft.funding.approvalTransactionId,
        approvalTransactionHash: canonicalAttempt?.transactionHash ?? draft.funding.approvalTransactionHash,
        fundingStatus: "approved",
        availableBalance: draft.funding.availableBalance,
      } as never,
    }, draft.challenge.id, { ccnAccountId: intent.ccnAccountId });
    return { attempts, allowance, requiredAllowance: intent.totalRequired, canonicalAttempt, restoredState: "APPROVED" };
  }

  const activeAttempt = attempts.find((attempt) => activeApprovalStatus(attempt.circleStatus));
  if (activeAttempt) {
    await patchCreateChallengeDraft({
      funding: {
        walletId: wallet.walletId,
        walletAddress: wallet.walletAddress,
        approvalTransactionId: activeAttempt.circleTransactionId ?? draft.funding.approvalTransactionId,
        approvalTransactionHash: activeAttempt.transactionHash ?? draft.funding.approvalTransactionHash,
        fundingStatus: "approval-pending",
      } as never,
    }, draft.challenge.id, { ccnAccountId: intent.ccnAccountId });
    return { attempts, allowance, requiredAllowance: intent.totalRequired, canonicalAttempt: activeAttempt, restoredState: "APPROVAL_PENDING" };
  }

  const terminalOnly = attempts.length > 0 && attempts.every((attempt) => terminalApprovalStatus(attempt.circleStatus));
  await patchCreateChallengeDraft({
    funding: {
      walletId: wallet.walletId,
      walletAddress: wallet.walletAddress,
      fundingStatus: terminalOnly ? "ready" : "ready",
    } as never,
  }, draft.challenge.id, { ccnAccountId: intent.ccnAccountId });
  return { attempts, allowance, requiredAllowance: intent.totalRequired, canonicalAttempt: null, restoredState: terminalOnly ? "START_AGAIN" : "READY_FOR_APPROVAL" };
}

async function getChallengeTransactionId(challengeId: string, userToken: string) {
  const data = await circleFetch<CircleChallengeResponse>({
    endpoint: `/v1/w3s/user/challenges/${challengeId}`,
    method: "GET",
    userToken,
  });
  return resolveCircleTransactionIdFromChallenge(data.challenge);
}

async function getTransaction(transactionId: string, userToken: string) {
  try {
    const data = await circleFetch<CircleTransactionResponse>({
      endpoint: `/v1/w3s/transactions/${transactionId}`,
      method: "GET",
      userToken,
    });
    return data.transaction ?? null;
  } catch (error) {
    if (
      error instanceof CircleSpikeError &&
      error.safe.status === 404 &&
      String(error.safe.code) === "156003"
    ) {
      return null;
    }
    throw error;
  }
}

export async function reconcileProductTransaction(input: {
  userToken: unknown;
  stage: EscrowTransactionStage;
  challengeId: string;
  draftId?: string;
  ccnAccountId?: string;
}) {
  assertToken(input.userToken);
  assertDraftScope(input.draftId);
  if (input.stage === "approval") {
    await persistApprovalAttempt({
      userToken: input.userToken,
      draftId: input.draftId,
      ccnAccountId: input.ccnAccountId,
      circleChallengeId: input.challengeId,
      idempotencyKey: stableUuid("approval-recovered", input.challengeId),
    });
    const recovery = await reconcileCurrentApprovalAttempts(input.userToken, input.draftId, { ccnAccountId: input.ccnAccountId });
    const canonical = recovery.canonicalAttempt;
    return {
      stage: input.stage,
      challengeId: canonical?.circleChallengeId ?? input.challengeId,
      transactionId: canonical?.circleTransactionId,
      transactionHash: canonical?.transactionHash as `0x${string}` | undefined,
      state: recovery.restoredState,
    } satisfies EscrowTransactionSnapshot;
  }
  const draft = await getCreateChallengeDraft(input.draftId);
  const intent = getFundingIntentFromDraft(draft, { ccnAccountId: input.ccnAccountId });
  const wallet = await getBrandWallet(input.userToken, input.draftId, { ccnAccountId: input.ccnAccountId });
  const fundingScope = approvalAttemptScope({
    ccnAccountId: intent.ccnAccountId,
    walletId: wallet.walletId,
    draftId: draft.challenge.id ?? input.draftId,
    challengeId: intent.challengeId,
    fundingIntentId: intent.fundingIntentId,
  });
  const existingFundingAttempt = (await listFundingAttemptsForScope(fundingScope))
    .find((attempt) => attempt.circleChallengeId === input.challengeId);
  const fundingIdempotencyKey =
    existingFundingAttempt?.idempotencyKey ?? stableUuid("funding-recovered", input.challengeId);
  await persistFundingAttempt({
    userToken: input.userToken,
    draftId: input.draftId,
    ccnAccountId: input.ccnAccountId,
    circleChallengeId: input.challengeId,
    idempotencyKey: fundingIdempotencyKey,
  });
  const transactionId = await getChallengeTransactionId(input.challengeId, input.userToken);
  if (!transactionId) {
    await restoreFundingStateFromChain(input.userToken, draft.challenge.id, { ccnAccountId: input.ccnAccountId });
    await patchCreateChallengeDraft({
      funding: {
        fundingChallengeId: input.challengeId,
        fundingStatus: "funding-pending",
        escrowStatus: "pending",
      } as never,
    }, draft.challenge.id, { ccnAccountId: intent.ccnAccountId });
    return { stage: input.stage, challengeId: input.challengeId } satisfies EscrowTransactionSnapshot;
  }
  const transaction = await getTransaction(transactionId, input.userToken);
  if (!transaction) {
    await restoreFundingStateFromChain(input.userToken, draft.challenge.id, { ccnAccountId: input.ccnAccountId });
    await patchCreateChallengeDraft({
      funding: {
        fundingChallengeId: input.challengeId,
        transactionId,
        fundingStatus: "funding-pending",
        escrowStatus: "pending",
      } as never,
    }, draft.challenge.id, { ccnAccountId: intent.ccnAccountId });
    return {
      stage: input.stage,
      challengeId: input.challengeId,
      state: "RESTORED_FROM_CHAIN",
    } satisfies EscrowTransactionSnapshot;
  }
  const transactionHash = transaction?.txHash ?? transaction?.transactionHash;
  await persistFundingAttempt({
    userToken: input.userToken,
    draftId: input.draftId,
    ccnAccountId: input.ccnAccountId,
    circleChallengeId: input.challengeId,
    idempotencyKey: fundingIdempotencyKey,
    transactionId,
    transactionHash,
    status: "COMPLETE",
  });
  await patchCreateChallengeDraft({
    funding: {
      fundingChallengeId: input.challengeId,
      transactionId,
      transactionHash: transactionHash ?? "",
      fundingStatus: transactionHash ? "funded" : "funding-pending",
      escrowStatus: transactionHash ? "locked" : "pending",
    } as never,
  }, draft.challenge.id, { ccnAccountId: intent.ccnAccountId });
  const restored = transactionHash ? await restoreFundingStateFromChain(input.userToken, draft.challenge.id, { ccnAccountId: input.ccnAccountId }) : null;
  return {
    stage: input.stage,
    challengeId: input.challengeId,
    transactionId,
    transactionHash,
    state: restored?.challengeVerified ? "FUNDED_VERIFIED" : transaction?.state ?? transaction?.status,
  } satisfies EscrowTransactionSnapshot;
}

async function getReceipt(hash: string) {
  return rpc<Receipt | null>("eth_getTransactionReceipt", [hash]);
}

async function verifyFundedChallenge(userToken: unknown, draftId?: string, input: FundingAccountScope = {}) {
  const verification = await getCanonicalFundingVerification(userToken, draftId, input);
  const { draft, intent, wallet, walletAddress, challengeVerified } = verification;

  if (verification.approvalTx || verification.fundingTx || challengeVerified) {
    await patchCreateChallengeDraft({
      funding: {
        walletId: wallet.walletId,
        walletAddress,
        approvalTransactionHash: verification.approvalTx ?? draft.funding.approvalTransactionHash,
        transactionHash: verification.fundingTx ?? draft.funding.transactionHash,
        fundingBlockNumber: verification.blockNumber ?? draft.funding.fundingBlockNumber,
        fundingLogIndex: verification.challengeFundedEvent?.logIndex ?? draft.funding.fundingLogIndex,
        eventVerified: verification.eventVerified || draft.funding.eventVerified,
        fundingStatus: challengeVerified ? "funded" : draft.funding.fundingStatus,
        escrowStatus: challengeVerified ? "verified" : draft.funding.escrowStatus,
        availableBalance: Number(formatTestUsdc(verification.walletBalance).replace(/,/g, "")),
        lastBalanceRefreshAt: verification.balanceTimestamp,
      } as never,
      ...(challengeVerified
        ? {
            reviewRules: {
              submissionDeadline: new Date(verification.challenge.submissionDeadline * 1000).toISOString(),
              reviewDeadline: new Date(verification.challenge.reviewDeadline * 1000).toISOString(),
            } as never,
          }
        : {}),
      ...(challengeVerified
        ? { deployment: { status: "ready", publicationStatus: "ready-to-publish" } as never }
        : {}),
    }, draft.challenge.id, { ccnAccountId: intent.ccnAccountId });
    if (verification.challengeVerified && verification.fundingTx) {
      await upsertOnChainVerification({
        txHash: verification.fundingTx,
        circleTransactionId: draft.funding.transactionId ?? "",
        circleChallengeId: draft.funding.fundingChallengeId ?? "",
        draftId: draft.challenge.id ?? "",
        challengeId: intent.challengeId,
        fundingIntentId: intent.fundingIntentId,
        walletId: wallet.walletId,
        ccnAccountId: intent.ccnAccountId,
        eventType: "ChallengeFunded",
        blockNumber: verification.blockNumber === null ? null : Number(verification.blockNumber),
        receiptStatus: verification.receipt?.status === "0x1" ? "success" : undefined,
        receiptVerified: verification.receipt?.status === "0x1",
        eventVerified: verification.eventVerified,
        challengeVerified: verification.challengeVerified,
        sponsorVerified: verification.eventMatchesIntent && verification.txDestinationMatches,
        amountVerified: verification.challengeMatchesIntent,
        submissionDeadline: verification.challenge.submissionDeadline,
        reviewDeadline: verification.challenge.reviewDeadline,
        verifiedAt: new Date().toISOString(),
      });
    }
  }

  return {
    matches: challengeVerified,
    draft,
    intent: verification.intent,
    receipt: verification.receipt,
    transaction: verification.transaction,
    logs: verification.challengeFundedEvent ? [verification.challengeFundedEvent] : [],
    recoveredLog: verification.challengeFundedEvent,
    isFunded: verification.escrow.isFunded,
    challenge: verification.challenge,
    distribution: verification.distribution,
    balances: {
      brandUsdc: verification.walletBalance,
      escrowUsdc: verification.escrowBalance,
    },
    allowance: verification.allowance,
    totals: {
      totalLockedPrizePools: verification.escrow.totalLockedPrizePools,
      totalLockedPlatformFees: verification.escrow.totalLockedPlatformFees,
      totalLockedLiabilities: verification.escrow.totalLockedLiabilities,
    },
    eventVerified: verification.eventVerified,
    approvalTx: verification.approvalTx,
    fundingTx: verification.fundingTx,
    challengeFundedEvent: verification.challengeFundedEvent,
    blockNumber: verification.blockNumber,
    walletBalance: verification.walletBalance,
    challengeVerified,
    diagnostics: {
      chainId: verification.escrow.chainId,
      bytecodeExists: verification.escrow.bytecodeExists,
      usdc: verification.escrow.usdc,
      treasury: verification.escrow.treasury,
      paused: verification.escrow.paused,
      logCount: verification.fundingLogCount,
      approvalLogCount: verification.approvalLogCount,
      receiptSuccess: verification.receipt?.status === "0x1",
      txDestinationMatches: verification.txDestinationMatches,
      eventMatchesIntent: verification.eventMatchesIntent,
      challengeMatchesIntent: verification.challengeMatchesIntent,
    },
    duplicateSimulation: {
      rejected: true,
      reason: "Duplicate funding uses the exact persisted challenge ID and the contract rejects already-funded challenges.",
    },
    links: {
      contract: `${ARC_EXPLORER_URL}/address/${verification.intent.escrowContractAddress}`,
      funding: verification.fundingTx ? `${ARC_EXPLORER_URL}/tx/${verification.fundingTx}` : null,
    },
  };
}
async function restoreFundingStateFromChain(userToken: unknown, draftId?: string, input: FundingAccountScope = {}) {
  assertToken(userToken);
  const verified = await verifyFundedChallenge(userToken, draftId, input);
  if (verified.matches) return verified;
  const draft = await getCreateChallengeDraft(draftId);
  const wallet = await getBrandWallet(userToken, draftId, input);
  const intent = getFundingIntentFromDraft(draft, input);
  const walletAddress = asHexAddress(wallet.walletAddress);
  const fundingStatus = BigInt(verified.allowance) >= BigInt(intent.totalRequired) ? "approved" : "ready";
  await patchCreateChallengeDraft({
    funding: {
      walletId: wallet.walletId,
      walletAddress,
      approvalTransactionHash: verified.approvalTx ?? draft.funding.approvalTransactionHash,
      transactionHash: verified.fundingTx ?? draft.funding.transactionHash,
      fundingBlockNumber: verified.blockNumber ?? draft.funding.fundingBlockNumber,
      fundingLogIndex: verified.challengeFundedEvent?.logIndex ?? draft.funding.fundingLogIndex,
      eventVerified: verified.eventVerified || draft.funding.eventVerified,
      availableBalance: Number(formatTestUsdc(verified.walletBalance).replace(/,/g, "")),
      lastBalanceRefreshAt: new Date().toISOString(),
      fundingStatus,
      escrowStatus: verified.fundingTx ? "locked" : "not-created",
    } as never,
    deployment: { status: "draft", publicationStatus: "draft" } as never,
  }, draft.challenge.id, { ccnAccountId: intent.ccnAccountId });
  return verified;
}
export async function verifyProductFunding(userToken: unknown, draftId?: string, input: FundingAccountScope = {}) {
  const verified = await verifyFundedChallenge(userToken, draftId, input);
  return {
    walletBalance: verified.walletBalance,
    approvalTx: verified.approvalTx,
    fundingTx: verified.fundingTx,
    receipt: verified.receipt,
    challengeFundedEvent: verified.challengeFundedEvent,
    blockNumber: verified.blockNumber,
    challengeVerified: verified.challengeVerified,
    isFunded: verified.isFunded,
    challenge: verified.challenge,
    distribution: verified.distribution,
    balances: verified.balances,
    allowance: verified.allowance,
    totals: verified.totals,
    eventVerified: verified.eventVerified,
    duplicateSimulation: verified.duplicateSimulation,
    verified: verified.matches,
    links: verified.links,
    diagnostics: verified.diagnostics,
  } satisfies EscrowFundingVerification & {
    verified: boolean;
    links: Record<string, string | null>;
    diagnostics: Record<string, unknown>;
  };
}
function normalizedTxHash(value: string | undefined): string {
  return value?.toLowerCase() ?? "";
}

function publishLinks(intent: ReturnType<typeof getFundingIntentFromDraft>, fundingTx: string | null) {
  return {
    contract: `${ARC_EXPLORER_URL}/address/${intent.escrowContractAddress}`,
    funding: fundingTx ? `${ARC_EXPLORER_URL}/tx/${fundingTx}` : null,
  };
}
function recordMatchesPublishScope(input: {
  record: OnChainVerificationRecord | null;
  draft: Awaited<ReturnType<typeof getCreateChallengeDraft>>;
  intent: ReturnType<typeof getFundingIntentFromDraft>;
}) {
  const { record, draft, intent } = input;
  if (!record || record.orphaned) return false;
  if (record.eventType !== "ChallengeFunded") return false;
  if (record.draftId !== draft.challenge.id) return false;
  if (record.challengeId.toLowerCase() !== intent.challengeId.toLowerCase()) return false;
  if (record.fundingIntentId !== intent.fundingIntentId) return false;
  if (record.ccnAccountId !== intent.ccnAccountId) return false;
  if (record.walletId !== draft.funding.walletId) return false;
  if (normalizedTxHash(record.txHash) !== normalizedTxHash(draft.funding.transactionHash)) return false;
  if (record.receiptStatus && record.receiptStatus !== "success") return false;
  return Boolean(record.verifiedAt);
}

function draftHasVerifiedPublishFunding(draft: Awaited<ReturnType<typeof getCreateChallengeDraft>>) {
  return Boolean(
    (draft.funding.fundingStatus === "funded" || draft.funding.fundingStatus === "live") &&
      draft.funding.escrowStatus === "verified" &&
      draft.funding.eventVerified &&
      draft.funding.transactionHash &&
      draft.funding.transactionId &&
      draft.funding.walletId,
  );
}

async function getTrustedPublishEvidence(draftId?: string, input: FundingAccountScope = {}) {
  assertDraftScope(draftId);
  const draft = await getCreateChallengeDraft(draftId);
  const intent = getFundingIntentFromDraft(draft, input);
  const record = await findOnChainVerificationForDraft({
    draftId: draft.challenge.id ?? "",
    challengeId: intent.challengeId,
    fundingIntentId: intent.fundingIntentId,
  });
  if (!draftHasVerifiedPublishFunding(draft)) return { draft, intent, record: null };
  if (!recordMatchesPublishScope({ record, draft, intent })) return { draft, intent, record: null };
  return { draft, intent, record };
}

function publishedResult(input: {
  draft: Awaited<ReturnType<typeof getCreateChallengeDraft>>;
  intent: ReturnType<typeof getFundingIntentFromDraft>;
  record: OnChainVerificationRecord | null;
}) {
  const fundingTx = input.record?.txHash ?? input.draft.funding.transactionHash ?? null;
  return {
    published: input.draft.deployment.publicationStatus === "live",
    publicationStatus: input.draft.deployment.publicationStatus,
    draft: input.draft,
    paymentOverview: {
      paymentState: input.draft.deployment.publicationStatus === "live" ? "PUBLISHED" : "FUNDED_VERIFIED",
    },
    fundingTx,
    receipt: input.record?.receiptStatus === "success" ? { status: "0x1" } : null,
    challengeFundedEvent: input.record ? { transactionHash: input.record.txHash } : null,
    blockNumber: input.record?.blockNumber ?? null,
    challengeVerified: true,
    isFunded: true,
    eventVerified: true,
    links: publishLinks(input.intent, fundingTx),
    diagnostics: {
      source: "durable-publish-evidence",
      receiptVerified: input.record?.receiptVerified ?? true,
      eventVerified: input.record?.eventVerified ?? true,
      challengeVerified: input.record?.challengeVerified ?? true,
      sponsorVerified: input.record?.sponsorVerified ?? true,
      amountVerified: input.record?.amountVerified ?? true,
    },
  };
}

async function assertNoPublishedSlugConflict(draft: Awaited<ReturnType<typeof getCreateChallengeDraft>>) {
  const slug = draft.challenge.slug;
  if (!slug) return;

  const summaries = await listCreateChallengeDrafts();
  for (const summary of summaries) {
    if (summary.draftId === draft.challenge.id || summary.publicationStatus !== "live") continue;
    const candidate = await getCreateChallengeDraft(summary.draftId);
    if (candidate.challenge.slug !== slug || candidate.deployment.publicationStatus !== "live") continue;
    throw new CircleSpikeError({
      message: "A live challenge already uses this public slug.",
      status: 409,
      code: "PUBLIC_SLUG_CONFLICT",
      endpoint: "/api/create-challenge/publish",
    });
  }
}
function publishBusinessError() {
  return new CircleSpikeError({
    message: "Prize pool verification is not complete yet.",
    status: 409,
    code: "PRIZE_POOL_NOT_VERIFIED",
    endpoint: "/api/create-challenge/publish",
  });
}

function publishRpcError() {
  return new CircleSpikeError({
    message: "Unable to verify funding state on Arc Testnet. Please try again.",
    status: 503,
    code: "ARC_VERIFICATION_UNAVAILABLE",
    endpoint: "/api/create-challenge/publish",
  });
}

function assertLaunchReadinessBeforePublish(draft: Awaited<ReturnType<typeof getCreateChallengeDraft>>) {
  const deadlinePolicy = deadlinePolicyForDraft(draft);
  logCreateChallengeDeadlinePolicy("/api/create-challenge/publish", deadlinePolicy);
  const readiness = validateCreateChallengeLaunchReadiness(draft, { deadlinePolicy });
  if (readiness.valid) return;
  throw new CircleSpikeError({
    message: readiness.errors[0] ?? "Complete required Business Challenge details before publishing.",
    status: 400,
    code: readiness.items.find((item) => item.status !== "ready")?.id === "campaign-cover"
      ? "CAMPAIGN_COVER_REQUIRED"
      : "CAMPAIGN_LAUNCH_REQUIREMENTS_INCOMPLETE",
    endpoint: "/api/create-challenge/publish",
  });
}

export async function verifyAndPublishChallenge(userToken: unknown, draftId?: string, input: FundingAccountScope = {}) {
  // Successful publish responses preserve published: true in every success branch.
  const trusted = await getTrustedPublishEvidence(draftId, input);
  const publishedAt = new Date().toISOString();
  if (trusted.draft.deployment.publicationStatus === "live" && trusted.record) {
    return publishedResult({ draft: trusted.draft, intent: trusted.intent, record: trusted.record });
  }
  assertLaunchReadinessBeforePublish(trusted.draft);
  if (trusted.record) {
    const publishDraft = await ensureCreateChallengeDraftPublicSlugReservation(
      trusted.draft.challenge.id ?? "",
      { ccnAccountId: trusted.intent.ccnAccountId },
    );
    await assertNoPublishedSlugConflict(publishDraft);
    const updated = await patchCreateChallengeDraft({
      funding: { fundingStatus: "live", escrowStatus: "verified", eventVerified: true } as never,
      deployment: { status: "success", publicationStatus: "live", publishedAt } as never,
    }, publishDraft.challenge.id, { ccnAccountId: trusted.intent.ccnAccountId });
    return publishedResult({ draft: updated, intent: trusted.intent, record: trusted.record });
  }

  let verified: Awaited<ReturnType<typeof verifyFundedChallenge>>;
  try {
    verified = await verifyFundedChallenge(userToken, draftId, input);
  } catch (error) {
    if (error instanceof CircleSpikeError && error.safe.status === 503) throw publishRpcError();
    throw error;
  }
  if (!verified.matches) throw publishBusinessError();
  const publishDraft = await ensureCreateChallengeDraftPublicSlugReservation(
    verified.draft.challenge.id ?? "",
    { ccnAccountId: verified.intent.ccnAccountId },
  );
  await assertNoPublishedSlugConflict(publishDraft);
  const updated = await patchCreateChallengeDraft({
    funding: { fundingStatus: "live", escrowStatus: "verified", eventVerified: true } as never,
    deployment: { status: "success", publicationStatus: "live", publishedAt } as never,
  }, publishDraft.challenge.id, { ccnAccountId: verified.intent.ccnAccountId });

  return {
    walletBalance: verified.walletBalance,
    approvalTx: verified.approvalTx,
    fundingTx: verified.fundingTx,
    receipt: verified.receipt,
    challengeFundedEvent: verified.challengeFundedEvent,
    blockNumber: verified.blockNumber,
    challengeVerified: verified.challengeVerified,
    isFunded: verified.isFunded,
    challenge: verified.challenge,
    distribution: verified.distribution,
    balances: verified.balances,
    allowance: verified.allowance,
    totals: verified.totals,
    eventVerified: verified.eventVerified,
    duplicateSimulation: verified.duplicateSimulation,
    published: true,
    publicationStatus: updated.deployment.publicationStatus,
    draft: updated,
    paymentOverview: {
      paymentState: "PUBLISHED",
    },
    links: verified.links,
    diagnostics: verified.diagnostics,
  } satisfies EscrowFundingVerification & {
    published: boolean;
    publicationStatus: string;
    draft: Awaited<ReturnType<typeof getCreateChallengeDraft>>;
    paymentOverview: { paymentState: string };
    links: Record<string, string | null>;
    diagnostics: Record<string, unknown>;
  };
}
