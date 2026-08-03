import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function includes(path, expected, message) {
  assert(read(path).includes(expected), `${message}: missing ${expected}`);
}

const header = "src/components/layout/site-header.tsx";
const headerAuth = "src/components/layout/site-auth-actions.tsx";
const landing = "src/features/landing/components/final-landing-page.tsx";
const signInPage = "src/app/auth/sign-in/page.tsx";
const signUpPage = "src/app/auth/sign-up/page.tsx";
const signUpEntry = "src/features/auth/components/sign-up-entry.tsx";
const authActions = "src/features/auth/components/auth-actions.tsx";
const callback = "src/app/auth/callback/route.ts";

includes(header, 'href: "/#for-brands"', "Header For Brands link must preserve a public landing anchor");
includes(header, '<div aria-label="Authentication" className="hidden items-center gap-3 lg:flex">', "Desktop Log In and Sign Up must be grouped separately from main navigation");
includes(header, '<div aria-label="Authentication" className="mt-3 border-t border-white/10 pt-3">', "Mobile auth actions must stay grouped together");
includes(headerAuth, 'href="/auth/sign-in"', "Header Sign In must route to auth sign-in");
includes(headerAuth, 'href="/auth/sign-up"', "Header Sign Up must route to auth sign-up");
includes(headerAuth, "function actionForSession", "Logged-in header must derive one canonical workspace action from resolved role state");
includes(headerAuth, 'fetch("/api/account/current"', "Header auth state must use canonical account role resolution");
includes(headerAuth, 'response.status === 401', "Header must treat missing sessions as anonymous");
includes(headerAuth, "const authenticatedAction = actionForSession(sessionState)", "Header auth state must hide anonymous actions only for resolved role actions");
includes(headerAuth, 'href: "/dashboard/creator", label: "Creator Workspace"', "Creator accounts must route to Creator Workspace");
includes(headerAuth, 'href: "/dashboard", label: "Brand Workspace"', "Brand accounts must route to Brand Workspace");
includes(headerAuth, "Log In", "Anonymous header must show Log In");
includes(headerAuth, "Creator Workspace", "Creator header must show Creator Workspace");
includes(landing, "Discover the", "Landing must use the approved first-view headline");
includes(landing, "World&apos;s Best", "Landing must use the approved first-view headline");
includes(landing, 'href: "/auth/sign-up?role=brand"', "Landing Brand CTA must start role-first sign-up");
includes(landing, 'href: "/auth/sign-up?role=creator"', "Landing Creator CTA must start role-first sign-up");
includes(landing, 'href: "/challenges"', "Landing public CTA must route to public challenges");
includes(signInPage, "Welcome back", "Sign-in page must use returning-user title");
includes(signInPage, "signUpPath({ role, nextPath })", "Sign-in page must link to sign-up while preserving safe role and next path");
includes(signInPage, 'href="/"', "Sign-in page must include Back to home");
includes(signUpPage, "SignUpEntry", "Sign-up route must render role-first entry component");
includes(signUpPage, 'value === "brand" || value === "creator"', "Sign-up route must ignore invalid role query values");
includes(signUpEntry, "How will you use CCN?", "Sign-up must ask the locked role question");
includes(signUpEntry, 'id: "brand"', "Brand role option must exist");
includes(signUpEntry, 'id: "creator"', "Creator role option must exist");
includes(signUpEntry, 'role="radiogroup"', "Role selection must use accessible selection semantics");
includes(signUpEntry, 'role="radio"', "Role cards must use radio semantics");
includes(signUpEntry, "disabled={!selectedRole}", "Continue must be blocked until role selection");
includes(signUpEntry, "Back to role selection", "User must be able to change selected role");
includes(signUpEntry, "Create your Brand account", "Brand auth method title must exist");
includes(signUpEntry, "Create your Creator account", "Creator auth method title must exist");
includes(authActions, 'mode?: "sign-in" | "sign-up"', "Auth actions must support sign-in and sign-up modes");
includes(authActions, "Continue with Email", "Sign-up auth method must label email as Continue with Email");
includes(authActions, "NEXT_PUBLIC_AUTH_GOOGLE_ENABLED", "Google visibility must remain environment-gated");
includes(authActions, "NEXT_PUBLIC_AUTH_GITHUB_ENABLED", "GitHub visibility must remain environment-gated");
assert(!read(authActions).includes("apple"), "Apple auth must not be shown or implemented in this sprint");
assert(!read(authActions).toLowerCase().includes("wallet"), "Wallet must not be shown as an auth method");
includes(authActions, "buildCallbackPath", "Auth entry must preserve safe role intent through callback URL");
includes(authActions, 'role === "brand" || role === "creator"', "Auth entry must accept only supported role intent values");
includes(authActions, "startsWith(\"//\")", "Auth entry must reject open-redirect style next paths");
includes(callback, "safePath", "Callback must validate next path");
includes(callback, "safeRole", "Callback must validate role intent");
includes(callback, "resolveOrCreateCcnAccount", "Callback must route from canonical account state");
includes(callback, "account.is_brand === true", "Callback must read Brand authority from account");
includes(callback, "account.is_creator === true", "Callback must read Creator authority from account");
assert(!read(callback).includes("is_brand: true"), "Callback must not grant Brand role from browser intent");
assert(!read(callback).includes("is_creator: true"), "Callback must not grant Creator role from browser intent");
includes(callback, "startsWith(\"//\")", "Callback must reject open redirects");
includes(callback, "setupPath", "No-role state must go to safe setup continuation");
includes("src/app/auth/sign-out/route.ts", "supabase.auth.signOut()", "Existing sign-out route must remain intact");

console.log("UX-01A/01B auth entry verification passed.");
