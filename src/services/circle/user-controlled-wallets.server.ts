import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type {
  SpikeBalanceSnapshot,
  SafeCircleError,
  SpikeAppSession,
  SpikeTokenBalance,
  SpikeWalletRecord,
} from "@/types/wallet-spike";
import { getStoredWallet, upsertStoredWallet } from "./wallet-spike-store.server";

export const CIRCLE_BASE_URL = "https://api.circle.com";
const REQUEST_TIMEOUT_MS = 20_000;
export const USER_WALLET_BLOCKCHAIN = "ARC-TESTNET";
export const USER_WALLET_ACCOUNT_TYPE = "SCA";
export const ARC_TESTNET_USDC_CONTRACT =
  "0x3600000000000000000000000000000000000000";
const CIRCLE_FAUCET_URL = "https://faucet-v2.circle.com/";
const ARC_EXPLORER_URL = "https://testnet.arcscan.app";

type CircleData<T> = {
  data?: T;
  code?: string | number;
  message?: string;
};

type CircleUserResponse = {
  id: string;
};

type UserTokenResponse = {
  userToken: string;
  encryptionKey: string;
};

type InitializeResponse = {
  challengeId?: string;
};

type WalletResponse = {
  id: string;
  address: string;
  blockchain: string;
  accountType?: string;
  state?: string;
  createDate?: string;
  updateDate?: string;
  userId?: string;
};

type WalletListResponse = {
  wallets?: WalletResponse[];
};

type WalletBalanceResponse = {
  tokenBalances?: Array<{
    amount: string;
    token: {
      blockchain: string;
      decimals: number;
      isNative: boolean;
      name: string;
      symbol: string;
      tokenAddress?: string;
    };
    updateDate?: string;
  }>;
};

export class CircleSpikeError extends Error {
  safe: SafeCircleError;

  constructor(safe: SafeCircleError) {
    super(safe.message);
    this.safe = safe;
  }
}

function apiKey() {
  const key = process.env.CIRCLE_API_KEY;
  if (!key) {
    throw new CircleSpikeError({
      message: "CIRCLE_API_KEY is not configured.",
    });
  }
  return key;
}

function redactMessage(message: unknown) {
  const value = typeof message === "string" ? message : "Circle request failed.";
  return value
    .replace(/Bearer\s+[A-Za-z0-9:._-]+/gi, "Bearer [redacted]")
    .replace(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt-redacted]");
}

function assertAppAccountId(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9._:-]{5,50}$/.test(value)
  ) {
    throw new CircleSpikeError({
      message:
        "Authenticated CCN account ID must be 5-50 URL-safe characters.",
    });
  }
}

function assertAuthProvider(
  value: unknown,
): asserts value is "google" | "apple" | "email" {
  if (value !== "google" && value !== "apple" && value !== "email") {
    throw new CircleSpikeError({ message: "Unsupported CCN auth provider." });
  }
}

function assertToken(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length < 10 || value.length > 4096) {
    throw new CircleSpikeError({ message: `${label} is missing or invalid.` });
  }
}

function stableInternalUserId(ccnAccountId: string) {
  const digest = createHash("sha256")
    .update(`ccn-wallet-spike:${ccnAccountId.toLowerCase()}`)
    .digest("hex")
    .slice(0, 24);
  return `ccn-spike-${digest}`;
}

