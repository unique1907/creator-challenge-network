import "server-only";

import type {
  EscrowFundingVerification,
  EscrowPreflightSnapshot,
  EscrowTransactionSnapshot,
  EscrowTransactionStage,
} from "@/types/escrow-funding-spike";
import type { FundedChallengeRead } from "@/types/submission";
import { getCreateChallengeDeadlinePolicy } from "@/config/create-challenge-deadline-policy";
import {
  ARC_TESTNET_USDC_CONTRACT,
  CircleSpikeError,
  USER_WALLET_ACCOUNT_TYPE,
  USER_WALLET_BLOCKCHAIN,
  circleFetch,
  getWalletBalances,
  listWallets,
} from "./user-controlled-wallets.server";
import {
  getEscrowFundingIntent,
  updateEscrowFundingIntent,
} from "./escrow-funding-store.server";

const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const ARC_CHAIN_ID = 5_042_002;
const ESCROW_CONTRACT_ADDRESS: `0x${string}` =
  "0x4DCE98F8a35d09F57ECE7A340B8392Ba0Fb7ba3D";
const ARC_EXPLORER_URL = "https://testnet.arcscan.app";

const SELECTORS = {
  allowance: "0xdd62ed3e",
  balanceOf: "0x70a08231",
  fundChallenge: "0xaa3622cb",
  getChallenge: "0x458d2bf1",
  getPrizeDistribution: "0x5237a2a4",
  getTotalLockedLiabilities: "0x7eb53c97",
  isFunded: "0x2b5fe3d9",
  paused: "0x5c975abb",
  totalLockedPlatformFees: "0x70bb942b",
  totalLockedPrizePools: "0xc457a016",
  usdc: "0x3e413bee",
} as const;

const CHALLENGE_FUNDED_TOPIC =
  "0xa23f31b7501da448a32cfd845dabd7febd27b63e242c5364c7b8c4bac456432c";

type CircleChallengeResponse = {
  challenge?: Record<string, unknown>;
};

type CircleContractExecutionResponse = {
  challengeId?: string;
};

type CircleTransactionResponse = {
  transaction?: CircleTransaction;
};

type CircleTransaction = {
  id?: string;
  state?: string;
  status?: string;
  txHash?: `0x${string}`;
  transactionHash?: `0x${string}`;
  blockchain?: string;
  walletId?: string;
  errorReason?: string;
};

type RpcResponse<T> = {
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

function assertToken(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length < 10) {
    throw new CircleSpikeError({ message: "A fresh userToken is required." });
  }
}

function assertHexAddress(value: string): asserts value is `0x${string}` {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new CircleSpikeError({ message: "Invalid EVM address encountered." });
  }
}

function assertHex32(value: string): asserts value is `0x${string}` {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new CircleSpikeError({ message: "Invalid bytes32 challenge ID." });
  }
}

function strip0x(value: string) {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function word(value: string | bigint | number) {
  const hex =
    typeof value === "string"
      ? strip0x(value)
      : BigInt(value).toString(16);
  return hex.padStart(64, "0");
}

function addressWord(address: string) {
  assertHexAddress(address);
  return word(address.toLowerCase());
}

function boolFromWord(value: string) {
  return BigInt(`0x${value}`) === BigInt(1);
}

function addressFromWord(value: string): `0x${string}` {
  const address = `0x${value.slice(24)}`;
  assertHexAddress(address);
  return address;
}

function splitWords(data: string) {
  const raw = strip0x(data);
  return raw.match(/.{1,64}/g) ?? [];
}

function formatUnits(value: string, decimals = 6) {
  const amount = BigInt(value);
  const base = BigInt(10) ** BigInt(decimals);
  const whole = amount / base;
  const fraction = (amount % base).toString().padStart(decimals, "0");
  return `${whole}.${fraction}`.replace(/\.?0+$/, "");
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let lastError: RpcResponse<T>["error"];

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 900 + attempt * 900));
    const response = await fetch(ARC_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method,
        params,
      }),
    });
    const payload = (await response.json()) as RpcResponse<T>;
    if (!payload.error) {
      if (typeof payload.result === "undefined") {
        throw new CircleSpikeError({
          message: `Arc RPC returned no result for ${method}.`,
          endpoint: `${ARC_RPC_URL}:${method}`,
        });
      }
      return payload.result;
    }

    lastError = payload.error;
    if (!/limit|rate/i.test(payload.error.message)) break;
  }

  throw new CircleSpikeError({
    message: lastError?.message ?? `Arc RPC request failed for ${method}.`,
    endpoint: `${ARC_RPC_URL}:${method}`,
    code: lastError?.code,
  });
}

