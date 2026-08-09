import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const auth = read("src/services/auth/ccn-auth.server.ts");
const creatorFoundation = read("src/services/creator-foundation/creator-foundation.server.ts");
const callback = read("src/app/auth/callback/route.ts");
const signup = read("src/features/auth/components/sign-up-entry.tsx");
const signupPage = read("src/app/auth/sign-up/page.tsx");
const brandOnboardingPage = read("src/app/auth/onboarding/brand/page.tsx");
const brandOnboardingForm = read("src/features/auth/components/brand-onboarding/brand-onboarding-form.tsx");
const brandNavigation = read("src/features/dashboard/components/brand-workspace-navigation.tsx");
const creatorWorkspace = read("src/features/creator-workspace/components/creator-workspace.tsx");
const campaignWorkspace = read("src/features/dashboard/components/campaign-workspace.tsx");
const submissionLifecycle = read("src/services/submissions/canonical-challenge-lifecycle.server.ts");
const reviewScoreRoute = read("src/app/api/dashboard/review-score/route.ts");
const finalizeReviewRoute = read("src/app/api/dashboard/finalize-review/route.ts");
const migration = read("supabase/migrations/20260801100000_account_role_isolation_preflight.sql");
const remediationSql = read("supabase/operator/20260801110000_dual_role_brand_only_remediation.sql");
const constraintMigration = read("supabase/migrations/20260801120000_accounts_single_primary_role_constraint.sql");

assert.ok(auth.includes("DUAL_ROLE_ACCOUNT_NOT_ALLOWED"), "Auth context must reject dual-role accounts.");
assert.ok(auth.includes('brandAccess: primaryRole === "brand"'), "Brand access must come from canonical primary role.");
assert.ok(auth.includes('creatorAccess: primaryRole === "creator"'), "Creator access must come from canonical primary role.");
assert.ok(auth.includes('primaryRole: "brand"'), "Deterministic Brand test context must remain role-scoped.");
assert.ok(auth.includes('primaryRole: "creator"'), "Deterministic Creator test context must remain role-scoped.");

assert.ok(creatorFoundation.includes("primaryRoleForAccount"), "Creator Foundation must expose primary role derivation.");
assert.ok(creatorFoundation.includes("assertCanUseBrandRole(account)"), "Brand onboarding must reject Creator/dual-role accounts.");
assert.ok(creatorFoundation.includes("assertCanUseCreatorRole(account)"), "Creator onboarding must reject Brand/dual-role accounts.");
assert.ok(creatorFoundation.includes("is_creator: false"), "Brand onboarding must persist Brand-only flags.");
assert.ok(creatorFoundation.includes("is_creator: true, is_brand: false"), "Creator onboarding must persist Creator-only flags.");
assert.ok(creatorFoundation.includes("DUAL_ROLE_REMEDIATION_REQUIRED"), "Creator Foundation must surface dual-role remediation errors.");

assert.ok(callback.includes("roleConflictPath"), "Auth callback must route opposite-role attempts to a safe conflict screen.");
assert.ok(callback.includes("if (input.isBrand) return roleConflictPath(\"brand\")"), "Existing Brand cannot claim Creator through role intent.");
assert.ok(callback.includes("if (input.isCreator) return roleConflictPath(\"creator\")"), "Existing Creator cannot claim Brand through role intent.");
assert.ok(signup.includes("Use a separate sign-in for the other role."), "Signup copy must reflect one immutable primary role.");
assert.ok(signup.includes('aria-required="true"'), "Signup role selection must be marked required.");
assert.ok(signupPage.includes("roleConflict"), "Signup page must display role-conflict copy.");
assert.ok(brandOnboardingPage.includes("Brand accounts must use a separate sign-in."), "Brand onboarding must explain Creator-role conflict.");
assert.ok(brandOnboardingForm.includes('aria-required="true"'), "Brand onboarding required fields must expose aria-required.");
assert.ok(brandOnboardingForm.includes("<FormLabel required>"), "Brand onboarding required fields must use the shared visible required marker.");

