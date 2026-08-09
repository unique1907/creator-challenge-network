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

const siteUrl = read("src/config/site-url.ts");
const authActions = read("src/features/auth/components/auth-actions.tsx");
const callback = read("src/app/auth/callback/route.ts");
const home = read("src/app/page.tsx");
const authUrlErrorRedirect = read("src/features/auth/components/auth-url-error-redirect.tsx");
const forgotPassword = read("src/features/auth/components/forgot-password-form.tsx");

includes(siteUrl, 'DEFAULT_PUBLIC_SITE_URL = "https://creator-challenge-network.vercel.app"', "Production fallback origin must remain canonical");
includes(siteUrl, 'typeof window !== "undefined"', "Browser signup redirects must be able to use the active browser origin");
includes(siteUrl, "window.location.origin", "Local signup must preserve the active loopback origin");
includes(siteUrl, "if (isLoopbackOrigin(requestOrigin)) return requestOrigin", "Server callback redirects must preserve loopback origins");
excludes(siteUrl, "http://localhost:3000", "Signup redirects must not hardcode localhost:3000");
excludes(siteUrl, "http://localhost:3001", "Signup redirects must not hardcode localhost:3001");

includes(authActions, "supabase.auth.signUp", "Brand signup must use Supabase password signup");
includes(authActions, "getPublicSiteOrigin()", "Signup must resolve redirect from active environment");
includes(authActions, "emailRedirectTo", "Signup confirmation redirect must be explicit");
includes(authActions, 'nextPath: normalizedRole === "creator" ? "/auth/onboarding/creator" : "/auth/onboarding/brand"', "Brand signup must target Brand onboarding through callback");
includes(authActions, "roleIntent: normalizedRole", "Signup confirmation must preserve role intent through callback");
includes(authActions, "ccn_role_intent", "Signup must preserve role intent in auth metadata");
includes(authActions, "supabase.auth.signInWithOtp", "Secondary OTP flow must remain explicit");
includes(authActions, "options: { emailRedirectTo: `${origin}${buildCallbackPath({ nextPath, roleIntent })}` }", "Secondary email link redirect must use same callback helper");
excludes(authActions, "auth.resend", "This task must not send or implement real resend emails");

includes(callback, "exchangeCodeForSession(code)", "Confirmation callback must exchange Supabase code for a session");
includes(callback, '"/auth/onboarding/brand"', "Callback must preserve Brand onboarding destination");
includes(callback, "getRequestRedirectOrigin(request.url)", "Callback must redirect on the current safe origin");
excludes(callback, "access_token", "Callback must not expose access tokens");
excludes(callback, "refresh_token", "Callback must not expose refresh tokens");

includes(home, "authErrorRedirectCode", "Homepage must intentionally handle auth error query params");
includes(home, 'params.error_code === "otp_expired"', "Homepage must map otp_expired to safe auth error UX");
includes(home, 'redirect(`/auth/sign-in?error=${encodeURIComponent(authError)}`)', "Homepage must route raw auth query errors to sign-in UI");
includes(home, "<AuthUrlErrorRedirect />", "Homepage must include hash-only auth error handoff");
includes(authUrlErrorRedirect, '"use client"', "Hash auth error handoff must run client-side");
includes(authUrlErrorRedirect, "window.location.hash", "Hash auth errors must be inspected because fragments are not sent to the server");
includes(authUrlErrorRedirect, 'errorCode === "otp_expired"', "Hash otp_expired must map to callback_expired");
includes(authUrlErrorRedirect, 'window.location.replace(`/auth/sign-in?error=${encodeURIComponent(error)}`)', "Hash auth errors must replace raw URL with safe sign-in error state");

includes(forgotPassword, "resetPasswordForEmail", "Password recovery behavior must remain unchanged");
includes(forgotPassword, "/auth/callback?type=recovery", "Password recovery callback path must remain unchanged");

console.log(JSON.stringify({
  result: "P0 Brand signup confirmation redirect verifier passed",
  localSignup: "active browser origin + /auth/callback",
  productionSignup: "https://creator-challenge-network.vercel.app/auth/callback",
  expiredLinkUx: "/auth/sign-in?error=callback_expired",
  resendEmailSent: false,
}, null, 2));