async function ethCall(to: string, data: string, from?: string) {
  return rpc<string>("eth_call", [{ to, data, ...(from ? { from } : {}) }, "latest"]);
}

async function readUint(to: string, selector: string) {
  const data = await ethCall(to, selector);
  return BigInt(data).toString();
}

async function readUsdcBalance(address: string) {
  return BigInt(
    await ethCall(
      ARC_TESTNET_USDC_CONTRACT,
      `${SELECTORS.balanceOf}${addressWord(address)}`,
    ),
  ).toString();
}

async function readAllowance(owner: string) {
  return BigInt(
    await ethCall(
      ARC_TESTNET_USDC_CONTRACT,
      `${SELECTORS.allowance}${addressWord(owner)}${addressWord(
        ESCROW_CONTRACT_ADDRESS,
      )}`,
    ),
  ).toString();
}

async function readChallenge(challengeId: string) {
  assertHex32(challengeId);
  const words = splitWords(
    await ethCall(
      ESCROW_CONTRACT_ADDRESS,
      `${SELECTORS.getChallenge}${word(challengeId)}`,
    ),
  );
  return {
    sponsor: addressFromWord(words[0] ?? ""),
    prizePool: BigInt(`0x${words[1] ?? "0"}`).toString(),
    platformFee: BigInt(`0x${words[2] ?? "0"}`).toString(),
    submissionDeadline: Number(BigInt(`0x${words[3] ?? "0"}`)),
    reviewDeadline: Number(BigInt(`0x${words[4] ?? "0"}`)),
    winnerCount: Number(BigInt(`0x${words[5] ?? "0"}`)),
    status: Number(BigInt(`0x${words[6] ?? "0"}`)),
  };
}

async function readPrizeDistribution(challengeId: string) {
  assertHex32(challengeId);
  const words = splitWords(
    await ethCall(
      ESCROW_CONTRACT_ADDRESS,
      `${SELECTORS.getPrizeDistribution}${word(challengeId)}`,
    ),
  );
  const length = Number(BigInt(`0x${words[1] ?? "0"}`));
  return words.slice(2, 2 + length).map((item) => BigInt(`0x${item}`).toString());
}

function fundChallengeCalldata(input: {
  challengeId: string;
  prizeAmount: string;
  platformFee: string;
  submissionDeadline: number;
  reviewDeadline: number;
}) {
  return [
    SELECTORS.fundChallenge,
    word(input.challengeId),
    word(160),
    word(BigInt(input.platformFee)),
    word(input.submissionDeadline),
    word(input.reviewDeadline),
    word(1),
    word(BigInt(input.prizeAmount)),
  ].join("");
}

async function getBrandWallet(userToken: string) {
  const intent = await getEscrowFundingIntent();
  const wallet = await listWallets({
    ccnAccountId: intent.ccnAccountId,
    authProvider: intent.authProvider,
    userToken,
  });

  if (!wallet) {
    throw new CircleSpikeError({
      message: "Existing Brand ARC-TESTNET SCA wallet mapping was not found.",
    });
  }

  assertHexAddress(wallet.walletAddress);
  return wallet;
}

