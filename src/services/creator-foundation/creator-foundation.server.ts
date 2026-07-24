import "server-only";

import { createHash } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import {
  CIRCLE_BASE_URL,
  CircleSpikeError,
  USER_WALLET_ACCOUNT_TYPE,
  USER_WALLET_BLOCKCHAIN,
  circleFetch,
} from "@/services/circle/user-controlled-wallets.server";
import { createSupabaseAdminClient } from "@/services/supabase/admin.server";
import type {
  AuditActor,
  CcnAccount,
  CircleUserRow,
  CreatorOnboardingResult,
  CreatorProfile,
  SafeAccountDto,
  SafeWalletDto,
  VerifiedSupabaseUser,
  WalletRow,
  WalletScope,
} from "@/types/creator-foundation";

type CircleUserResponse = { id: string };
type CircleTokenResponse = { userToken: string; encryptionKey: string };
type CircleInitializeResponse = { challengeId?: string };
type CircleWalletResponse = {
  id?: string;
  address?: string;
  blockchain?: string;
  accountType?: string;
  state?: string;
  refId?: string;
  metadata?: Array<{
    name?: string;
    refId?: string;
  }>;
};
type CircleWalletListResponse = { wallets?: CircleWalletResponse[] };

export class CreatorFoundationError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(input: { message: string; status?: number; code: string }) {
    super(input.message);
    this.name = "CreatorFoundationError";
    this.status = input.status ?? 400;
    this.code = input.code;
  }
}

