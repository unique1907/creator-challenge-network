import "server-only";

import type { User } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { primaryRoleForAccount, resolveOrCreateCcnAccount } from "@/services/creator-foundation/creator-foundation.server";
import { resolveBrandAccountIdentity } from "@/services/auth/brand-identity.server";
import { createSupabaseServerClient } from "@/services/supabase/server";
import type { CcnAccount, CcnPrimaryRole } from "@/types/creator-foundation";

export type AuthProvider = "email" | "google" | "github" | "discord" | "x" | "development";

export type AuthenticatedCcnContext = {
  authUserId: string;
  ccnAccountId: string;
  email?: string;
  displayName: string;
  brandName?: string | null;
  avatarImageKey?: string | null;
  avatarImageUrl?: string | null;
  brandOnboardingComplete: boolean;
  provider: AuthProvider;
  primaryRole: CcnPrimaryRole | null;
  brandAccess: boolean;
  creatorAccess: boolean;
  testOnly: boolean;
};

export class CcnAuthError extends Error {
  readonly status: 401 | 403 | 404;
  readonly code: string;

  constructor(input: { message: string; status: 401 | 403 | 404; code: string }) {
    super(input.message);
    this.name = "CcnAuthError";
    this.status = input.status;
    this.code = input.code;
  }
}

function isNonProduction() {
  return process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production" && process.env.CCN_DEPLOYMENT_ENV !== "production";
}

export function isProductionRuntime() {
  return !isNonProduction();
}

export function isAuthTestContextAvailable() {
  return isNonProduction() && (process.env.CCN_SMOKE_TEST_MODE === "true" || process.env.CCN_AUTH_TEST_MODE === "true");
}

function displayNameFromUser(user: User) {
  const metadataName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.user_name;
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim();
  if (user.email) return user.email.split("@")[0] || "CCN User";
  return "CCN User";
}

function safeDisplayName(account: CcnAccount, user: User) {
  const storedDisplayName = account.display_name?.trim();
  if (storedDisplayName) return storedDisplayName;
  return displayNameFromUser(user);
}

function brandOnboardingComplete(account: CcnAccount) {
  return Boolean(
    account.is_brand &&
      account.display_name?.trim() &&
      account.brand_name?.trim() &&
      account.brand_onboarding_completed_at,
  );
}

function isMissingAuthSessionError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; message?: unknown };
  return candidate.name === "AuthSessionMissingError" || candidate.message === "Auth session missing!";
}
function providerFromUser(user: User): AuthProvider {
  const provider = user.app_metadata?.provider;
  if (provider === "google" || provider === "github" || provider === "discord") return provider;
  if (provider === "twitter") return "x";
  return "email";
}

function contextFromAccount(input: { user: User; account: CcnAccount }): AuthenticatedCcnContext {
  if (input.account.status !== "ACTIVE" || input.account.deleted_at) {
    throw new CcnAuthError({
      message: "This CCN account is not active.",
      status: 403,
      code: "ACCOUNT_NOT_ACTIVE",
    });
  }
  const primaryRole = primaryRoleForAccount(input.account);
  const brandIdentity = resolveBrandAccountIdentity(input.account);
  if (input.account.is_brand && input.account.is_creator) {
    throw new CcnAuthError({
      message: "This account has conflicting Brand and Creator roles and needs support remediation.",
      status: 403,
      code: "DUAL_ROLE_ACCOUNT_NOT_ALLOWED",
    });
  }
  return {
    authUserId: input.user.id,
    ccnAccountId: input.account.account_id,
    email: input.user.email,
    displayName: safeDisplayName(input.account, input.user),
    brandName: brandIdentity.brandName,
    avatarImageKey: brandIdentity.avatarImageKey,
    avatarImageUrl: brandIdentity.avatarImageUrl,
    brandOnboardingComplete: brandOnboardingComplete(input.account),
    provider: providerFromUser(input.user),
    primaryRole,
    brandAccess: primaryRole === "brand",
    creatorAccess: primaryRole === "creator",
    testOnly: false,
  };
}

function demoBrandContext(): AuthenticatedCcnContext {
  return {
    authUserId: "development-brand-user",
    ccnAccountId: "ccn-test-email-001",
    email: "demo-brand@example.invalid",
    displayName: "Firat Kaya",
    brandName: "Firat Kaya",
    avatarImageKey: null,
    avatarImageUrl: null,
    brandOnboardingComplete: true,
    provider: "development",
    primaryRole: "brand",
    brandAccess: true,
    creatorAccess: false,
    testOnly: true,
  };
}

function demoCreatorContext(): AuthenticatedCcnContext {
  return {
    authUserId: "development-creator-user",
    ccnAccountId: "ccn-test-creator-001",
    email: "demo-creator@example.invalid",
    displayName: "Demo Creator",
    brandName: null,
    avatarImageKey: null,
    avatarImageUrl: null,
    brandOnboardingComplete: false,
    provider: "development",
    primaryRole: "creator",
    brandAccess: false,
    creatorAccess: true,
    testOnly: true,
  };
}

export function getDemoCcnContext(workspace: "brand" | "creator") {
  if (!isAuthTestContextAvailable()) return null;
  return workspace === "brand" ? demoBrandContext() : demoCreatorContext();
}

async function isDeterministicTestAuthRequest() {
  if (!isAuthTestContextAvailable()) return false;
  try {
    const requestHeaders = await headers();
    return requestHeaders.get("x-ccn-test-auth") === "deterministic";
  } catch {
    return false;
  }
}

export async function getAuthenticatedCcnContext(options: {
  workspace?: "brand" | "creator";
  allowTestContext?: boolean;
} = {}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error && !isMissingAuthSessionError(error)) throw error;
  if (data.user) {
    const account = await resolveOrCreateCcnAccount(data.user);
    return contextFromAccount({ user: data.user, account });
  }
  if (options.allowTestContext && options.workspace && await isDeterministicTestAuthRequest()) {
    const demo = getDemoCcnContext(options.workspace);
    if (demo) return demo;
  }
  return null;
}

export async function requireAuthenticatedCcnContext(options: {
  workspace?: "brand" | "creator";
  allowTestContext?: boolean;
} = {}) {
  const context = await getAuthenticatedCcnContext(options);
  if (!context) {
    throw new CcnAuthError({
      message: "Sign in is required.",
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
    });
  }
  return context;
}

export async function requireBrandWorkspace(options: { allowTestContext?: boolean } = {}) {
  const context = await requireAuthenticatedCcnContext({
    workspace: "brand",
    allowTestContext: options.allowTestContext,
  });
  if (!context.brandAccess) {
    throw new CcnAuthError({
      message: "Brand workspace access is required.",
      status: 403,
      code: "BRAND_WORKSPACE_REQUIRED",
    });
  }
  return context;
}

export async function requireCreatorWorkspace(options: { allowTestContext?: boolean } = {}) {
  const context = await requireAuthenticatedCcnContext({
    workspace: "creator",
    allowTestContext: options.allowTestContext,
  });
  if (!context.creatorAccess) {
    throw new CcnAuthError({
      message: "Creator workspace access is required.",
      status: 403,
      code: "CREATOR_WORKSPACE_REQUIRED",
    });
  }
  return context;
}

export function authErrorResponse(error: unknown, fallback = "Request is not authorized.") {
  if (error instanceof CcnAuthError) {
    return NextResponse.json(
      { error: { message: error.message, code: error.code } },
      { status: error.status },
    );
  }
  return NextResponse.json({ error: { message: fallback } }, { status: 400 });
}

export function redirectToSignIn() {
  redirect("/auth/sign-in");
}