async function readEscrowCore(challengeId: string) {
  assertHex32(challengeId);
  const chainIdHex = await rpc<string>("eth_chainId", []);
  const bytecode = await rpc<string>("eth_getCode", [
    ESCROW_CONTRACT_ADDRESS,
    "latest",
  ]);
  const usdcRaw = await ethCall(ESCROW_CONTRACT_ADDRESS, SELECTORS.usdc);
  const pausedRaw = await ethCall(ESCROW_CONTRACT_ADDRESS, SELECTORS.paused);
  const fundedRaw = await ethCall(
    ESCROW_CONTRACT_ADDRESS,
    `${SELECTORS.isFunded}${word(challengeId)}`,
  );
  const prize = await readUint(
    ESCROW_CONTRACT_ADDRESS,
    SELECTORS.totalLockedPrizePools,
  );
  const fee = await readUint(
    ESCROW_CONTRACT_ADDRESS,
    SELECTORS.totalLockedPlatformFees,
  );
  const total = await readUint(
    ESCROW_CONTRACT_ADDRESS,
    SELECTORS.getTotalLockedLiabilities,
  );

  return {
    chainId: Number(BigInt(chainIdHex)),
    address: ESCROW_CONTRACT_ADDRESS,
    bytecodeExists: bytecode !== "0x",
    usdc: addressFromWord(splitWords(usdcRaw)[0] ?? ""),
    paused: boolFromWord(splitWords(pausedRaw)[0] ?? "0"),
    isFunded: boolFromWord(splitWords(fundedRaw)[0] ?? "0"),
    totalLockedPrizePools: prize,
    totalLockedPlatformFees: fee,
    totalLockedLiabilities: total,
  };
}

export async function getEscrowFundingPreflight(userToken: unknown) {
  assertToken(userToken);
  const intent = await getEscrowFundingIntent();
  const wallet = await getBrandWallet(userToken);
  assertHexAddress(wallet.walletAddress);
  const walletAddress = wallet.walletAddress;
  const balances = await getWalletBalances({
    ccnAccountId: intent.ccnAccountId,
    authProvider: intent.authProvider,
    userToken,
  });

  const nativeBalance = await rpc<string>("eth_getBalance", [
    walletAddress,
    "latest",
  ]);
  const escrow = await readEscrowCore(intent.challengeId);
  const brandUsdc = await readUsdcBalance(walletAddress);
  const escrowUsdc = await readUsdcBalance(ESCROW_CONTRACT_ADDRESS);
  const allowance = await readAllowance(walletAddress);

  const blockers: string[] = [];
  if (escrow.chainId !== ARC_CHAIN_ID) blockers.push("Wrong Arc Testnet chain ID.");
  if (wallet.blockchain !== USER_WALLET_BLOCKCHAIN) blockers.push("Wrong wallet blockchain.");
  if (wallet.accountType !== USER_WALLET_ACCOUNT_TYPE) blockers.push("Wrong wallet account type.");
  if (wallet.creationStatus !== "live") blockers.push("Brand wallet is not LIVE.");
  if (!escrow.bytecodeExists) blockers.push("Escrow bytecode is missing.");
  if (escrow.usdc.toLowerCase() !== ARC_TESTNET_USDC_CONTRACT) {
    blockers.push("Escrow USDC address does not match official Arc Testnet USDC.");
  }
  if (escrow.paused) blockers.push("Escrow contract is paused.");
  if (escrow.isFunded) blockers.push("Challenge is already funded.");
  if (BigInt(brandUsdc) < BigInt(intent.totalRequired)) {
    blockers.push("Brand wallet has insufficient test USDC.");
  }
  const balanceTimestamp = new Date().toISOString();

  if (BigInt(nativeBalance) === BigInt(0)) {
    blockers.push("Brand wallet has no native gas balance.");
  }
  const deadlinePolicy = getCreateChallengeDeadlinePolicy({
    runtimeBlockchain: USER_WALLET_BLOCKCHAIN,
    chainId: ARC_CHAIN_ID,
    isSmokeTestChallenge: false,
  });
  if (intent.reviewDeadline <= intent.submissionDeadline) {
    blockers.push("Review deadline is not after submission deadline.");
  }
  const minimumSubmissionLeadSeconds = deadlinePolicy.minimumSubmissionLeadMinutes * 60;
  const minimumReviewGapSeconds = deadlinePolicy.minimumReviewGapMinutes * 60;
  if (intent.submissionDeadline <= Math.floor(Date.now() / 1000) + minimumSubmissionLeadSeconds) {
    blockers.push(`Submission deadline is not safely more than ${minimumSubmissionLeadSeconds} seconds out.`);
  }
  if (intent.reviewDeadline < intent.submissionDeadline + minimumReviewGapSeconds) {
    blockers.push(`Review deadline is not safely more than ${minimumReviewGapSeconds} seconds after submission close.`);
  }

  const updated = await updateEscrowFundingIntent({
    brandWalletAddress: walletAddress,
    brandWalletId: wallet.walletId,
  });

  return {
    chainId: escrow.chainId,
    wallet: {
      walletId: wallet.walletId,
      walletAddress,
      blockchain: USER_WALLET_BLOCKCHAIN,
      accountType: USER_WALLET_ACCOUNT_TYPE,
      state: wallet.creationStatus === "live" ? "LIVE" : wallet.creationStatus,
    },
    challengeId: updated.challengeId,
    fundingIntentId: updated.fundingIntentId,
    status: updated.status,
    amounts: {
      prizeAmount: updated.prizeAmount,
      platformFee: updated.platformFee,
      totalRequired: updated.totalRequired,
    },
    deadlines: {
      submissionDeadline: updated.submissionDeadline,
      reviewDeadline: updated.reviewDeadline,
    },
    balances: {
      brandUsdc,
      brandNativeWei: BigInt(nativeBalance).toString(),
      escrowUsdc,
    },
    balanceSource: {
      address: walletAddress,
      source: "Arc RPC eth_call balanceOf(address)",
      timestamp: balanceTimestamp,
      network: USER_WALLET_BLOCKCHAIN,
      chainId: escrow.chainId,
    },
    escrow,
    allowance,
    ready: blockers.length === 0,
    blockers,
    display: {
      brandUsdc: formatUnits(brandUsdc),
      escrowUsdc: formatUnits(escrowUsdc),
      allowance: formatUnits(allowance),
      verifiedCircleBalance: balances.testUsdcBalance?.amount ?? "0",
    },
  } satisfies EscrowPreflightSnapshot & {
    display: Record<string, string>;
  };
}

