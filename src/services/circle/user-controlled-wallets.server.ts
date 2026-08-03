import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type {
  ScopedWalletMapping,
  SpikeBalanceSnapshot,
  SafeCircleError,
  SpikeAppSession,
  SpikeTokenBalance,
  SpikeWalletRecord,
  WalletPurpose,
  WalletRole,
} from "@/types/wallet-spike";
import {
  getScopedStoredWallet,
  getStoredWallet,
  migrateLegacyStoredWallet,
  upsertScopedStoredWallet,
  upsertStoredWallet,
} from "./wallet-spike-store.server";

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
    this.name = "CircleSpikeError";
    Object.setPrototypeOf(this, CircleSpikeError.prototype);
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

function assertWalletRole(value: unknown): asserts value is WalletRole {
  if (value !== "BRAND" && value !== "CREATOR") {
    throw new CircleSpikeError({ message: "Unsupported wallet role." });
  }
}

function assertWalletPurpose(value: unknown): asserts value is WalletPurpose {
  if (value !== "PAYMENT" && value !== "PAYOUT") {
    throw new CircleSpikeError({ message: "Unsupported wallet purpose." });
  }
}

function toSpikeWalletRecord(input: {
  internalUserId: string;
  ccnAccountId: string;
  authProvider: "google" | "apple" | "email";
  wallet: WalletResponse;
}) {
  const now = new Date().toISOString();
  return {
    internalUserId: input.internalUserId,
    circleUserId: input.wallet.userId ?? input.ccnAccountId,
    ccnAccountId: input.ccnAccountId,
    authProvider: input.authProvider,
    walletId: input.wallet.id,
    walletAddress: input.wallet.address,
    blockchain: USER_WALLET_BLOCKCHAIN,
    accountType: USER_WALLET_ACCOUNT_TYPE,
    creationStatus: input.wallet.state === "LIVE" ? "live" : "challenge-created",
    createDate: input.wallet.createDate ?? now,
    updateDate: input.wallet.updateDate ?? now,
  } satisfies SpikeWalletRecord;
}

function scopedMappingFromWallet(input: {
  ccnAccountId: string;
  role: WalletRole;
  purpose: WalletPurpose;
  wallet: WalletResponse;
}) {
  const now = new Date().toISOString();
  return {
    ccnAccountId: input.ccnAccountId,
    role: input.role,
    purpose: input.purpose,
    circleUserId: input.wallet.userId ?? input.ccnAccountId,
    walletId: input.wallet.id,
    walletAddress: input.wallet.address,
    blockchain: USER_WALLET_BLOCKCHAIN,
    accountType: USER_WALLET_ACCOUNT_TYPE,
    walletState: input.wallet.state === "LIVE" ? "live" : "challenge-created",
    createdAt: input.wallet.createDate ?? now,
    updatedAt: input.wallet.updateDate ?? now,
  } satisfies ScopedWalletMapping;
}

async function fetchCircleWallets(userToken: string) {
  const data = await circleFetch<WalletListResponse>({
    endpoint: "/v1/w3s/wallets",
    method: "GET",
    userToken,
  });
  return data.wallets ?? [];
}

