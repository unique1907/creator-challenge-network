import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const siteUrl = read("src/config/site-url.ts");
const signOut = read("src/app/auth/sign-out/route.ts");
const callback = read("src/app/auth/callback/route.ts");
const forgotPassword = read("src/features/auth/components/forgot-password-form.tsx");
const authActions = read("src/features/auth/components/auth-actions.tsx");

assert.ok(siteUrl.includes('DEFAULT_PUBLIC_SITE_URL = "https://creator-challenge-network.vercel.app"'), "production fallback must remain the configured public CCN origin");
assert.ok(siteUrl.includes('typeof window !== "undefined"'), "browser auth redirects must be able to use the active browser origin");
assert.ok(siteUrl.includes("window.location.origin"), "browser auth redirects must use the current app origin");
assert.ok(siteUrl.includes("if (isLoopbackOrigin(requestOrigin)) return requestOrigin"), "server auth redirects must preserve active localhost/loopback origins");
assert.ok(!siteUrl.includes("return isLoopbackOrigin(requestOrigin) ? DEFAULT_PUBLIC_SITE_URL : requestOrigin"), "loopback requests must not be rewritten to production");
assert.ok(!siteUrl.includes("http://localhost:3000"), "auth URL helper must not hardcode localhost:3000");
assert.ok(!siteUrl.includes("http://localhost:3001"), "auth URL helper must not hardcode localhost:3001");

assert.ok(signOut.includes("getRequestRedirectOrigin(request.url)"), "sign-out must derive redirect origin from the active request");
assert.ok(signOut.includes('new URL("/auth/sign-in", getRequestRedirectOrigin(request.url))'), "sign-out destination must stay on the active origin sign-in route");
assert.ok(!signOut.includes("localhost:3000"), "sign-out route must not hardcode localhost:3000");
assert.ok(!signOut.includes("localhost:3001"), "sign-out route must not hardcode localhost:3001");

assert.ok(forgotPassword.includes("resetPasswordForEmail"), "forgot-password flow must request Supabase recovery email");
assert.ok(forgotPassword.includes("getPublicSiteOrigin()"), "forgot-password flow must use shared browser-aware origin helper");
assert.ok(forgotPassword.includes("/auth/callback?type=recovery"), "forgot-password redirect must return through recovery callback");
assert.ok(forgotPassword.includes('next=${encodeURIComponent("/auth/update-password")}'), "forgot-password redirect must preserve update-password destination");
assert.ok(!forgotPassword.includes("localhost:3000"), "forgot-password flow must not hardcode localhost:3000");
assert.ok(!forgotPassword.includes("localhost:3001"), "forgot-password flow must not hardcode localhost:3001");

assert.ok(authActions.includes("getPublicSiteOrigin()"), "signup, OTP, and OAuth redirects must use shared browser-aware origin helper");
assert.ok(authActions.includes("emailRedirectTo"), "email signup/OTP redirects must remain explicit");
assert.ok(authActions.includes("redirectTo"), "OAuth redirects must remain explicit");

assert.ok(callback.includes("safeCallbackType"), "callback route must preserve typed recovery handling");
assert.ok(callback.includes('callbackType === "recovery"'), "callback route must branch recovery links");
assert.ok(callback.includes('"/auth/update-password"'), "callback route must send recovery sessions to update-password");
assert.ok(callback.includes("getRequestRedirectOrigin(request.url)"), "callback route must preserve active request origin for redirects");
assert.ok(!callback.includes("access_token"), "callback route must not expose access tokens");
assert.ok(!callback.includes("refresh_token"), "callback route must not expose refresh tokens");

console.log(JSON.stringify({
  result: "P0 auth redirect consistency static verification passed",
  logout: "request-origin-aware",
  localLoopback: "preserved",
  browserEmailRedirects: "current-origin-aware",
  recoveryCallback: "/auth/callback?type=recovery",
  productionFallback: "https://creator-challenge-network.vercel.app",
}, null, 2));