export async function createApprovalChallenge(userToken: unknown) {
  assertToken(userToken);
  const preflight = await getEscrowFundingPreflight(userToken);
  const intent = await getEscrowFundingIntent();

  if (!preflight.ready) {
    throw new CircleSpikeError({ message: preflight.blockers.join(" ") });
  }

  if (BigInt(preflight.allowance) >= BigInt(intent.totalRequired)) {
    await updateEscrowFundingIntent({ status: "APPROVED" });
    return { alreadyApproved: true };
  }

  const data = await circleFetch<CircleContractExecutionResponse>({
    endpoint: "/v1/w3s/user/transactions/contractExecution",
    method: "POST",
    userToken,
    body: {
      walletId: preflight.wallet.walletId,
      contractAddress: ARC_TESTNET_USDC_CONTRACT,
      idempotencyKey: intent.approvalIdempotencyKey,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [ESCROW_CONTRACT_ADDRESS, intent.totalRequired],
      feeLevel: "MEDIUM",
      refId: `ccn-approve-${intent.challengeLogicalId}`,
    },
  });

  const updated = await updateEscrowFundingIntent({
    approvalChallengeId: data.challengeId,
    status: "APPROVAL_PENDING",
  });

  return {
    alreadyApproved: false,
    challengeId: updated.approvalChallengeId,
  };
}

function collectCorrelationIds(value: unknown, ids = new Set<string>()) {
  if (!value || typeof value !== "object") return ids;
  if (Array.isArray(value)) {
    value.forEach((item) => collectCorrelationIds(item, ids));
    return ids;
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    if (
      key === "correlationIds" &&
      Array.isArray(item) &&
      item.every((entry) => typeof entry === "string")
    ) {
      item.forEach((entry) => ids.add(entry));
      return;
    }

    if (
      typeof item === "string" &&
      /correlation|transaction|id/i.test(key) &&
      /^[0-9a-f-]{20,}$/i.test(item)
    ) {
      ids.add(item);
    } else {
      collectCorrelationIds(item, ids);
    }
  });
  return ids;
}

