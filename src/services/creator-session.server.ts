import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";

export const CREATOR_SESSION_COOKIE = "ccn_creator_session";

export type CreatorSession = {
  ccnAccountId: string;
  displayName: string;
  authProvider: "email" | "google" | "github" | "discord" | "x" | "development";
  testOnly: boolean;
};

const TEST_CREATORS: CreatorSession[] = [
  {
    ccnAccountId: "ccn-test-creator-001",
    displayName: "Demo Creator",
    authProvider: "email",
    testOnly: true,
  },
  {
    ccnAccountId: "cb82d778-c6eb-481f-8e38-e9f6ac558278",
    displayName: "Demo Creator",
    authProvider: "email",
    testOnly: true,
  },
  {
    ccnAccountId: "00000000-0000-4000-8000-0000000008c1",
    displayName: "Checkpoint Creator",
    authProvider: "email",
    testOnly: true,
  },
];

function isDevCreatorAuthEnabled() {
  return process.env.NODE_ENV === "development" && process.env.CCN_SMOKE_TEST_MODE === "true";
}

function dynamicFixtureCreator(accountId: unknown): CreatorSession | null {
  if (typeof accountId !== "string") return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId)) return null;
  return {
    ccnAccountId: accountId,
    displayName: "Checkpoint Fixture Creator",
    authProvider: "development",
    testOnly: true,
  };
}

function sessionToken(accountId: string) {
  return createHash("sha256").update(`ccn-creator-dev-session:v1:${accountId}`).digest("hex");
}

function encodeSessionCookie(accountId: string) {
  return `${accountId}.${sessionToken(accountId)}`;
}

function decodeSessionCookie(cookieValue: string | undefined) {
  if (!cookieValue) return null;
  const separator = cookieValue.lastIndexOf(".");
  if (separator <= 0) return null;
  const accountId = cookieValue.slice(0, separator);
  const token = cookieValue.slice(separator + 1);
  if (!token || !safeEqual(token, sessionToken(accountId))) return null;
  return accountId;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isCreatorTestAuthAvailable() {
  return isDevCreatorAuthEnabled();
}

export function listApprovedTestCreators() {
  return TEST_CREATORS.map(({ ccnAccountId, displayName, authProvider, testOnly }) => ({
    ccnAccountId,
    displayName,
    authProvider,
    testOnly,
  }));
}

export const getCreatorSession = cache(async function getCreatorSession() {
  const authContext = await getAuthenticatedCcnContext({ workspace: "creator", allowTestContext: false });
  if (authContext?.creatorAccess) {
    return {
      ccnAccountId: authContext.ccnAccountId,
      displayName: authContext.displayName,
      authProvider: authContext.provider,
      testOnly: authContext.testOnly,
    } satisfies CreatorSession;
  }

  if (!isDevCreatorAuthEnabled()) return null;

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(CREATOR_SESSION_COOKIE)?.value;
  if (!cookieValue) return null;

  const encodedAccountId = decodeSessionCookie(cookieValue);
  if (encodedAccountId) {
    return TEST_CREATORS.find((creator) => creator.ccnAccountId === encodedAccountId) ?? dynamicFixtureCreator(encodedAccountId);
  }

  return TEST_CREATORS.find((creator) => safeEqual(cookieValue, sessionToken(creator.ccnAccountId))) ?? null;
});

export async function createCreatorSession(accountId: unknown, options: { checkpointFixture?: boolean } = {}) {
  if (!isDevCreatorAuthEnabled()) {
    throw new Error("Creator sign-in is not configured for this environment.");
  }

  const creator =
    TEST_CREATORS.find((item) => item.ccnAccountId === accountId) ??
    (options.checkpointFixture ? dynamicFixtureCreator(accountId) : null);
  if (!creator) {
    throw new Error("Choose an approved test Creator account.");
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: CREATOR_SESSION_COOKIE,
    value: encodeSessionCookie(creator.ccnAccountId),
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
  });

  return creator;
}

export async function clearCreatorSession() {
  const cookieStore = await cookies();
  cookieStore.set({
    name: CREATOR_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
    maxAge: 0,
  });
}

export async function requireCreatorSession() {
  const session = await getCreatorSession();
  if (!session) {
    throw new Error("Sign in is required to submit your work.");
  }
  return session;
}
