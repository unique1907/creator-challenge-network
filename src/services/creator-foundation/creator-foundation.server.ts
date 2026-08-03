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
import { removeBrandMedia, resolveAccountImageUrl } from "@/services/media/brand-media.server";
import { createSupabaseAdminClient } from "@/services/supabase/admin.server";
import type {
  AuditActor,
  CcnAccount,
  CcnPrimaryRole,
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
export type CreatorProfileIdentity = {
  accountId: string;
  authUserId: string | null;
  displayName: string;
  username: string | null;
  usernameNormalized: string | null;
  country: string | null;
  avatarImageKey: string | null;
  avatarImageUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

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

export function primaryRoleForAccount(account: Pick<CcnAccount, "is_brand" | "is_creator">): CcnPrimaryRole | null {
  if (account.is_brand && !account.is_creator) return "brand";
  if (account.is_creator && !account.is_brand) return "creator";
  return null;
}

function assertRoleIsNotConflicted(account: Pick<CcnAccount, "is_brand" | "is_creator">) {
  if (account.is_brand && account.is_creator) {
    throw new CreatorFoundationError({
      message: "This account has conflicting Brand and Creator roles and needs support remediation.",
      status: 403,
      code: "DUAL_ROLE_REMEDIATION_REQUIRED",
    });
  }
}

function assertCanUseBrandRole(account: Pick<CcnAccount, "is_brand" | "is_creator">) {
  assertRoleIsNotConflicted(account);
  if (account.is_creator) {
    throw new CreatorFoundationError({
      message: "This account is registered as a Creator. Brand accounts must use a separate sign-in.",
      status: 403,
      code: "BRAND_ROLE_CONFLICT",
    });
  }
}

function assertCanUseCreatorRole(account: Pick<CcnAccount, "is_brand" | "is_creator">) {
  assertRoleIsNotConflicted(account);
  if (account.is_brand) {
    throw new CreatorFoundationError({
      message: "This account is registered as a Brand. Creator accounts must use a separate sign-in.",
      status: 403,
      code: "CREATOR_ROLE_CONFLICT",
    });
  }
}

function safeAccount(account: CcnAccount): SafeAccountDto {
  const displayName = account.display_name?.trim() || null;
  const brandName = account.brand_name?.trim() || null;
  return {
    accountId: account.account_id,
    isBrand: account.is_brand,
    isCreator: account.is_creator,
    primaryRole: primaryRoleForAccount(account),
    primaryEmail: account.primary_email,
    displayName,
    avatarImageKey: account.avatar_image_key ?? null,
    brandName,
    brandLogoImageKey: account.brand_logo_image_key ?? null,
    websiteUrl: account.website_url ?? null,
    companyDescription: account.company_description ?? null,
    linkedinUrl: account.linkedin_url ?? null,
    instagramUrl: account.instagram_url ?? null,
    xUrl: account.x_url ?? null,
    brandOnboardingCompletedAt: account.brand_onboarding_completed_at,
    brandOnboardingComplete: Boolean(account.is_brand && displayName && brandName && account.brand_onboarding_completed_at),
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
  const supabase = createSupabaseAdminClient();
  const existing = await selectAccountBySupabaseUserId(authUser.id);

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
    .upsert(
      {
        supabase_user_id: authUser.id,
        primary_email: authUser.email,
      },
      { onConflict: "supabase_user_id" },
    )
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
      return { wallet, circleChallengeId: undefined, circleSession: token, recoveryRequired: false };
    }
    if (wallet.status === "FAILED") {
      return { wallet, circleChallengeId: undefined, circleSession: token, recoveryRequired: true };
    }
    const recovered = await recoverPendingWallet({ wallet, userToken: token.userToken });
    return {
      wallet: recovered,
      circleChallengeId: undefined,
      circleSession: token,
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
      return { wallet: recovered as WalletRow, circleChallengeId: undefined, circleSession: token, recoveryRequired: true };
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
    return { wallet, circleChallengeId: initialized.challengeId, circleSession: token, recoveryRequired: true };
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

export async function getVerifiedCreatorPayoutWallet(accountId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("account_id", accountId)
    .eq("scope", "CREATOR_PAYOUT")
    .maybeSingle();
  if (error) throw error;

  const wallet = data as WalletRow | null;
  if (!wallet?.circle_wallet_id || !wallet.wallet_address) {
    throw new CircleSpikeError({
      message: "Creator payout wallet mapping is not available.",
      status: 422,
    });
  }
  if (wallet.blockchain !== USER_WALLET_BLOCKCHAIN) {
    throw new CircleSpikeError({
      message: "Creator payout wallet is not an Arc Testnet SCA wallet.",
      status: 422,
    });
  }
  if (wallet.status !== "ACTIVE") {
    throw new CircleSpikeError({
      message: "Creator payout wallet must be LIVE before submission.",
      status: 422,
    });
  }

  return {
    ccnAccountId: accountId,
    walletId: wallet.circle_wallet_id,
    walletAddress: wallet.wallet_address,
    blockchain: USER_WALLET_BLOCKCHAIN,
    accountType: USER_WALLET_ACCOUNT_TYPE,
    walletState: "live",
  };
}

export async function getCreatorPayoutWalletStatus(accountId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("account_id", accountId)
    .eq("scope", "CREATOR_PAYOUT")
    .maybeSingle();
  if (error) throw error;
  const wallet = data as WalletRow | null;
  if (!wallet) return null;
  return safeWallet(wallet);
}

export async function getSafeCurrentAccount(authUser: User | null) {
  const account = await resolveOrCreateCcnAccount(authUser);
  return safeAccount(account);
}

function normalizeProfileField(value: unknown, label: string) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (text.length < 2) {
    throw new CreatorFoundationError({
      message: `${label} is required.`,
      status: 400,
      code: "BRAND_ONBOARDING_FIELD_REQUIRED",
    });
  }
  if (text.length > 120) {
    throw new CreatorFoundationError({
      message: `${label} must be 120 characters or fewer.`,
      status: 400,
      code: "BRAND_ONBOARDING_FIELD_TOO_LONG",
    });
  }
  return text;
}

export async function completeBrandOnboarding(authUser: User | null, input: {
  displayName: unknown;
  brandName: unknown;
}) {
  const account = await resolveOrCreateCcnAccount(authUser);
  assertCanUseBrandRole(account);

  const displayName = normalizeProfileField(input.displayName, "Display name");
  const brandName = normalizeProfileField(input.brandName, "Company / Brand name");
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .update({
      is_brand: true,
      is_creator: false,
      display_name: displayName,
      brand_name: brandName,
      brand_onboarding_completed_at: account.brand_onboarding_completed_at ?? new Date().toISOString(),
    })
    .eq("account_id", account.account_id)
    .select("*")
    .single();
  if (error) throw error;

  await recordAuditEvent({
    accountId: account.account_id,
    eventType: "BRAND_ONBOARDING_COMPLETED",
    actor: "USER",
  });

  return safeAccount(data as CcnAccount);
}

function optionalText(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!text) return null;
  if (text.length > maxLength) {
    throw new CreatorFoundationError({
      message: `Field must be ${maxLength} characters or fewer.`,
      status: 400,
      code: "FIELD_TOO_LONG",
    });
  }
  return text;
}

function optionalUrl(value: unknown, label: string) {
  const text = optionalText(value, 240);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("invalid protocol");
    return url.toString();
  } catch {
    throw new CreatorFoundationError({
      message: `${label} must be a valid http or https URL.`,
      status: 400,
      code: "INVALID_URL",
    });
  }
}

export async function updateBrandProfile(authUser: User | null, input: {
  displayName: unknown;
  avatarImageKey?: string | null;
}) {
  const account = await resolveOrCreateCcnAccount(authUser);
  assertRoleIsNotConflicted(account);
  if (!account.is_brand || account.is_creator) {
    throw new CreatorFoundationError({ message: "Brand workspace access is required.", status: 403, code: "BRAND_REQUIRED" });
  }
  const displayName = normalizeProfileField(input.displayName, "Display name");
  const patch: Record<string, unknown> = { display_name: displayName };
  if ("avatarImageKey" in input) {
    patch.avatar_image_key = input.avatarImageKey || null;
    patch.avatar_image_updated_at = new Date().toISOString();
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .update(patch)
    .eq("account_id", account.account_id)
    .select("*")
    .single();
  if (error) throw error;
  await recordAuditEvent({ accountId: account.account_id, eventType: "BRAND_PROFILE_UPDATED", actor: "USER" });
  return safeAccount(data as CcnAccount);
}

export async function updateBrandCompany(authUser: User | null, input: {
  brandName: unknown;
  brandLogoImageKey?: string | null;
  websiteUrl?: unknown;
  companyDescription?: unknown;
  linkedinUrl?: unknown;
  instagramUrl?: unknown;
  xUrl?: unknown;
}) {
  const account = await resolveOrCreateCcnAccount(authUser);
  assertRoleIsNotConflicted(account);
  if (!account.is_brand || account.is_creator) {
    throw new CreatorFoundationError({ message: "Brand workspace access is required.", status: 403, code: "BRAND_REQUIRED" });
  }
  const patch: Record<string, unknown> = {
    brand_name: normalizeProfileField(input.brandName, "Company / Brand name"),
    website_url: optionalUrl(input.websiteUrl, "Website"),
    company_description: optionalText(input.companyDescription, 500),
    linkedin_url: optionalUrl(input.linkedinUrl, "LinkedIn"),
    instagram_url: optionalUrl(input.instagramUrl, "Instagram"),
    x_url: optionalUrl(input.xUrl, "X"),
  };
  if ("brandLogoImageKey" in input) {
    patch.brand_logo_image_key = input.brandLogoImageKey || null;
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .update(patch)
    .eq("account_id", account.account_id)
    .select("*")
    .single();
  if (error) throw error;
  await recordAuditEvent({ accountId: account.account_id, eventType: "BRAND_COMPANY_UPDATED", actor: "USER" });
  return safeAccount(data as CcnAccount);
}

const RESERVED_CREATOR_USERNAMES = new Set([
  "admin",
  "api",
  "auth",
  "brand",
  "brands",
  "challenge",
  "challenges",
  "creator",
  "creators",
  "dashboard",
  "settings",
  "submit",
  "support",
  "wallet",
]);

function normalizeCreatorUsername(value: unknown) {
  if (typeof value !== "string") {
    throw new CreatorFoundationError({ message: "Creator username is required.", status: 400, code: "CREATOR_USERNAME_REQUIRED" });
  }
  const username = value.trim().toLowerCase();
  if (username.length < 3 || username.length > 30) {
    throw new CreatorFoundationError({ message: "Creator username must be 3 to 30 characters.", status: 400, code: "CREATOR_USERNAME_LENGTH" });
  }
  if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(username)) {
    throw new CreatorFoundationError({ message: "Creator username may use lowercase letters, numbers, dots, underscores and hyphens.", status: 400, code: "CREATOR_USERNAME_FORMAT" });
  }
  if (RESERVED_CREATOR_USERNAMES.has(username)) {
    throw new CreatorFoundationError({ message: "This Creator username is reserved.", status: 400, code: "CREATOR_USERNAME_RESERVED" });
  }
  return username;
}

function normalizeCreatorCountry(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new CreatorFoundationError({ message: "Creator country must be text.", status: 400, code: "CREATOR_COUNTRY_INVALID" });
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 80) {
    throw new CreatorFoundationError({ message: "Creator country is too long.", status: 400, code: "CREATOR_COUNTRY_TOO_LONG" });
  }
  return trimmed;
}

function creatorProfileDiagnosticsEnabled() {
  return process.env.NODE_ENV === "development" || process.env.CCN_CREATOR_PROFILE_DIAGNOSTICS === "true";
}

function shortSafeId(value: string | null | undefined) {
  if (!value) return "missing";
  if (value.length <= 12) return "present";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function logCreatorProfileDiagnostic(label: "[creator-profile-save]" | "[creator-profile-load]", fields: Record<string, unknown>) {
  if (!creatorProfileDiagnosticsEnabled()) return;
  console.info(label, fields);
}

export function logCreatorProfileRuntime(fields: {
  authUser?: string | null;
  accountId?: string | null;
  profileAccountId?: string | null;
  profileAuthUserId?: string | null;
  operation: "insert" | "update" | "upsert" | "resolve";
  affected: number;
  result: "success" | "failure";
  reason?: string;
}) {
  if (!creatorProfileDiagnosticsEnabled()) return;
  console.info(
    "[creator-profile-runtime] " +
      [
        `authUser=${shortSafeId(fields.authUser)}`,
        `accountId=${shortSafeId(fields.accountId)}`,
        `profileAccountId=${shortSafeId(fields.profileAccountId)}`,
        `profileAuthUserId=${shortSafeId(fields.profileAuthUserId)}`,
        `operation=${fields.operation}`,
        `affected=${fields.affected}`,
        `result=${fields.result}`,
        fields.reason ? `reason=${fields.reason}` : null,
      ].filter(Boolean).join(" "),
  );
}

let creatorProfileExtendedColumns: boolean | null = null;

async function creatorProfileSupportsExtendedColumns() {
  if (creatorProfileExtendedColumns !== null) return creatorProfileExtendedColumns;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("creator_profiles")
    .select("auth_user_id,username_normalized,avatar_image_key,avatar_image_updated_at")
    .limit(1);
  if (error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST205") {
    creatorProfileExtendedColumns = false;
    return false;
  }
  if (error) throw error;
  creatorProfileExtendedColumns = true;
  return true;
}

function normalizeCreatorAvatarKey(value: unknown, accountId: string) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new CreatorFoundationError({ message: "Creator avatar key is invalid.", status: 400, code: "CREATOR_AVATAR_KEY_INVALID" });
  }
  const key = value.trim();
  if (!key) return null;
  const expectedPrefix = `accounts/${accountId}/avatar/`;
  if (!key.startsWith(expectedPrefix) || !/\.(jpg|png|webp)$/i.test(key)) {
    throw new CreatorFoundationError({ message: "Creator avatar key is invalid.", status: 400, code: "CREATOR_AVATAR_KEY_INVALID" });
  }
  return key;
}