async function getChallengeTransactionId(challengeId: string, userToken: string) {
  const data = await circleFetch<CircleChallengeResponse>({
    endpoint: `/v1/w3s/user/challenges/${challengeId}`,
    method: "GET",
    userToken,
  });
  return Array.from(collectCorrelationIds(data.challenge)).at(0);
}

async function getTransaction(transactionId: string, userToken: string) {
  const data = await circleFetch<CircleTransactionResponse>({
    endpoint: `/v1/w3s/transactions/${transactionId}`,
    method: "GET",
    userToken,
  });
  return data.transaction ?? null;
}

function transactionHash(transaction: CircleTransaction | null) {
  return transaction?.txHash ?? transaction?.transactionHash;
}

function transactionState(transaction: CircleTransaction | null) {
  return transaction?.state ?? transaction?.status;
}

export async function reconcileEscrowTransaction(input: {
  userToken: unknown;
  stage: EscrowTransactionStage;
}) {
  assertToken(input.userToken);
  const intent = await getEscrowFundingIntent();
  const challengeId =
    input.stage === "approval"
      ? intent.approvalChallengeId
      : intent.fundingChallengeId;
  if (!challengeId) {
    throw new CircleSpikeError({ message: "No Circle challenge exists for this stage." });
  }

  const transactionId =
    input.stage === "approval"
      ? intent.approvalTransactionId ??
        (await getChallengeTransactionId(challengeId, input.userToken))
      : intent.fundingTransactionId ??
        (await getChallengeTransactionId(challengeId, input.userToken));
  if (!transactionId) {
    return { stage: input.stage, challengeId } satisfies EscrowTransactionSnapshot;
  }

  const transaction = await getTransaction(transactionId, input.userToken);
  const hash = transactionHash(transaction);
  const state = transactionState(transaction);
  if (input.stage === "approval") {
    await updateEscrowFundingIntent({
      approvalTransactionId: transactionId,
      approvalTransactionHash: hash,
      status: hash ? "APPROVED" : "APPROVAL_PENDING",
    });
  } else {
    await updateEscrowFundingIntent({
      fundingTransactionId: transactionId,
      fundingTransactionHash: hash,
      status: hash ? "FUNDED" : "FUNDING_PENDING",
    });
  }

  return {
    stage: input.stage,
    challengeId,
    transactionId,
    transactionHash: hash,
    state,
  } satisfies EscrowTransactionSnapshot;
}

export async function createFundingChallenge(userToken: unknown) {
  assertToken(userToken);
  const intent = await getEscrowFundingIntent();
  const preflight = await getEscrowFundingPreflight(userToken);
  if (!preflight.ready && !preflight.escrow.isFunded) {
    throw new CircleSpikeError({ message: preflight.blockers.join(" ") });
  }
  if (BigInt(preflight.allowance) < BigInt(intent.totalRequired)) {
    throw new CircleSpikeError({ message: "Allowance is not sufficient for funding." });
  }
  if (preflight.escrow.isFunded) {
    throw new CircleSpikeError({ message: "Challenge is already funded." });
  }

  const data = await circleFetch<CircleContractExecutionResponse>({
    endpoint: "/v1/w3s/user/transactions/contractExecution",
    method: "POST",
    userToken,
    body: {
      walletId: preflight.wallet.walletId,
      contractAddress: ESCROW_CONTRACT_ADDRESS,
      idempotencyKey: intent.fundingIdempotencyKey,
      abiFunctionSignature: "fundChallenge(bytes32,uint256[],uint256,uint64,uint64)",
      abiParameters: [
        intent.challengeId,
        [intent.prizeAmount],
        intent.platformFee,
        String(intent.submissionDeadline),
        String(intent.reviewDeadline),
      ],
      feeLevel: "MEDIUM",
      refId: `ccn-fund-${intent.challengeLogicalId}`,
    },
  });

  const updated = await updateEscrowFundingIntent({
    fundingChallengeId: data.challengeId,
    status: "FUNDING_PENDING",
  });

  return { challengeId: updated.fundingChallengeId };
}