function stableIdempotencyKey(scope: string, seed: string) {
  const digest = createHash("sha256")
    .update(`ccn:${scope}:${seed}`)
    .digest("hex");
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `8${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join("-");
}

export async function circleFetch<T>({
  endpoint,
  method,
  body,
  userToken,
}: {
  endpoint: string;
  method: "GET" | "POST";
  body?: unknown;
  userToken?: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${CIRCLE_BASE_URL}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        "X-Request-Id": randomUUID(),
        ...(userToken ? { "X-User-Token": userToken } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as CircleData<T>;

    if (!response.ok) {
      throw new CircleSpikeError({
        message: redactMessage(payload.message),
        status: response.status,
        code: payload.code,
        endpoint,
      });
    }

    return payload.data as T;
  } catch (error) {
    if (error instanceof CircleSpikeError) {
      throw error;
    }
    throw new CircleSpikeError({
      message:
        error instanceof DOMException && error.name === "AbortError"
          ? "Circle request timed out."
          : redactMessage(error instanceof Error ? error.message : error),
      endpoint,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function createOrFetchCircleUser(input: {
  ccnAccountId: unknown;
  authProvider: unknown;
}): Promise<SpikeAppSession> {
  assertAppAccountId(input.ccnAccountId);
  assertAuthProvider(input.authProvider);
  const internalUserId = stableInternalUserId(input.ccnAccountId);

  let circleUserId = input.ccnAccountId;
  try {
    const user = await circleFetch<CircleUserResponse>({
      endpoint: "/v1/w3s/users",
      method: "POST",
      body: {
        userId: input.ccnAccountId,
      },
    });
    circleUserId = user.id || input.ccnAccountId;
  } catch (error) {
    if (
      error instanceof CircleSpikeError &&
      String(error.safe.code) !== "155101"
    ) {
      throw error;
    }
  }

  const token = await circleFetch<UserTokenResponse>({
    endpoint: "/v1/w3s/users/token",
    method: "POST",
    body: {
      userId: input.ccnAccountId,
    },
  });

  return {
    internalUserId,
    ccnAccountId: input.ccnAccountId,
    authProvider: input.authProvider,
    circleUserId,
    userToken: token.userToken,
    encryptionKey: token.encryptionKey,
  };
}

export async function initializeUserWallet(input: {
  ccnAccountId: unknown;
  authProvider: unknown;
  userToken: unknown;
}) {
  assertAppAccountId(input.ccnAccountId);
  assertAuthProvider(input.authProvider);
  assertToken(input.userToken, "userToken");

  const internalUserId = stableInternalUserId(input.ccnAccountId);
  const existing = await getStoredWallet(internalUserId);
  if (existing?.walletId) {
    return { alreadyMapped: true, internalUserId, wallet: existing };
  }

  const data = await circleFetch<InitializeResponse>({
    endpoint: "/v1/w3s/user/initialize",
    method: "POST",
    userToken: input.userToken,
    body: {
      idempotencyKey: stableIdempotencyKey("initialize", internalUserId),
      blockchains: [USER_WALLET_BLOCKCHAIN],
      accountType: USER_WALLET_ACCOUNT_TYPE,
      metadata: [
        {
          name: "CCN Internal Spike Wallet",
          refId: input.ccnAccountId,
        },
      ],
    },
  });

  return {
    alreadyMapped: false,
    internalUserId,
    challengeId: data.challengeId ?? "",
  };
}

export async function listWallets(input: {
  ccnAccountId: unknown;
  authProvider: unknown;
  userToken: unknown;
}) {
  assertAppAccountId(input.ccnAccountId);
  assertAuthProvider(input.authProvider);
  assertToken(input.userToken, "userToken");
  const internalUserId = stableInternalUserId(input.ccnAccountId);
  const existing = await getStoredWallet(internalUserId);
  if (existing?.walletId) {
    return existing;
  }

  const data = await circleFetch<WalletListResponse>({
    endpoint: "/v1/w3s/wallets",
    method: "GET",
    userToken: input.userToken,
  });
  const wallet = (data.wallets ?? []).find(
    (item) =>
      item.blockchain === USER_WALLET_BLOCKCHAIN &&
      item.accountType === USER_WALLET_ACCOUNT_TYPE,
  );

  if (!wallet?.id || !wallet.address) {
    return null;
  }

  if (
    wallet.blockchain !== USER_WALLET_BLOCKCHAIN ||
    wallet.accountType !== USER_WALLET_ACCOUNT_TYPE
  ) {
    throw new CircleSpikeError({
      message: "Circle returned a wallet on the wrong blockchain or account type.",
    });
  }

  const now = new Date().toISOString();
  const record: SpikeWalletRecord = {
    internalUserId,
    circleUserId: wallet.userId ?? input.ccnAccountId,
    ccnAccountId: input.ccnAccountId,
    authProvider: input.authProvider,
    walletId: wallet.id,
    walletAddress: wallet.address,
    blockchain: USER_WALLET_BLOCKCHAIN,
    accountType: USER_WALLET_ACCOUNT_TYPE,
    creationStatus: wallet.state === "LIVE" ? "live" : "challenge-created",
    createDate: wallet.createDate ?? now,
    updateDate: wallet.updateDate ?? now,
  };

  return upsertStoredWallet(record);
}

export async function getWalletBalances(input: {
  ccnAccountId: unknown;
  authProvider: unknown;
  userToken: unknown;
}): Promise<SpikeBalanceSnapshot> {
  assertAppAccountId(input.ccnAccountId);
  assertAuthProvider(input.authProvider);
  assertToken(input.userToken, "userToken");

  const wallet = await listWallets(input);
  if (!wallet?.walletId) {
    throw new CircleSpikeError({
      message: "No mapped ARC-TESTNET SCA wallet is available for balances.",
    });
  }

  const data = await circleFetch<WalletBalanceResponse>({
    endpoint: `/v1/w3s/wallets/${wallet.walletId}/balances`,
    method: "GET",
    userToken: input.userToken,
  });

  const balances: SpikeTokenBalance[] = (data.tokenBalances ?? [])
    .filter((balance) => balance.token.blockchain === USER_WALLET_BLOCKCHAIN)
    .map((balance) => {
      const tokenAddress = balance.token.tokenAddress ?? "";
      return {
        amount: balance.amount,
        blockchain: USER_WALLET_BLOCKCHAIN,
        decimals: balance.token.decimals,
        isNative: balance.token.isNative,
        name: balance.token.name,
        symbol: balance.token.symbol,
        tokenAddress,
        tokenContractVerified:
          tokenAddress.toLowerCase() === ARC_TESTNET_USDC_CONTRACT,
        updateDate: balance.updateDate ?? "",
      };
    });

  const testUsdcBalance =
    balances.find((balance) => balance.tokenContractVerified) ?? null;

  return {
    officialUsdcContractAddress: ARC_TESTNET_USDC_CONTRACT,
    officialFaucetUrl: CIRCLE_FAUCET_URL,
    explorerUrl: `${ARC_EXPLORER_URL}/address/${wallet.walletAddress}`,
    lastRefreshAt: new Date().toISOString(),
    testUsdcBalance,
    tokenBalances: balances.filter((balance) => balance.tokenContractVerified),
  };
}