function creatorIdentityFromRows(input: {
  account: CcnAccount;
  profile: CreatorProfile | null;
}): CreatorProfileIdentity {
  const username = input.profile?.username?.trim() || null;
  const usernameNormalized = input.profile?.username_normalized?.trim() || username?.toLowerCase() || null;
  const avatarImageKey = input.profile?.avatar_image_key ?? input.account.avatar_image_key ?? null;
  const displayName =
    input.profile?.display_name?.trim() ||
    input.account.display_name?.trim() ||
    username ||
    "Creator account";

  return {
    accountId: input.account.account_id,
    authUserId: input.profile?.auth_user_id ?? input.account.supabase_user_id ?? null,
    displayName,
    username,
    usernameNormalized,
    country: input.profile?.country?.trim() || null,
    avatarImageKey,
    avatarImageUrl: resolveAccountImageUrl(avatarImageKey),
    createdAt: input.profile?.created_at ?? null,
    updatedAt: input.profile?.updated_at ?? input.account.updated_at ?? null,
  };
}

export async function getCcnAccountById(accountId: string): Promise<CcnAccount | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw error;
  return data as CcnAccount | null;
}
export async function getCreatorProfile(accountId: string): Promise<CreatorProfile | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw error;
  return data as CreatorProfile | null;
}