async function getReceipt(hash: string) {
  return rpc<{
    blockNumber?: string;
    logs?: Array<{
      address: string;
      topics: string[];
      data: string;
    }>;
    status?: string;
  }>("eth_getTransactionReceipt", [hash]);
}

function verifyChallengeFundedEvent(input: {
  receipt: Awaited<ReturnType<typeof getReceipt>>;
  intent: Awaited<ReturnType<typeof getEscrowFundingIntent>>;
  sponsor: string;
}) {
  return Boolean(
    input.receipt.logs?.some((log) => {
      const sponsorTopic = `0x${addressWord(input.sponsor)}`;
      return (
        log.address.toLowerCase() === ESCROW_CONTRACT_ADDRESS.toLowerCase() &&
        log.topics[0]?.toLowerCase() === CHALLENGE_FUNDED_TOPIC.toLowerCase() &&
        log.topics[1]?.toLowerCase() === input.intent.challengeId.toLowerCase() &&
        log.topics[2]?.toLowerCase() === sponsorTopic.toLowerCase()
      );
    }),
  );
}

export async function verifyEscrowFunding(userToken: unknown) {
  assertToken(userToken);
  const intent = await getEscrowFundingIntent();
  const wallet = await getBrandWallet(userToken);
  const isFundedRaw = await ethCall(
    ESCROW_CONTRACT_ADDRESS,
    `${SELECTORS.isFunded}${word(intent.challengeId)}`,
  );
  const challenge = await readChallenge(intent.challengeId);
  const distribution = await readPrizeDistribution(intent.challengeId);
  const brandUsdc = await readUsdcBalance(wallet.walletAddress);
  const escrowUsdc = await readUsdcBalance(ESCROW_CONTRACT_ADDRESS);
  const allowance = await readAllowance(wallet.walletAddress);
  const totals = await readEscrowCore(intent.challengeId);

  const duplicateSimulation = await ethCall(
    ESCROW_CONTRACT_ADDRESS,
    fundChallengeCalldata({
      challengeId: intent.challengeId,
      prizeAmount: intent.prizeAmount,
      platformFee: intent.platformFee,
      submissionDeadline: intent.submissionDeadline,
      reviewDeadline: intent.reviewDeadline,
    }),
    wallet.walletAddress,
  )
    .then(() => ({ rejected: false, reason: "Duplicate call did not revert." }))
    .catch((error) => ({
      rejected: true,
      reason:
        error instanceof CircleSpikeError
          ? error.safe.message
          : "Duplicate call reverted.",
    }));

  let eventVerified = false;
  let fundingBlockNumber = intent.fundingBlockNumber;
  if (intent.fundingTransactionHash) {
    const receipt = await getReceipt(intent.fundingTransactionHash);
    eventVerified = verifyChallengeFundedEvent({
      receipt,
      intent,
      sponsor: wallet.walletAddress,
    });
    fundingBlockNumber = receipt.blockNumber
      ? BigInt(receipt.blockNumber).toString()
      : fundingBlockNumber;
  }

  const isLive =
    boolFromWord(splitWords(isFundedRaw)[0] ?? "0") &&
    challenge.sponsor.toLowerCase() === wallet.walletAddress.toLowerCase() &&
    challenge.prizePool === intent.prizeAmount &&
    challenge.platformFee === intent.platformFee &&
    challenge.winnerCount === 1 &&
    challenge.status === 1 &&
    distribution.length === 1 &&
    distribution[0] === intent.prizeAmount &&
    totals.totalLockedPrizePools === intent.prizeAmount &&
    totals.totalLockedPlatformFees === intent.platformFee &&
    totals.totalLockedLiabilities === intent.totalRequired &&
    eventVerified;

  await updateEscrowFundingIntent({
    status: isLive ? "LIVE" : "FUNDED",
    fundingBlockNumber,
  });

  return {
    walletBalance: brandUsdc,
    approvalTx: intent.approvalTransactionHash ?? null,
    fundingTx: intent.fundingTransactionHash ?? null,
    receipt: intent.fundingTransactionHash
      ? { blockNumber: fundingBlockNumber ? `0x${BigInt(fundingBlockNumber).toString(16)}` : undefined }
      : null,
    challengeFundedEvent: intent.fundingTransactionHash && fundingBlockNumber
      ? {
          transactionHash: intent.fundingTransactionHash,
          blockNumber: `0x${BigInt(fundingBlockNumber).toString(16)}`,
          logIndex: "0x0",
        }
      : null,
    blockNumber: fundingBlockNumber ? `0x${BigInt(fundingBlockNumber).toString(16)}` : null,
    challengeVerified: isLive,
    isFunded: boolFromWord(splitWords(isFundedRaw)[0] ?? "0"),
    challenge,
    distribution,
    balances: {
      brandUsdc,
      escrowUsdc,
    },
    allowance,
    totals: {
      totalLockedPrizePools: totals.totalLockedPrizePools,
      totalLockedPlatformFees: totals.totalLockedPlatformFees,
      totalLockedLiabilities: totals.totalLockedLiabilities,
    },
    eventVerified,
    duplicateSimulation,
  } satisfies EscrowFundingVerification;
}

