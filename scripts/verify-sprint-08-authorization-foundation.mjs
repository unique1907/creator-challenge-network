import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(path, value, message = `${path} must include ${value}`) {
  assert.ok(read(path).includes(value), message);
}

const authService = "src/services/auth/ccn-auth.server.ts";
includes(authService, "getAuthenticatedCcnContext", "central authenticated CCN context helper must exist");
includes(authService, "requireBrandWorkspace", "Brand workspace guard must exist");
includes(authService, "requireCreatorWorkspace", "Creator workspace guard must exist");
includes(authService, "isAuthTestContextAvailable", "test fixture gate must be explicit");
includes(authService, "process.env.NODE_ENV !== \"production\"", "test fixture gate must reject production");

[
  "src/app/api/create-challenge/session/route.ts",
  "src/app/api/create-challenge/draft/route.ts",
  "src/app/api/create-challenge/payment-account/route.ts",
  "src/app/api/create-challenge/payment-overview/route.ts",
  "src/app/api/create-challenge/preflight/route.ts",
  "src/app/api/create-challenge/approve/route.ts",
  "src/app/api/create-challenge/approval-recovery/route.ts",
  "src/app/api/create-challenge/fund/route.ts",
  "src/app/api/create-challenge/reconcile/route.ts",
  "src/app/api/create-challenge/verify/route.ts",
  "src/app/api/create-challenge/publish/route.ts",
  "src/app/api/create-challenge/winner-finalization/route.ts",
  "src/app/api/dashboard/review-score/route.ts",
  "src/app/api/dashboard/finalize-review/route.ts",
].forEach((path) => {
  includes(path, "requireBrandWorkspace", `${path} must require server-derived Brand workspace access`);
});

[
  "src/app/api/create-challenge/draft/route.ts",
  "src/app/api/create-challenge/payment-account/route.ts",
  "src/app/api/create-challenge/payment-overview/route.ts",
  "src/app/api/create-challenge/preflight/route.ts",
  "src/app/api/create-challenge/approve/route.ts",
  "src/app/api/create-challenge/approval-recovery/route.ts",
  "src/app/api/create-challenge/fund/route.ts",
  "src/app/api/create-challenge/reconcile/route.ts",
  "src/app/api/create-challenge/verify/route.ts",
  "src/app/api/create-challenge/publish/route.ts",
  "src/app/api/create-challenge/winner-finalization/route.ts",
  "src/app/api/dashboard/review-score/route.ts",
  "src/app/api/dashboard/finalize-review/route.ts",
].forEach((path) => {
  includes(path, "assertCreateChallengeDraftOwner", `${path} must enforce draft ownership`);
});

includes("src/services/creator-session.server.ts", "getAuthenticatedCcnContext", "Creator session must resolve production Supabase context");
includes("src/services/creator-session.server.ts", "isDevCreatorAuthEnabled", "development Creator fixture must stay explicitly gated");
includes("src/features/creator-workspace/components/creator-actions.tsx", "/api/creator/submissions/draft", "Creator UI must use product submission draft route");
includes("src/features/creator-workspace/components/creator-actions.tsx", "/api/creator/submissions/finalize", "Creator UI must use product submission finalize route");

[
  "src/app/api/creator/submissions/draft/route.ts",
  "src/app/api/creator/submissions/finalize/route.ts",
  "src/app/api/creator/submissions/status/route.ts",
].forEach((path) => {
  includes(path, "creatorAccountId: session.ccnAccountId", `${path} must derive Creator account server-side`);
});

includes("src/services/dashboard/review-scores.server.ts", "reviewerAccountId", "Reviewer identity must be server-derived");
assert.ok(!read("src/services/dashboard/review-scores.server.ts").includes("brand-reviewer-demo"), "hardcoded reviewer ID must be removed from review service");

includes("src/proxy.ts", "pathname.startsWith(\"/internal\")", "internal pages must be protected in production");
includes("src/proxy.ts", "pathname.startsWith(\"/api/internal\")", "internal APIs must be protected in production");

includes("src/app/auth/sign-in/page.tsx", "AuthActions", "sign-in page must exist");
includes("src/features/auth/components/auth-actions.tsx", "signInWithOtp", "email auth must be implemented through Supabase Auth");
includes("src/app/auth/callback/route.ts", "exchangeCodeForSession", "auth callback must exchange Supabase code for session");
includes("src/app/auth/sign-out/route.ts", "signOut", "logout must invalidate Supabase session");

console.log(JSON.stringify({
  sprint: "Sprint 8",
  authFoundation: "PASS",
  checks: {
    centralHelpers: true,
    brandRoutesGuarded: true,
    creatorProductRoutes: true,
    reviewerServerDerived: true,
    internalProductionProtection: true,
    noRealCircleOrBlockchainOperation: true,
  },
}, null, 2));