export async function getCreatorProfileIdentity(accountId: string): Promise<CreatorProfileIdentity | null> {
  const [account, profile] = await Promise.all([
    getCcnAccountById(accountId),
    getCreatorProfile(accountId).catch(() => null),
  ]);
  if (!account) return null;
  const identity = creatorIdentityFromRows({ account, profile });
  logCreatorProfileDiagnostic("[creator-profile-load]", {
    accountId: shortSafeId(accountId),
    profileFound: Boolean(profile),
    usernamePresent: Boolean(identity.username),
    avatarPresent: Boolean(identity.avatarImageKey),
  });
  return identity;
}

export async function updateCreatorProfile(authUser: User | null, input: {
  displayName?: unknown;
  username?: unknown;
  country?: unknown;
  avatarImageKey?: unknown;
}) {
  const account = await resolveOrCreateCcnAccount(authUser);
  assertCanUseCreatorRole(account);
  if (!account.is_creator || account.is_brand) {
    throw new CreatorFoundationError({ message: "Creator workspace access is required.", status: 403, code: "CREATOR_REQUIRED" });
  }

  const displayName = normalizeProfileField(input.displayName, "Display name");
  const username = normalizeCreatorUsername(input.username);
  const country = normalizeCreatorCountry(input.country);
  const supabase = createSupabaseAdminClient();
  const supportsExtendedColumns = await creatorProfileSupportsExtendedColumns();
  if (!supportsExtendedColumns) {
    logCreatorProfileRuntime({
      authUser: account.supabase_user_id,
      accountId: account.account_id,
      operation: "resolve",
      affected: 0,
      result: "failure",
      reason: "schema-incomplete",
    });
    throw new CreatorFoundationError({
      message: "Creator profile storage is not ready. Apply the Creator profile/avatar persistence migration.",
      status: 500,
      code: "CREATOR_PROFILE_SCHEMA_INCOMPLETE",
    });
  }
  const existingProfileRow = await getCreatorProfile(account.account_id);
  const before = await getCreatorProfileIdentity(account.account_id);
  const avatarImageKey = normalizeCreatorAvatarKey(input.avatarImageKey, account.account_id);
  const accountPatch: Record<string, unknown> = { display_name: displayName };
  if (avatarImageKey !== undefined) {
    accountPatch.avatar_image_key = avatarImageKey;
    accountPatch.avatar_image_updated_at = new Date().toISOString();
  }

  const accountUpdate = await supabase
    .from("accounts")
    .update(accountPatch)
    .eq("account_id", account.account_id)
    .select("account_id")
    .single();
  if (accountUpdate.error) throw accountUpdate.error;

  const usernameColumn = supportsExtendedColumns ? "username_normalized" : "username";
  const existing = await supabase
    .from("creator_profiles")
    .select("account_id,username")
    .eq(usernameColumn, username)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data && existing.data.account_id !== account.account_id) {
    throw new CreatorFoundationError({ message: "This Creator username is already taken.", status: 409, code: "CREATOR_USERNAME_TAKEN" });
  }

  const profilePatch: Record<string, unknown> = {
    account_id: account.account_id,
    display_name: displayName,
    username,
    country,
  };
  if (supportsExtendedColumns) {
    profilePatch.auth_user_id = account.supabase_user_id;
    profilePatch.username_normalized = username;
    if (avatarImageKey !== undefined) {
      profilePatch.avatar_image_key = avatarImageKey;
      profilePatch.avatar_image_updated_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from("creator_profiles")
    .upsert(profilePatch, { onConflict: "account_id" })
    .select("*")
    .single();
  if (error) {
    logCreatorProfileRuntime({
      authUser: account.supabase_user_id,
      accountId: account.account_id,
      profileAccountId: existingProfileRow?.account_id ?? null,
      profileAuthUserId: existingProfileRow?.auth_user_id ?? null,
      operation: existingProfileRow ? "update" : "insert",
      affected: 0,
      result: "failure",
      reason: error.code ?? "upsert-error",
    });
    if (error.code === "23505") {
      throw new CreatorFoundationError({ message: "This Creator username is already taken.", status: 409, code: "CREATOR_USERNAME_TAKEN" });
    }
    throw error;
  }

  const identity = await getCreatorProfileIdentity(account.account_id);
  if (
    !identity ||
    identity.displayName !== displayName ||
    identity.username !== username ||
    identity.country !== country ||
    (avatarImageKey !== undefined && identity.avatarImageKey !== avatarImageKey)
  ) {
    logCreatorProfileRuntime({
      authUser: account.supabase_user_id,
      accountId: account.account_id,
      profileAccountId: (data as CreatorProfile | null)?.account_id ?? null,
      profileAuthUserId: (data as CreatorProfile | null)?.auth_user_id ?? null,
      operation: existingProfileRow ? "update" : "insert",
      affected: data ? 1 : 0,
      result: "failure",
      reason: "readback-mismatch",
    });
    throw new CreatorFoundationError({
      message: "Creator profile save could not be verified.",
      status: 500,
      code: "CREATOR_PROFILE_READBACK_MISMATCH",
    });
  }

  if (
    avatarImageKey !== undefined &&
    before?.avatarImageKey &&
    before.avatarImageKey !== avatarImageKey &&
    before.avatarImageKey.startsWith(`accounts/${account.account_id}/avatar/`)
  ) {
    await removeBrandMedia(before.avatarImageKey).catch(() => undefined);
  }

  await recordAuditEvent({ accountId: account.account_id, eventType: "CREATOR_PROFILE_UPDATED", actor: "USER" });
  logCreatorProfileRuntime({
    authUser: account.supabase_user_id,
    accountId: account.account_id,
    profileAccountId: (data as CreatorProfile).account_id,
    profileAuthUserId: (data as CreatorProfile).auth_user_id ?? account.supabase_user_id,
    operation: existingProfileRow ? "update" : "insert",
    affected: data ? 1 : 0,
    result: "success",
  });
  logCreatorProfileDiagnostic("[creator-profile-save]", {
    accountId: shortSafeId(account.account_id),
    rowWritten: Boolean(data),
    usernamePersisted: identity.username === username,
    avatarPersisted: avatarImageKey === undefined || identity.avatarImageKey === avatarImageKey,
    extendedProfileColumns: supportsExtendedColumns,
  });
  return identity;
}
export async function startCreatorOnboarding(authUser: User | null): Promise<CreatorOnboardingResult> {
  const account = await resolveOrCreateCcnAccount(authUser);
  assertCanUseCreatorRole(account);
  const supabase = createSupabaseAdminClient();
  const { data: enabled, error: enableError } = await supabase
    .from("accounts")
    .update({ is_creator: true, is_brand: false })
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
    circleSession: scoped.circleSession,
    recoveryRequired: scoped.recoveryRequired,
  };
}