export async function getEscrowFundingLinks() {
  const intent = await getEscrowFundingIntent();
  return {
    contract: `${ARC_EXPLORER_URL}/address/${ESCROW_CONTRACT_ADDRESS}`,
    approval: intent.approvalTransactionHash
      ? `${ARC_EXPLORER_URL}/tx/${intent.approvalTransactionHash}`
      : null,
    funding: intent.fundingTransactionHash
      ? `${ARC_EXPLORER_URL}/tx/${intent.fundingTransactionHash}`
      : null,
  };
}

export async function verifyFundedChallengeForSubmission() {
  const intent = await getEscrowFundingIntent();
  if (!intent.brandWalletAddress) {
    throw new CircleSpikeError({
      message: "Brand wallet address is missing from the verified funding intent.",
    });
  }

  const [escrow, challenge, distribution] = await Promise.all([
    readEscrowCore(intent.challengeId),
    readChallenge(intent.challengeId),
    readPrizeDistribution(intent.challengeId),
  ]);
  const now = Math.floor(Date.now() / 1000);
  const blockers: string[] = [];

  if (!escrow.bytecodeExists) blockers.push("Escrow bytecode is missing.");
  if (!escrow.isFunded) blockers.push("Challenge is not funded.");
  if (escrow.paused) blockers.push("Escrow contract is paused.");
  if (challenge.sponsor.toLowerCase() !== intent.brandWalletAddress.toLowerCase()) {
    blockers.push("Challenge sponsor does not match the verified Brand wallet.");
  }
  if (challenge.prizePool !== intent.prizeAmount) blockers.push("Prize pool mismatch.");
  if (challenge.platformFee !== intent.platformFee) blockers.push("Platform fee mismatch.");
  if (challenge.winnerCount !== 1) blockers.push("Winner count mismatch.");
  if (distribution.length !== 1 || distribution[0] !== intent.prizeAmount) {
    blockers.push("Prize distribution mismatch.");
  }
  if (now >= challenge.submissionDeadline) {
    blockers.push("Submission deadline has passed.");
  }

  return {
    challengeId: intent.challengeId,
    bytecodeExists: escrow.bytecodeExists,
    isFunded: escrow.isFunded,
    sponsorMatchesBrand:
      challenge.sponsor.toLowerCase() === intent.brandWalletAddress.toLowerCase(),
    prizePool: challenge.prizePool,
    platformFee: challenge.platformFee,
    winnerCount: challenge.winnerCount,
    prizeDistribution: distribution,
    submissionDeadline: challenge.submissionDeadline,
    reviewDeadline: challenge.reviewDeadline,
    acceptsSubmissions: now < challenge.submissionDeadline,
    paused: escrow.paused,
    verified: blockers.length === 0,
    blockers,
  } satisfies FundedChallengeRead;
}
