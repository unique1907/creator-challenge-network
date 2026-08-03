import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(path, expected, message) {
  assert.ok(read(path).includes(expected), `${message}: missing ${expected}`);
}

const signUp = "src/app/auth/sign-up/page.tsx";
const signUpEntry = "src/features/auth/components/sign-up-entry.tsx";
const authActions = "src/features/auth/components/auth-actions.tsx";
const callback = "src/app/auth/callback/route.ts";
const onboardingPage = "src/app/auth/onboarding/brand/page.tsx";
const onboardingForm = "src/features/auth/components/brand-onboarding/brand-onboarding-form.tsx";
const onboardingRoute = "src/app/api/auth/onboarding/brand/route.ts";
const foundation = "src/services/creator-foundation/creator-foundation.server.ts";
const auth = "src/services/auth/ccn-auth.server.ts";
const dashboard = "src/features/dashboard/components/brand-dashboard.tsx";
const dashboardPage = "src/app/dashboard/page.tsx";
const createChallenge = "src/app/create-challenge/page.tsx";
const profile = "src/app/dashboard/settings/profile/page.tsx";
const company = "src/app/dashboard/settings/company/page.tsx";
const migration = "supabase/migrations/20260730143000_brand_onboarding_profile.sql";

includes(signUp, "SignUpEntry", "Sign-up page must render role-first entry");
includes(signUpEntry, 'id: "brand"', "Brand option must exist");
includes(signUpEntry, 'id: "creator"', "Creator option must exist");
includes(signUpEntry, 'role="radiogroup"', "Role selection must stay accessible");
includes(authActions, "signInWithOtp", "Email magic link must remain the primary supported auth method");
includes(authActions, "visibleOauthProviders", "Only enabled OAuth providers may render");
includes(authActions, "NEXT_PUBLIC_AUTH_GOOGLE_ENABLED", "Google must be env-gated");
includes(authActions, "NEXT_PUBLIC_AUTH_GITHUB_ENABLED", "GitHub must be env-gated");
includes(authActions, 'return "/auth/onboarding/brand"', "Brand OTP fallback must continue to Brand onboarding");
assert.ok(!read(authActions).toLowerCase().includes("wallet"), "Wallet auth must not be displayed");
assert.ok(!read(authActions).includes("localStorage"), "Auth flow must not persist role in localStorage");
assert.ok(!read(authActions).includes("sessionStorage"), "Auth flow must not persist role in sessionStorage");

includes(callback, "safeRole", "Callback must validate role intent");
includes(callback, "safePath", "Callback must validate next path");
includes(callback, 'roleIntent === "brand"', "Callback must recognize Brand intent");
includes(callback, '"/auth/onboarding/brand"', "Callback must route incomplete Brand users to onboarding");
assert.ok(!read(callback).includes("is_brand: true"), "Callback must not grant Brand role from browser intent");

includes(migration, "add column if not exists display_name", "Migration must add display name");
includes(migration, "add column if not exists brand_name", "Migration must add brand name");
includes(migration, "add column if not exists brand_onboarding_completed_at", "Migration must add Brand onboarding completion timestamp");

includes(foundation, "completeBrandOnboarding", "Server must expose Brand onboarding completion");
includes(foundation, ".update({", "Brand onboarding must persist via authenticated server path");
includes(foundation, "is_brand: true", "Brand onboarding completion must persist Brand role server-side");
includes(foundation, "BRAND_ONBOARDING_COMPLETED", "Brand onboarding must write an audit event");
includes(foundation, "This account is registered as a Creator. Brand accounts must use a separate sign-in.", "Creator-only accounts must fail closed");
includes(onboardingRoute, "completeBrandOnboarding", "Route must call server-side Brand onboarding service");
includes(onboardingRoute, "supabase.auth.getUser()", "Onboarding route must require authenticated Supabase user");
includes(onboardingPage, "resolveOrCreateCcnAccount", "Onboarding page must resolve canonical account");
includes(onboardingPage, "Brand access is not available", "Creator-only access must be blocked");
includes(onboardingPage, "redirect(\"/dashboard\")", "Completed onboarding must not loop");
includes(onboardingForm, "Display name", "Onboarding form must collect display name");
includes(onboardingForm, "Company / Brand name", "Onboarding form must collect Brand name");
includes(onboardingForm, "Enter Brand Workspace", "Onboarding form must have a working destination action");
assert.ok(!read(onboardingForm).toLowerCase().includes("wallet"), "Basic Brand onboarding must not ask for wallet");

includes(auth, "brandOnboardingComplete", "Auth context must derive Brand onboarding completion");
includes(auth, "brandName", "Auth context must expose Brand name safely");
includes(dashboardPage, "brandOnboardingComplete", "Dashboard must recover incomplete Brand onboarding");
includes(createChallenge, "brandOnboardingComplete", "Create Challenge must recover incomplete Brand onboarding");
includes(dashboardPage, "brandDisplayName: context.brandName", "Dashboard greeting must prefer onboarding Brand name");
includes(dashboard, "Launch your first creative challenge", "Empty Brand dashboard must show first-run title");
includes(dashboard, "Create your first challenge", "Empty Brand dashboard must show first-run CTA");
includes(dashboard, 'href="/create-challenge?new=1"', "First-run CTA must route to new challenge");
includes(profile, "Company / Brand name", "Profile must show canonical Brand name");
includes(company, "context.brandName", "Company settings must use onboarding Brand name before campaign fallback");

console.log("Sprint 005 Brand sign-up and onboarding verification passed.");