function stableIdempotencyKey(scope: string, seed: string) {
  const digest = createHash("sha256")
    .update(`ccn-creator-foundation:${scope}:${seed}`)
    .digest("hex");
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `8${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join("-");
}

function assertWalletScope(scope: unknown): asserts scope is WalletScope {
  if (scope !== "BRAND_PAYMENT" && scope !== "CREATOR_PAYOUT") {
    throw new CreatorFoundationError({
      message: "Wallet scope is required.",
      status: 400,
      code: "MISSING_OR_INVALID_WALLET_SCOPE",
    });
  }
}

function assertVerifiedAuthUser(user: User | null): asserts user is VerifiedSupabaseUser {
  if (!user?.id || !user.email || !user.email_confirmed_at) {
    throw new CreatorFoundationError({
      message: "A verified Supabase user session is required.",
      status: 401,
      code: "VERIFIED_AUTH_USER_REQUIRED",
    });
  }
}

function safeAccount(account: CcnAccount): SafeAccountDto {
  return {
    accountId: account.account_id,
    isBrand: account.is_brand,
    isCreator: account.is_creator,
    primaryEmail: account.primary_email,
    status: account.status,
  };
}

function safeWallet(wallet: WalletRow): SafeWalletDto {
  return {
    walletAddress: wallet.wallet_address,
    scope: wallet.scope,
    status: wallet.status,
    blockchain: USER_WALLET_BLOCKCHAIN,
  };
}

async function recordAuditEvent(input: {
  accountId?: string | null;
  eventType: string;
  actor: AuditActor;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("auth_audit_events").insert({
    account_id: input.accountId ?? null,
    event_type: input.eventType,
    actor: input.actor,
    metadata: input.metadata ?? {},
  });
}

async function selectAccountBySupabaseUserId(supabaseUserId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("supabase_user_id", supabaseUserId)
    .maybeSingle();
  if (error) throw error;
  return data as CcnAccount | null;
}

export async function resolveOrCreateCcnAccount(authUser: User | null) {
  assertVerifiedAuthUser(authUser);
  const existing = await selectAccountBySupabaseUserId(authUser.id);
  const supabase = createSupabaseAdminClient();

  if (existing) {
    if (existing.primary_email !== authUser.email) {
      const { data, error } = await supabase
        .from("accounts")
        .update({ primary_email: authUser.email })
        .eq("account_id", existing.account_id)
        .select("*")
        .single();
      if (error) throw error;
      return data as CcnAccount;
    }
    await recordAuditEvent({
      accountId: existing.account_id,
      eventType: "LOGIN_RESTORED",
      actor: "USER",
    });
    return existing;
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      supabase_user_id: authUser.id,
      primary_email: authUser.email,
    })
    .select("*")
    .single();

  if (error) {
    const recovered = await selectAccountBySupabaseUserId(authUser.id);
    if (recovered) return recovered;
    throw error;
  }

  const account = data as CcnAccount;
  await recordAuditEvent({
    accountId: account.account_id,
    eventType: "ACCOUNT_CREATED",
    actor: "USER",
  });
  return account;
}

function circleUserIdForAccount(accountId: string) {
  return `ccn-${accountId}`;
}

async function createCircleUser(circleUserId: string) {
  try {
    const user = await circleFetch<CircleUserResponse>({
      endpoint: "/v1/w3s/users",
      method: "POST",
      body: { userId: circleUserId },
    });
    return user.id || circleUserId;
  } catch (error) {
    if (error instanceof CircleSpikeError && String(error.safe.code) === "155101") {
      return circleUserId;
    }
    throw error;
  }
}

async function createCircleUserToken(circleUserId: string) {
  return circleFetch<CircleTokenResponse>({
    endpoint: "/v1/w3s/users/token",
    method: "POST",
    body: { userId: circleUserId },
  });
}

export async function resolveOrCreateCircleUser(accountId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("circle_users")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing as CircleUserRow;

  const circleUserId = circleUserIdForAccount(accountId);
  await recordAuditEvent({
    accountId,
    eventType: "CIRCLE_USER_CREATE_ATTEMPT",
    actor: "SERVICE",
  });
  const createdCircleUserId = await createCircleUser(circleUserId);
  const { data, error } = await supabase
    .from("circle_users")
    .insert({ account_id: accountId, circle_user_id: createdCircleUserId })
    .select("*")
    .single();

  if (error) {
    const { data: recovered, error: recoveredError } = await supabase
      .from("circle_users")
      .select("*")
      .eq("account_id", accountId)
      .maybeSingle();
    if (recoveredError) throw recoveredError;
    if (recovered) return recovered as CircleUserRow;
    throw error;
  }

  await recordAuditEvent({
    accountId,
    eventType: "CIRCLE_USER_CREATED",
    actor: "SERVICE",
  });
  return data as CircleUserRow;
}

async function listCircleWallets(userToken: string) {
  const data = await circleFetch<CircleWalletListResponse>({
    endpoint: "/v1/w3s/wallets",
    method: "GET",
    userToken,
  });
  return data.wallets ?? [];
}

function usableArcScaWallet(wallet: CircleWalletResponse) {
  return Boolean(
    wallet.id &&
      wallet.address &&
      wallet.blockchain === USER_WALLET_BLOCKCHAIN &&
      wallet.accountType === USER_WALLET_ACCOUNT_TYPE &&
      wallet.state === "LIVE",
  );
}

function circleWalletMatchesScope(wallet: CircleWalletResponse, input: { accountId: string; scope: WalletScope }) {
  const expectedRefId = `${input.accountId}:${input.scope}`;
  if (wallet.refId === expectedRefId) return true;
  return Boolean(wallet.metadata?.some((item) => item.refId === expectedRefId));
}

async function recoverPendingWallet(input: {
  wallet: WalletRow;
  userToken: string;
}) {
  if (input.wallet.circle_wallet_id && input.wallet.wallet_address) {
    return input.wallet;
  }

  const wallets = (await listCircleWallets(input.userToken))
    .filter(usableArcScaWallet)
    .filter((wallet) =>
      circleWalletMatchesScope(wallet, {
        accountId: input.wallet.account_id,
        scope: input.wallet.scope,
      }),
    );
  if (wallets.length !== 1) {
    await recordAuditEvent({
      accountId: input.wallet.account_id,
      eventType: "WALLET_CREATE_RECOVERY",
      actor: "SERVICE",
      metadata: {
        scope: input.wallet.scope,
        result: wallets.length > 1 ? "AMBIGUOUS" : "NO_TRUSTED_MATCH",
      },
    });
    return input.wallet;
  }

  const candidate = wallets[0];
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("wallets")
    .update({
      circle_wallet_id: candidate.id,
      wallet_address: candidate.address,
      status: "ACTIVE",
    })
    .eq("wallet_row_id", input.wallet.wallet_row_id)
    .select("*")
    .single();
  if (error) throw error;
  await recordAuditEvent({
    accountId: input.wallet.account_id,
    eventType: "WALLET_CREATE_RECOVERY",
    actor: "SERVICE",
    metadata: { scope: input.wallet.scope, result: "RECOVERED" },
  });
  return data as WalletRow;
}

export async function resolveOrCreateScopedWallet(accountId: string, scope: unknown) {
  assertWalletScope(scope);
  const supabase = createSupabaseAdminClient();
  const circleUser = await resolveOrCreateCircleUser(accountId);
  const token = await createCircleUserToken(circleUser.circle_user_id);

  const { data: existing, error: existingError } = await supabase
    .from("wallets")
    .select("*")
    .eq("account_id", accountId)
    .eq("scope", scope)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const wallet = existing as WalletRow;
    if (wallet.status === "ACTIVE") {
      return { wallet, circleChallengeId: undefined, recoveryRequired: false };
    }
    if (wallet.status === "FAILED") {
      return { wallet, circleChallengeId: undefined, recoveryRequired: true };
    }
    const recovered = await recoverPendingWallet({ wallet, userToken: token.userToken });
    return {
      wallet: recovered,
      circleChallengeId: undefined,
      recoveryRequired: recovered.status !== "ACTIVE",
    };
  }

  const idempotencyKey = stableIdempotencyKey(
    "initialize-wallet",
    `${accountId}:${scope}:${USER_WALLET_BLOCKCHAIN}`,
  );
  const { data: inserted, error: insertError } = await supabase
    .from("wallets")
    .insert({
      account_id: accountId,
      circle_user_row_id: circleUser.circle_user_row_id,
      scope,
      blockchain: USER_WALLET_BLOCKCHAIN,
      status: "PENDING",
      idempotency_key: idempotencyKey,
    })
    .select("*")
    .single();

  if (insertError) {
    const { data: recovered, error: recoveredError } = await supabase
      .from("wallets")
      .select("*")
      .eq("account_id", accountId)
      .eq("scope", scope)
      .maybeSingle();
    if (recoveredError) throw recoveredError;
    if (recovered) {
      return { wallet: recovered as WalletRow, circleChallengeId: undefined, recoveryRequired: true };
    }
    throw insertError;
  }

  const wallet = inserted as WalletRow;
  await recordAuditEvent({
    accountId,
    eventType: "WALLET_CREATE_ATTEMPT",
    actor: "SERVICE",
    metadata: { scope },
  });
  try {
    const initialized = await circleFetch<CircleInitializeResponse>({
      endpoint: "/v1/w3s/user/initialize",
      method: "POST",
      userToken: token.userToken,
      body: {
        idempotencyKey,
        blockchains: [USER_WALLET_BLOCKCHAIN],
        accountType: USER_WALLET_ACCOUNT_TYPE,
        metadata: [{ name: `CCN ${scope} Wallet`, refId: `${accountId}:${scope}` }],
      },
    });

    await recordAuditEvent({
      accountId,
      eventType: "WALLET_CREATED",
      actor: "SERVICE",
      metadata: { scope },
    });
    return { wallet, circleChallengeId: initialized.challengeId, recoveryRequired: true };
  } catch (error) {
    await supabase.from("wallets").update({ status: "FAILED" }).eq("wallet_row_id", wallet.wallet_row_id);
    await recordAuditEvent({
      accountId,
      eventType: "WALLET_CREATE_FAILED",
      actor: "SERVICE",
      metadata: {
        scope,
        endpoint: error instanceof CircleSpikeError ? error.safe.endpoint : CIRCLE_BASE_URL,
        code: error instanceof CircleSpikeError ? error.safe.code : "UNKNOWN",
      },
    });
    throw error;
  }
}

export async function getSafeCurrentAccount(authUser: User | null) {
  const account = await resolveOrCreateCcnAccount(authUser);
  return safeAccount(account);
}

export async function startCreatorOnboarding(authUser: User | null): Promise<CreatorOnboardingResult> {
  const account = await resolveOrCreateCcnAccount(authUser);
  const supabase = createSupabaseAdminClient();
  const { data: enabled, error: enableError } = await supabase
    .from("accounts")
    .update({ is_creator: true })
    .eq("account_id", account.account_id)
    .select("*")
    .single();
  if (enableError) throw enableError;

  await recordAuditEvent({
    accountId: account.account_id,
    eventType: "CREATOR_ROLE_ENABLED",
    actor: "USER",
  });

  const { data: insertedProfile, error: insertProfileError } = await supabase
    .from("creator_profiles")
    .insert({ account_id: account.account_id })
    .select("*")
    .single();
  let profile = insertedProfile as CreatorProfile | null;
  if (insertProfileError) {
    const { data: existingProfile, error: profileReadError } = await supabase
      .from("creator_profiles")
      .select("*")
      .eq("account_id", account.account_id)
      .single();
    if (profileReadError) throw profileReadError;
    profile = existingProfile as CreatorProfile;
  }
  if (!profile) {
    throw new CreatorFoundationError({
      message: "Creator profile could not be resolved.",
      status: 500,
      code: "CREATOR_PROFILE_RESOLUTION_FAILED",
    });
  }

  const scoped = await resolveOrCreateScopedWallet(account.account_id, "CREATOR_PAYOUT");
  return {
    account: safeAccount(enabled as CcnAccount),
    profile,
    wallet: safeWallet(scoped.wallet),
    circleChallengeId: scoped.circleChallengeId,
    recoveryRequired: scoped.recoveryRequired,
  };
}
