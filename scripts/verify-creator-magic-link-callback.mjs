import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const callback = read("src/app/auth/callback/route.ts");
const creatorOnboarding = read("src/app/auth/onboarding/creator/page.tsx");
const authActions = read("src/features/auth/components/auth-actions.tsx");
const signIn = read("src/app/auth/sign-in/page.tsx");
const proxy = read("src/proxy.ts");

assert.equal(
  (callback.match(/exchangeCodeForSession/g) ?? []).length,
  1,
  "Callback must exchange the Supabase code exactly once.",
);
assert.ok(callback.includes("const code = url.searchParams.get(\"code\")"), "Callback must read the Supabase code.");
assert.ok(callback.includes("codePresent: Boolean(code)"), "Diagnostics must log only code presence.");
assert.ok(callback.includes("exchange-success"), "Diagnostics must log exchange success category.");
assert.ok(callback.includes("exchange-failure"), "Diagnostics must log exchange failure category.");
assert.ok(callback.includes("sessionPresent: Boolean(data.user)"), "Callback must verify session after code exchange.");
assert.ok(callback.includes("safePath(url.searchParams.get(\"next\"))"), "Callback must safely decode next path.");
assert.ok(callback.includes("return creatorOnboardingPath(input.next)"), "No-role Creator intent must route to Creator onboarding while preserving safe Creator return path.");
assert.ok(callback.includes("next?.startsWith(\"/dashboard/creator\")"), "Creator onboarding callback path must only preserve Creator Workspace destinations.");
assert.ok(callback.includes("if (input.isBrand) return roleConflictPath(\"brand\")"), "Existing Brand must not claim Creator through callback.");
assert.ok(callback.includes("callback_expired"), "Expired links must produce a specific clear error.");
assert.ok(!callback.includes("console.info(\"[ccn-auth-callback]\", { event, code"), "Callback must not log auth code.");
assert.ok(!callback.includes("access_token"), "Callback must not log access tokens.");
assert.ok(!callback.includes("refresh_token"), "Callback must not log refresh tokens.");
assert.ok(!callback.includes("cookie"), "Callback diagnostics must not log cookies.");
assert.ok(!callback.includes("email:"), "Callback diagnostics must not log email.");

assert.ok(creatorOnboarding.includes("CreatorPayoutWalletSetup"), "Creator onboarding route must reuse the existing Hosted Wallet setup component.");
assert.ok(creatorOnboarding.includes("resolveOrCreateCcnAccount"), "Creator onboarding route must resolve the canonical account.");
assert.ok(creatorOnboarding.includes("This account is registered as a Brand."), "Creator onboarding must block existing Brand accounts.");
assert.ok(creatorOnboarding.includes("redirect(returnTo)"), "Completed Creator accounts must route to the preserved Creator Workspace destination.");
assert.ok(creatorOnboarding.includes("does not start funding, payout, or settlement"), "Creator onboarding must not imply financial actions.");

assert.ok(authActions.includes('return "/auth/onboarding/creator"'), "Client OTP fallback must use the same Creator onboarding route.");
assert.ok(signIn.includes("callback_expired"), "Sign-in page must show a clear expired-link error.");
assert.ok(!proxy.includes("/auth/callback"), "Proxy must not intercept auth callback before cookie persistence.");

console.log("Creator magic-link callback verification passed.");