assert.ok(!brandNavigation.includes("Switch workspace"), "Brand account menu must not show Switch workspace.");
assert.ok(!brandNavigation.includes('href="/dashboard/creator"'), "Brand account menu must not link to Creator workspace.");
assert.ok(brandNavigation.includes("Brand Workspace"), "Brand account menu must include Brand Workspace.");
assert.ok(brandNavigation.includes("Profile"), "Brand account menu must include Profile.");
assert.ok(!brandNavigation.includes('href="/dashboard/wallet"'), "Brand account menu must not duplicate Wallet when Wallet remains in the sidebar.");
assert.ok(brandNavigation.includes("Settings"), "Brand account menu must include Settings.");
assert.ok(brandNavigation.includes("Company Settings"), "Brand account menu must include Company Settings.");
assert.ok(!creatorWorkspace.includes("Brand Workspace"), "Creator workspace header must not expose Brand Workspace switch.");
assert.ok(creatorWorkspace.includes('href="/" className="flex items-center gap-3"'), "Creator logo must link to the public landing page while staying in the Creator shell.");
assert.ok(!campaignWorkspace.includes('href="/dashboard/creator"'), "Campaign workspace must not link normal users to Creator workspace.");

assert.ok(submissionLifecycle.includes("assertCreatorIsNotChallengeOwner"), "Creator submission path must guard challenge owner self-submission.");
assert.ok(reviewScoreRoute.includes("Submission owners cannot review their own work."), "Review API must reject self-review for legacy dual-role data.");
assert.ok(finalizeReviewRoute.includes("Challenge owners cannot select their own submission as a winner."), "Winner finalization must reject owner self-selection for legacy data.");

assert.ok(migration.includes("add column if not exists account_role"), "Migration must add a canonical role projection.");
assert.ok(migration.includes("ccn_account_role_isolation_audit"), "Migration must provide an invalid-role audit view.");
assert.ok(migration.includes("dual_role"), "Migration audit view must classify dual-role rows.");
assert.ok(migration.includes("Apply only after dual-role rows are manually remediated"), "Constraint application must be gated by remediation.");
assert.ok(!migration.toLowerCase().includes(" drop "), "Migration must not drop data.");

assert.ok(remediationSql.includes("CCN_ROLE_REMEDIATION_TARGET_REQUIRED"), "Brand-only remediation must require an explicit approved target account.");
assert.ok(remediationSql.includes("TARGET_ACCOUNT_IS_NOT_DUAL_ROLE"), "Brand-only remediation must only update a dual-role account.");
assert.ok(remediationSql.includes("is_brand = true"), "Brand-only remediation must retain Brand role.");
assert.ok(remediationSql.includes("is_creator = false"), "Brand-only remediation must remove Creator access.");
assert.ok(!remediationSql.match(/\bdelete\s+from\b/i), "Brand-only remediation must not delete rows.");
assert.ok(!remediationSql.match(/ccn_creator_submissions\s+set/i), "Brand-only remediation must not transfer historical submissions.");
assert.ok(!remediationSql.match(/wallets\s+set/i), "Brand-only remediation must not transfer wallet records.");

assert.ok(constraintMigration.includes("DUAL_ROLE_ACCOUNTS_REMAIN"), "Hard constraint migration must fail safely while dual-role accounts remain.");
assert.ok(constraintMigration.includes("accounts_single_primary_role_check"), "Hard constraint migration must define the single-primary-role check.");
assert.ok(constraintMigration.includes("check (not (is_brand = true and is_creator = true))"), "Hard constraint must block dual-role accounts while preserving no-role onboarding.");
assert.ok(!constraintMigration.match(/\bdelete\s+from\b/i), "Hard constraint migration must not delete rows.");

console.log("Role isolation verification passed.");
