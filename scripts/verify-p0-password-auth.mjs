import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => assert.ok(fs.existsSync(path.join(root, relativePath)), `${relativePath} must exist`);
const includes = (file, text, message) => assert.ok(read(file).includes(text), message);
const excludes = (file, text, message) => assert.ok(!read(file).includes(text), message);

const authActionsPath = "src/features/auth/components/auth-actions.tsx";
const signupEntryPath = "src/features/auth/components/sign-up-entry.tsx";
const signinPagePath = "src/app/auth/sign-in/page.tsx";
const signupPagePath = "src/app/auth/sign-up/page.tsx";
const callbackPath = "src/app/auth/callback/route.ts";
const forgotPagePath = "src/app/auth/forgot-password/page.tsx";
const updatePagePath = "src/app/auth/update-password/page.tsx";
const forgotFormPath = "src/features/auth/components/forgot-password-form.tsx";
const updateFormPath = "src/features/auth/components/update-password-form.tsx";
const creatorFoundationPath = "src/services/creator-foundation/creator-foundation.server.ts";
const authServerPath = "src/services/auth/ccn-auth.server.ts";
const envExamplePath = ".env.example";

for (const file of [
  authActionsPath,
  signupEntryPath,
  signinPagePath,
  signupPagePath,
  callbackPath,
  forgotPagePath,
  updatePagePath,
  forgotFormPath,
  updateFormPath,
  creatorFoundationPath,
  authServerPath,
]) {
  exists(file);
}

includes(signinPagePath, "Welcome back", "login page must retain required heading");
includes(authActionsPath, "<FormLabel required>Email</FormLabel>", "password auth must render Email");
includes(authActionsPath, "<FormLabel required>Password</FormLabel>", "password auth must render Password");
includes(authActionsPath, "Log in", "password auth must render Log in button copy");
includes(authActionsPath, "Forgot password?", "password auth must expose Forgot password link");
includes(authActionsPath, "Create account", "password auth must link to Create account");
includes(authActionsPath, "supabase.auth.signInWithPassword", "primary login must use Supabase password auth");
includes(authActionsPath, "signInWithPassword()", "login button must call password login flow");
assert.ok(
  read(authActionsPath).indexOf("signInWithPassword()") < read(authActionsPath).indexOf("requestSecondaryEmailLink()"),
  "password login must appear before secondary email-link fallback",
);
includes(authActionsPath, "secondaryEmailLinkEnabled", "email-link fallback must be explicitly secondary and flag-gated");
includes(authActionsPath, "supabase.auth.signInWithOtp", "optional magic-link compatibility may remain under secondary options");
includes(authActionsPath, "Other sign-in options", "OTP must not be a competing primary login form");
excludes(authActionsPath, "verifyOtp", "primary auth UI must not expose OTP code verification");
excludes(authActionsPath, "Continue with Email", "ordinary login must not be magic-link-first");
excludes(authActionsPath, "Check your email", "ordinary login must not show check-email state");

includes(signupEntryPath, "Create your account", "signup page must show required heading");
includes(signupEntryPath, "Brand", "signup must offer Brand role");
includes(signupEntryPath, "Creator", "signup must offer Creator role");
includes(signupEntryPath, "aria-required=\"true\"", "signup role selection must be required");
includes(authActionsPath, "<FormLabel required>Confirm password</FormLabel>", "signup must require password confirmation");
includes(authActionsPath, "Password requirements: at least 8 characters", "signup must show password requirements");
includes(authActionsPath, "password !== confirmPassword", "signup must validate password confirmation");
includes(authActionsPath, "supabase.auth.signUp", "signup must use Supabase password signup");
includes(authActionsPath, "ccn_role_intent", "signup must pass role intent through Supabase metadata");
includes(authActionsPath, "finishPasswordAuth", "signup with immediate session must continue through canonical account resolution");
includes(authActionsPath, "/auth/onboarding/brand", "Brand signup must continue to Brand onboarding");
includes(authActionsPath, "/auth/onboarding/creator", "Creator signup must continue to Creator onboarding");

