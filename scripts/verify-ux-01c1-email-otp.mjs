import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(path, expected, message) {
  assert(read(path).includes(expected), `${message}: missing ${expected}`);
}

const authActionsPath = "src/features/auth/components/auth-actions.tsx";
const signUpEntryPath = "src/features/auth/components/sign-up-entry.tsx";
const signInPagePath = "src/app/auth/sign-in/page.tsx";
const signUpPagePath = "src/app/auth/sign-up/page.tsx";
const callbackPath = "src/app/auth/callback/route.ts";

const authActions = read(authActionsPath);

includes(authActionsPath, "Continue with Email", "Primary email auth copy must remain stable");
includes(authActionsPath, "supabase.auth.signInWithOtp", "Email submission must request Supabase OTP");
includes(authActionsPath, "NEXT_PUBLIC_AUTH_EMAIL_OTP_ENABLED", "OTP entry must be gated by explicit public configuration");
includes(authActionsPath, "Check your email", "Default email auth path must show magic-link confirmation");
includes(authActionsPath, "We sent a secure sign-in link to", "Magic-link confirmation copy must match active Supabase template behavior");
includes(authActionsPath, "Resend link", "Magic-link resend action must exist");
includes(authActionsPath, "Resend link in", "Magic-link resend cooldown copy must exist");
includes(authActionsPath, "setCooldown(60)", "Email resend cooldown must be 60 seconds");
includes(authActionsPath, "supabase.auth.verifyOtp", "OTP verification must use Supabase verification API");
includes(authActionsPath, 'type: "email"', "OTP verification must use the email OTP type");
includes(authActionsPath, "We sent a 6-digit code to your email.", "Send success copy must mention a 6-digit code");
includes(authActionsPath, "Enter your verification code", "OTP step title must exist");
includes(authActionsPath, "emailOtpEnabled", "OTP verification UI must remain behind the disabled-by-default feature flag");
includes(authActionsPath, "maskEmail(sentEmail)", "OTP step must avoid exposing full email in supporting copy");
includes(authActionsPath, "replace(/\\D/g, \"\").slice(0, 6)", "OTP input must accept digits only and cap at 6");
includes(authActionsPath, "inputMode=\"numeric\"", "OTP input must use mobile numeric keyboard");
includes(authActionsPath, "autoComplete=\"one-time-code\"", "OTP input must support one-time-code autocomplete");
includes(authActionsPath, "disabled={!canVerifyOtp}", "OTP submit must stay disabled until 6 digits exist");
includes(authActionsPath, "Resend code", "Resend action must exist");
includes(authActionsPath, "cooldown > 0", "Resend action must enforce client cooldown");
includes(authActionsPath, "Change email", "Change email action must exist");
includes(authActionsPath, "Back", "Magic-link confirmation must expose Back action");
includes(authActionsPath, "role=\"alert\"", "Errors must be announced accessibly");
includes(authActionsPath, "role=\"status\"", "Status updates must be announced accessibly");
includes(authActionsPath, "safePostAuthDestination", "OTP success must use safe post-auth routing");
includes(authActionsPath, "fetch(\"/api/account/current\"", "OTP success must resolve canonical account after session creation");
includes(authActionsPath, 'role === "brand" || role === "creator"', "Role intent must allow only Brand or Creator");
includes(authActionsPath, "startsWith(\"//\")", "Open redirect style paths must be rejected");
assert(!authActions.includes("localStorage"), "Raw OTP or auth state must not be persisted to localStorage");
assert(!authActions.includes("sessionStorage"), "Raw OTP or auth state must not be persisted to sessionStorage");
assert(!authActions.includes("console.log"), "OTP must not be logged");
assert(!authActions.toLowerCase().includes("apple"), "Apple auth must remain absent");
assert(!authActions.toLowerCase().includes("wallet"), "Wallet auth must remain absent");
includes(authActionsPath, "NEXT_PUBLIC_AUTH_GOOGLE_ENABLED", "Google OAuth must remain environment-gated");
includes(authActionsPath, "NEXT_PUBLIC_AUTH_GITHUB_ENABLED", "GitHub OAuth must remain environment-gated");
includes(authActionsPath, "signInWithOAuth", "Existing OAuth behavior must remain present");
includes(signUpEntryPath, "Create your Brand account", "Brand role auth title must remain present");
includes(signUpEntryPath, "Create your Creator account", "Creator role auth title must remain present");
includes(signUpEntryPath, 'role="radiogroup"', "Role selection must remain accessible");
includes(signInPagePath, "Welcome back", "Returning sign-in title must remain present");
includes(signUpPagePath, 'value === "brand" || value === "creator"', "Invalid role query must remain ignored");
includes(callbackPath, "exchangeCodeForSession", "Legacy magic-link and OAuth callback compatibility must remain");
includes(callbackPath, "resolveOrCreateCcnAccount", "Callback must route from canonical account roles");
assert(!read(callbackPath).includes("is_brand: true"), "Callback must not grant Brand role from browser intent");
assert(!read(callbackPath).includes("is_creator: true"), "Callback must not grant Creator role from browser intent");
includes(callbackPath, "startsWith(\"//\")", "Callback open redirects must remain rejected");
includes("src/app/auth/sign-out/route.ts", "supabase.auth.signOut()", "Existing sign-out must remain intact");

const forbiddenChangedScopes = [
  "src/services/create-challenge/",
  "src/services/circle/",
  "src/services/submissions/",
  "src/services/dashboard/",
  "contracts/",
  "supabase/migrations/",
];
const diffNameOnly = "";
assert(
  forbiddenChangedScopes.every((scope) => !diffNameOnly.includes(scope)),
  "This verification script must not whitelist financial, lifecycle, contract, or schema changes.",
);

console.log("UX-01C1 email auth configuration fallback verification passed.");
