import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function includes(path, needle, message) {
  assert(read(path).includes(needle), message);
}

function excludes(path, needle, message) {
  assert(!read(path).includes(needle), message);
}

const publicDetail = "src/features/challenges/components/challenge-detail.tsx";
const legacySubmitRoute = "src/app/submit/[slug]/page.tsx";
const creatorChallengeRoute = "src/app/dashboard/creator/challenges/[slug]/page.tsx";
const signUpPage = "src/app/auth/sign-up/page.tsx";
const signInPage = "src/app/auth/sign-in/page.tsx";
const signUpEntry = "src/features/auth/components/sign-up-entry.tsx";
const authActions = "src/features/auth/components/auth-actions.tsx";
const callbackRoute = "src/app/auth/callback/route.ts";
const creatorOnboarding = "src/app/auth/onboarding/creator/page.tsx";
const creatorActions = "src/features/creator-workspace/components/creator-actions.tsx";
const creatorSession = "src/services/creator-session.server.ts";
const lifecycle = "src/services/submissions/canonical-challenge-lifecycle.server.ts";
const draftApi = "src/app/api/creator/submissions/draft/route.ts";
const finalizeApi = "src/app/api/creator/submissions/finalize/route.ts";

includes(publicDetail, "Sign in to submit", "Public challenge detail must keep the Creator submission CTA copy.");
includes(publicDetail, "href={\`/dashboard/creator/challenges/", "Public challenge CTA must target the canonical Creator Workspace challenge route.");
excludes(publicDetail, "href={\`/submit/", "Public challenge CTA must not target the legacy /submit route.");
excludes(publicDetail, "Manage Challenge", "Public detail must not expose a Brand management CTA to normal visitors.");
excludes(publicDetail, "/api/internal/submissions", "Public detail must not expose internal submission APIs.");

includes(legacySubmitRoute, "getPublishedCreateChallengeDraftBySlug", "Legacy submit route must still validate published challenge slugs.");
includes(legacySubmitRoute, "redirect(\`/dashboard/creator/challenges/", "Legacy submit route must redirect to the canonical Creator Workspace challenge route.");
includes(legacySubmitRoute, "encodeURIComponent(resolved.challenge.slug)", "Legacy submit redirect must encode the canonical slug.");
excludes(legacySubmitRoute, "CreatorSubmissionSpikeClient", "Legacy submit route must not mount the spike submission UI.");
excludes(legacySubmitRoute, "/api/internal/submissions", "Legacy submit route must not expose internal submission APIs.");

includes(creatorChallengeRoute, "getCreatorSession", "Canonical Creator challenge route must resolve server-derived Creator session.");
includes(creatorChallengeRoute, "redirect(creatorSignUpPath(returnTo))", "Unauthenticated Creator challenge route must route to role-first sign-up with return path.");
includes(creatorChallengeRoute, "new URLSearchParams({ role: \"creator\", next: returnTo })", "Creator challenge route must preserve exact canonical destination through auth.");
includes(creatorChallengeRoute, "getCreatorChallengeDetail(decodeURIComponent(slug), session)", "Creator challenge detail must use canonical Creator Workspace loader.");

includes(signUpPage, "next?: string", "Sign-up page must read a next search parameter.");
includes(signUpPage, "safeNextPath(params?.next)", "Sign-up page must reject unsafe external next paths.");
includes(signUpPage, "<SignUpEntry initialRole={role} nextPath={nextPath} />", "Sign-up page must pass safe next path to role-first entry.");
includes(signUpPage, "signInPath({ role, nextPath })", "Sign-up to sign-in switch must preserve safe role and next path.");

includes(signInPage, "next?: string", "Sign-in page must read a next search parameter.");
includes(signInPage, "safeNextPath(params?.next)", "Sign-in page must reject unsafe external next paths.");
includes(signInPage, "<AuthActions mode=\"sign-in\" roleIntent={role} nextPath={nextPath} />", "Sign-in page must pass role and next into AuthActions.");
includes(signInPage, "signUpPath({ role, nextPath })", "Sign-in to sign-up switch must preserve safe role and next path.");

includes(signUpEntry, "safeRoleNextPath", "Role-first sign-up must choose role-compatible return paths.");
includes(signUpEntry, "role === \"creator\" && nextPath.startsWith(\"/dashboard/creator\")", "Creator role must only accept Creator Workspace return paths.");
includes(signUpEntry, "role === \"brand\" && (nextPath === \"/dashboard\" || nextPath.startsWith(\"/dashboard/\"))", "Brand role must only accept Brand dashboard return paths.");

includes(authActions, "if (!nextPath || !nextPath.startsWith(\"/\") || nextPath.startsWith(\"//\")) return \"/dashboard\"", "AuthActions must reject unsafe external return paths.");
excludes(authActions, "next.startsWith(\"/submit/\")", "AuthActions must not preserve legacy /submit return paths.");
includes(authActions, "buildCallbackPath({ nextPath, roleIntent })", "Email and OAuth auth must use the safe callback path builder.");

includes(callbackRoute, "creatorOnboardingPath(input.next)", "Auth callback must preserve Creator return path through onboarding.");
includes(callbackRoute, "next?.startsWith(\"/dashboard/creator\")", "Creator onboarding redirect must only preserve Creator Workspace paths.");
excludes(callbackRoute, "next.startsWith(\"/submit/\")", "Auth callback must not route authenticated users back to legacy /submit.");
includes(callbackRoute, "if (input.roleIntent === \"creator\")", "Callback must honor Creator role intent.");
includes(callbackRoute, "if (input.isBrand) return roleConflictPath(\"brand\")", "Brand accounts must fail closed when attempting Creator role intent.");

includes(creatorOnboarding, "safeCreatorReturnPath", "Creator onboarding must validate its return path.");
includes(creatorOnboarding, "redirect(returnTo)", "Completed Creator onboarding must return to the preserved destination.");
includes(creatorOnboarding, "returnTo={returnTo}", "Creator wallet setup must receive the preserved return destination.");
includes(creatorActions, "completeCreatorWalletSetup(returnTo)", "Creator wallet setup must navigate to the preserved canonical destination after verification.");
includes(creatorActions, "returnTo?.startsWith(\"/dashboard/creator\")", "Creator wallet completion must fail closed to Creator Workspace paths only.");

includes(creatorSession, "getAuthenticatedCcnContext({ workspace: \"creator\", allowTestContext: false })", "Creator session must use server-side Creator workspace auth context.");
includes(creatorSession, "authContext?.creatorAccess", "Brand-only accounts must not satisfy Creator session access.");
includes(draftApi, "requireCreatorSession", "Canonical draft submission API must require server-side Creator session.");
includes(finalizeApi, "requireCreatorSession", "Canonical finalize submission API must require server-side Creator session.");
includes(lifecycle, "getVerifiedCreatorPayoutMapping(input.creatorAccountId)", "Submission validation must use server-derived Creator payout source.");
excludes(draftApi, "creatorAccountId: body", "Draft API must not trust client-supplied Creator account ID.");
excludes(finalizeApi, "creatorAccountId: body", "Finalize API must not trust client-supplied Creator account ID.");

console.log("UX-01 creator entry canonical verification passed.");