function usableArcScaWallets(wallets: WalletResponse[]) {
  return wallets.filter(
    (item) =>
      item.id &&
      item.address &&
      item.blockchain === USER_WALLET_BLOCKCHAIN &&
      item.accountType === USER_WALLET_ACCOUNT_TYPE &&
      item.state === "LIVE",
  );
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

export async function getScopedWallet(input: {
  ccnAccountId: unknown;
  authProvider: unknown;
  userToken: unknown;
  role: unknown;
  purpose: unknown;
  expectedWalletAddress?: string;
}) {
  assertAppAccountId(input.ccnAccountId);
  assertAuthProvider(input.authProvider);
  assertToken(input.userToken, "userToken");
  assertWalletRole(input.role);
  assertWalletPurpose(input.purpose);

  const scoped = await getScopedStoredWallet({
    ccnAccountId: input.ccnAccountId,
    role: input.role,
    purpose: input.purpose,
  });
  if (scoped) {
    if (input.expectedWalletAddress && scoped.walletAddress.toLowerCase() !== input.expectedWalletAddress.toLowerCase()) {
      throw new CircleSpikeError({ message: "Scoped wallet mapping does not match the expected product wallet." });
    }
    if (scoped.blockchain !== USER_WALLET_BLOCKCHAIN || scoped.accountType !== USER_WALLET_ACCOUNT_TYPE) {
      throw new CircleSpikeError({ message: "Scoped wallet mapping is not an Arc Testnet SCA wallet." });
    }
    if (scoped.walletState !== "live") {
      throw new CircleSpikeError({ message: "Scoped wallet mapping is not live." });
    }
    return scoped;
  }

  const internalUserId = stableInternalUserId(input.ccnAccountId);
  const wallets = usableArcScaWallets(await fetchCircleWallets(input.userToken));
  const verifiedWallet = input.expectedWalletAddress
    ? wallets.find((wallet) => wallet.address.toLowerCase() === input.expectedWalletAddress?.toLowerCase())
    : wallets.length === 1
      ? wallets[0]
      : null;

  if (!verifiedWallet) {
    const legacy = await getStoredWallet(internalUserId);
    if (legacy) {
      await migrateLegacyStoredWallet({
        legacyInternalUserId: internalUserId,
        ccnAccountId: input.ccnAccountId,
        role: input.role,
        purpose: input.purpose,
        expectedWalletAddress: input.expectedWalletAddress,
        verifiedWallet: {
          circleUserId: legacy.circleUserId,
          walletId: legacy.walletId,
          walletAddress: legacy.walletAddress,
          blockchain: USER_WALLET_BLOCKCHAIN,
          accountType: USER_WALLET_ACCOUNT_TYPE,
          walletState: legacy.creationStatus,
          createdAt: legacy.createDate,
          updatedAt: legacy.updateDate,
        },
      });
    }
    throw new CircleSpikeError({ message: "AMBIGUOUS_LEGACY_WALLET_MAPPING" });
  }

  const migration = await migrateLegacyStoredWallet({
    legacyInternalUserId: internalUserId,
    ccnAccountId: input.ccnAccountId,
    role: input.role,
    purpose: input.purpose,
    expectedWalletAddress: input.expectedWalletAddress,
    verifiedWallet: {
      circleUserId: verifiedWallet.userId ?? input.ccnAccountId,
      walletId: verifiedWallet.id,
      walletAddress: verifiedWallet.address,
      blockchain: USER_WALLET_BLOCKCHAIN,
      accountType: USER_WALLET_ACCOUNT_TYPE,
      walletState: verifiedWallet.state === "LIVE" ? "live" : "challenge-created",
      createdAt: verifiedWallet.createDate,
      updatedAt: verifiedWallet.updateDate,
    },
  });

  if (migration.mapping) return migration.mapping;

  return upsertScopedStoredWallet(scopedMappingFromWallet({
    ccnAccountId: input.ccnAccountId,
    role: input.role,
    purpose: input.purpose,
    wallet: verifiedWallet,
  }));
}

export async function initializeScopedUserWallet(input: {
  ccnAccountId: unknown;
  authProvider: unknown;
  userToken: unknown;
  role: unknown;
  purpose: unknown;
}) {
  assertAppAccountId(input.ccnAccountId);
  assertAuthProvider(input.authProvider);
  assertToken(input.userToken, "userToken");
  assertWalletRole(input.role);
  assertWalletPurpose(input.purpose);

  const existing = await getScopedStoredWallet({
    ccnAccountId: input.ccnAccountId,
    role: input.role,
    purpose: input.purpose,
  });
  if (existing?.walletId) {
    return { alreadyMapped: true, wallet: existing };
  }

  const internalUserId = stableInternalUserId(input.ccnAccountId);
  const data = await circleFetch<InitializeResponse>({
    endpoint: "/v1/w3s/user/initialize",
    method: "POST",
    userToken: input.userToken,
    body: {
      idempotencyKey: stableIdempotencyKey("initialize", [input.ccnAccountId, input.role, input.purpose].join(":")),
      blockchains: [USER_WALLET_BLOCKCHAIN],
      accountType: USER_WALLET_ACCOUNT_TYPE,
      metadata: [
        {
          name: "CCN " + input.role + " " + input.purpose + " Wallet",
          refId: [input.ccnAccountId, input.role, input.purpose].join(":"),
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

  const record = toSpikeWalletRecord({
    internalUserId,
    ccnAccountId: input.ccnAccountId,
    authProvider: input.authProvider,
    wallet,
  });

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