includes(forgotPagePath, "Set or reset password", "forgot-password route must exist for existing magic-link users");
includes(forgotFormPath, "resetPasswordForEmail", "forgot-password flow must use Supabase recovery email");
includes(forgotFormPath, "getPublicSiteOrigin", "forgot-password redirect must use canonical public origin");
includes(forgotFormPath, "/auth/callback?type=recovery", "password recovery must return through typed auth callback");
includes(updatePagePath, "Update password", "update-password route must exist");
includes(updateFormPath, "supabase.auth.updateUser({ password })", "update-password must use Supabase password update");
includes(updateFormPath, "expired or invalid", "update-password must show safe expired/invalid reset state");
includes(updateFormPath, "Password updated. Log in with your new password.", "update-password must show success state");

includes(callbackPath, "safeCallbackType", "callback must distinguish recovery from normal auth");
includes(callbackPath, "callbackType === \"recovery\"", "callback must route recovery links separately");
includes(callbackPath, "/auth/update-password", "recovery callback must land on update-password");
includes(callbackPath, "getRequestRedirectOrigin", "callback must use production-safe redirect origin");
includes(callbackPath, "resolveOrCreateCcnAccount", "normal auth callback must preserve canonical account resolution");
includes(callbackPath, "roleConflictPath", "callback must preserve role-conflict handling");
excludes(callbackPath, "access_token", "callback must not log access tokens");
excludes(callbackPath, "refresh_token", "callback must not log refresh tokens");

includes(authActionsPath, "currentAccount()", "password login must call canonical account/current resolution");
includes(authActionsPath, "roleConflictPath(\"creator\")", "existing Creator in Brand flow must get role conflict");
includes(authActionsPath, "roleConflictPath(\"brand\")", "existing Brand in Creator flow must get role conflict");
includes(creatorFoundationPath, "assertCanUseBrandRole(account)", "Brand onboarding must reject Creator accounts");
includes(creatorFoundationPath, "assertCanUseCreatorRole(account)", "Creator onboarding must reject Brand accounts");
includes(creatorFoundationPath, "is_creator: false", "Brand onboarding must persist Brand-only role");
includes(creatorFoundationPath, "is_creator: true, is_brand: false", "Creator onboarding must persist Creator-only role");
includes(authServerPath, "primaryRoleForAccount", "protected routes must derive access from canonical primary role");
includes(authServerPath, "brandAccess: primaryRole === \"brand\"", "Brand protected access must be server-derived");
includes(authServerPath, "creatorAccess: primaryRole === \"creator\"", "Creator protected access must be server-derived");
includes(authServerPath, "isProductionRuntime", "auth helper must retain production runtime guard");
includes(authServerPath, "x-ccn-test-auth", "test bypass must require deterministic header");
includes(authServerPath, "isNonProduction()", "test bypass must stay unavailable in production");

includes(envExamplePath, "NEXT_PUBLIC_AUTH_EMAIL_OTP_ENABLED=false", "email-link fallback must default off in env example");
excludes(authActionsPath, "localStorage", "auth UI must not use localStorage as auth truth");
excludes(authActionsPath, "sessionStorage", "auth UI must not use sessionStorage as auth truth");

const passwordLoggingPattern = /console\.(?:log|info|warn|error)\([^)]*password/i;
for (const file of [authActionsPath, forgotFormPath, updateFormPath]) {
  assert.ok(!passwordLoggingPattern.test(read(file)), `${file} must not log password values`);
}

console.log(JSON.stringify({
  result: "P0 password authentication static verification passed",
  primaryLogin: "signInWithPassword",
  ordinaryLoginEmailSends: 0,
  passwordSignup: true,
  forgotPasswordRoute: "/auth/forgot-password",
  updatePasswordRoute: "/auth/update-password",
  roleIsolation: "canonical-account-derived",
  emailOtpPrimary: false,
  devAuthBypassProduction: false,
}, null, 2));
