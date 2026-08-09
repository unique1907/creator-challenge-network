import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(path, needle, message) {
  assert(read(path).includes(needle), message);
}

function excludes(path, needle, message) {
  assert(!read(path).includes(needle), message);
}

const publicDetail = "src/features/challenges/components/challenge-detail.tsx";
const creatorChallengeRoute = "src/app/dashboard/creator/challenges/[slug]/page.tsx";
const signInPage = "src/app/auth/sign-in/page.tsx";
const signUpPage = "src/app/auth/sign-up/page.tsx";
const signUpEntry = "src/features/auth/components/sign-up-entry.tsx";
const authActions = "src/features/auth/components/auth-actions.tsx";
const callbackRoute = "src/app/auth/callback/route.ts";
const creatorSession = "src/services/creator-session.server.ts";
const creatorActions = "src/features/creator-workspace/components/creator-actions.tsx";

includes(publicDetail, "Sign in to submit", "Public challenge must keep the locked CTA copy.");
includes(publicDetail, "creatorSignInPath(challenge.slug)", "Public challenge CTA must route unauthenticated visitors through normal sign-in.");
includes(publicDetail, "new URLSearchParams({ role: \"creator\", next: returnTo })", "Public challenge CTA must preserve Creator role intent and intended challenge.");
includes(publicDetail, "`/auth/sign-in?${params.toString()}`", "Public challenge CTA must use /auth/sign-in.");
excludes(publicDetail, "href={`/dashboard/creator/challenges/${challenge.slug}`}", "Public challenge CTA must not directly enter the protected Creator route.");
excludes(publicDetail, "Continue as Demo Creator", "Public challenge detail must not expose demo-creator infrastructure.");

includes(creatorChallengeRoute, "redirect(creatorSignInPath(returnTo))", "Protected Creator challenge fallback must use normal sign-in.");
includes(creatorChallengeRoute, "new URLSearchParams({ role: \"creator\", next: returnTo })", "Protected fallback must preserve the exact Creator challenge destination.");
includes(creatorChallengeRoute, "`/auth/sign-in?${params.toString()}`", "Protected fallback must target shared sign-in.");

includes(signInPage, "safeNextPath(params?.next)", "Sign-in page must sanitize next before passing it into auth.");
includes(signInPage, "signUpPath({ role, nextPath })", "Create account link must preserve Creator role and safe next path.");
includes(signInPage, "<AuthActions mode=\"sign-in\" roleIntent={role} nextPath={nextPath}", "Sign-in form must preserve Creator intent and return path.");

includes(signUpPage, "safeNextPath(params?.next)", "Sign-up page must sanitize next before role setup.");
includes(signUpPage, "<SignUpEntry initialRole={role} nextPath={nextPath} />", "Sign-up entry must receive Creator role intent and safe next path.");
includes(signUpEntry, "role === \"creator\" && nextPath.startsWith(\"/dashboard/creator\")", "Creator signup must only preserve Creator Workspace return paths.");

includes(authActions, "if (!nextPath || !nextPath.startsWith(\"/\") || nextPath.startsWith(\"//\")) return \"/dashboard\"", "AuthActions must reject external or protocol-relative next URLs.");
includes(authActions, "if (roleIntent === \"creator\" && isBrand && !isCreator) return roleConflictPath(\"brand\")", "Brand-only accounts must not bypass Creator role isolation.");
includes(authActions, "if (next.startsWith(\"/dashboard/creator\") && isCreator) return next", "Existing Creators must return to the intended challenge after login.");
includes(authActions, "buildCallbackPath({ nextPath, roleIntent })", "OAuth/email auth must preserve safe next through the existing callback.");

includes(callbackRoute, "creatorOnboardingPath(input.next)", "Callback must preserve intended Creator challenge through onboarding.");
includes(callbackRoute, "if (input.isBrand) return roleConflictPath(\"brand\")", "Callback must fail closed for Brand-only accounts with Creator intent.");
includes(callbackRoute, "next?.startsWith(\"/dashboard/creator\")", "Callback must only preserve Creator Workspace next paths for Creator onboarding.");

includes(creatorSession, "allowTestContext: false", "Production Creator session must not use demo context as primary auth.");
includes(creatorActions, "Continue as Creator", "Development creator mechanism may remain available for explicit test infrastructure with production-safe label.");

console.log("P0 public challenge Creator auth entry verifier passed.");
