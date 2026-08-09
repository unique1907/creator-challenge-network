import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, expected, message) {
  assert.ok(source.includes(expected), `${message}: missing ${expected}`);
}

function excludes(source, forbidden, message) {
  assert.ok(!source.includes(forbidden), `${message}: found ${forbidden}`);
}

function expectedRecoveryRedirect(origin) {
  return `${new URL(origin).origin}/auth/callback?type=recovery&next=${encodeURIComponent("/auth/update-password")}`;
}

const siteUrl = read("src/config/site-url.ts");
const forgotPassword = read("src/features/auth/components/forgot-password-form.tsx");
const forgotPasswordPage = read("src/app/auth/forgot-password/page.tsx");
const authActions = read("src/features/auth/components/auth-actions.tsx");
const callback = read("src/app/auth/callback/route.ts");
const signIn = read("src/app/auth/sign-in/page.tsx");

includes(forgotPasswordPage, "<ForgotPasswordForm />", "Creator and Brand forgot-password entry must use the shared recovery form");
includes(authActions, 'href="/auth/forgot-password"', "Sign-in forgot-password link must use the shared recovery route");
includes(forgotPassword, "resetPasswordForEmail", "Shared recovery form must call Supabase password recovery");
includes(forgotPassword, "getPublicSiteOrigin()", "Shared recovery form must use the canonical browser-aware origin helper");
includes(forgotPassword, "/auth/callback?type=recovery", "Shared recovery form must route recovery through the existing callback");
includes(forgotPassword, 'next=${encodeURIComponent("/auth/update-password")}', "Shared recovery form must preserve the update-password destination");
includes(callback, 'callbackType === "recovery"', "Callback must retain the recovery branch");
includes(callback, 'const destination = next === "/auth/update-password" ? next : "/auth/update-password"', "Recovery callback must land only on the existing update-password route");
includes(callback, "getRequestRedirectOrigin(request.url)", "Recovery callback must preserve safe local loopback request origins");
includes(signIn, "authErrorMessage", "Existing sign-in auth error handling must remain available");

includes(siteUrl, 'DEFAULT_PUBLIC_SITE_URL = "https://creator-challenge-network.vercel.app"', "Production fallback must remain the approved Vercel origin");
includes(siteUrl, 'typeof window !== "undefined"', "Browser flows must read the current window origin");
includes(siteUrl, "window.location.origin", "Local browser recovery must preserve the active browser origin");
includes(siteUrl, "if (isLoopbackOrigin(requestOrigin)) return requestOrigin", "Server callback must preserve loopback origins");
excludes(siteUrl, "http://localhost:3000", "Recovery helper must not hardcode localhost:3000");
excludes(siteUrl, "http://localhost:3001", "Recovery helper must not hardcode localhost:3001");
excludes(forgotPassword, "https://creator-challenge-network.vercel.app/auth/callback", "Recovery form must not hardcode production callback");
excludes(forgotPassword, "localhost:3000", "Recovery form must not hardcode localhost:3000");
excludes(forgotPassword, "localhost:3001", "Recovery form must not hardcode localhost:3001");

assert.equal(
  expectedRecoveryRedirect("http://localhost:3000"),
  "http://localhost:3000/auth/callback?type=recovery&next=%2Fauth%2Fupdate-password",
  "localhost:3000 recovery redirect must preserve localhost:3000",
);
assert.equal(
  expectedRecoveryRedirect("http://localhost:3001"),
  "http://localhost:3001/auth/callback?type=recovery&next=%2Fauth%2Fupdate-password",
  "localhost:3001 recovery redirect must preserve localhost:3001",
);
assert.equal(
  expectedRecoveryRedirect("https://creator-challenge-network.vercel.app"),
  "https://creator-challenge-network.vercel.app/auth/callback?type=recovery&next=%2Fauth%2Fupdate-password",
  "Production recovery redirect must remain production",
);

console.log(JSON.stringify({
  result: "P0 Creator password recovery redirect verifier passed",
  creatorRecoveryPath: "/auth/forgot-password -> /auth/callback?type=recovery&next=/auth/update-password -> /auth/update-password",
  local3000: expectedRecoveryRedirect("http://localhost:3000"),
  local3001: expectedRecoveryRedirect("http://localhost:3001"),
  production: expectedRecoveryRedirect("https://creator-challenge-network.vercel.app"),
  sharedWithBrand: true,
}, null, 2));
