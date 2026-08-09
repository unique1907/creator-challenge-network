import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const authActionsPath = "src/features/auth/components/auth-actions.tsx";
const accountRoutePath = "src/app/api/account/current/route.ts";
const serverClientPath = "src/services/supabase/server.ts";
const browserClientPath = "src/services/supabase/browser.ts";
const creatorSessionPath = "src/services/creator-session.server.ts";
const ccnAuthPath = "src/services/auth/ccn-auth.server.ts";
const packagePath = "package.json";

const authActions = read(authActionsPath);
const accountRoute = read(accountRoutePath);
const serverClient = read(serverClientPath);
const browserClient = read(browserClientPath);
const creatorSession = read(creatorSessionPath);
const ccnAuth = read(ccnAuthPath);
const packageJson = read(packagePath);

const sessionMessage = 'return "Your session could not be created. Please try logging in again.";';
const sessionIndex = authActions.indexOf('lower.includes("session")');
const rateLimitIndex = authActions.indexOf('lower.includes("rate limit")');
const passwordIndex = authActions.indexOf('lower.includes("password")');
const emailNotConfirmedIndex = authActions.indexOf('lower.includes("email not confirmed")');
const invalidIndex = authActions.indexOf('lower.includes("invalid")');

assert.ok(authActions.includes(sessionMessage), "Missing Supabase/browser session must still produce the safe session-created error.");
assert.ok(sessionIndex > -1, "Session-specific classifier must exist.");
assert.ok(!authActions.includes('lower.includes("session") || lower.includes("auth")'), "Generic AuthApiError class names must not be classified as session creation failures.");
assert.ok(rateLimitIndex > sessionIndex, "Rate-limit errors must still be handled after session-specific failures.");
assert.ok(passwordIndex > sessionIndex, "Password errors must remain visible and not become session failures.");
assert.ok(emailNotConfirmedIndex > sessionIndex, "Unconfirmed email must get a specific safe message.");
assert.ok(invalidIndex > sessionIndex, "Invalid credentials must remain visible and not become session failures.");
assert.ok(authActions.includes("if (signInError) throw signInError;"), "signInWithPassword must not swallow Supabase AuthApiError.");
assert.ok(authActions.includes("if (!data.session || !data.user)"), "signInWithPassword must fail if Supabase returns no user/session.");
assert.ok(authActions.includes("if (!sessionData.session)"), "signInWithPassword must verify browser session persistence.");
assert.ok(authActions.includes("currentAccount({ requireAuthenticated: true })"), "signInWithPassword must verify server-side account/session resolution before redirect.");
assert.ok(authActions.includes("credentials: \"same-origin\""), "account/current fetch must send auth cookies.");
assert.ok(authActions.includes('lower.includes("authentication_required")'), "Server auth-required responses during post-login resolution must remain visible as session/cookie failures.");
assert.ok(authActions.includes("Object.assign(accountError, { code: body.error?.code, status: response.status })"), "Client account resolution must preserve server auth error code/status.");

assert.ok(browserClient.includes("createBrowserClient"), "Browser auth must use Supabase SSR browser client.");
assert.ok(serverClient.includes("createServerClient"), "Server auth must use Supabase SSR server client.");
assert.ok(serverClient.includes("cookieStore.getAll()"), "Server client must read Supabase auth cookies.");
assert.ok(serverClient.includes("cookieStore.set(name, value, options)"), "Server client must support cookie writes in route handlers.");
assert.ok(accountRoute.includes("supabase.auth.getUser()"), "account/current must verify the server-visible Supabase user.");
assert.ok(accountRoute.includes("getSafeCurrentAccount(data.user)"), "account/current must resolve canonical CCN account state.");
assert.ok(accountRoute.includes("isMissingAuthSessionError"), "account/current must classify missing Supabase sessions explicitly.");
assert.ok(accountRoute.includes("authRequiredResponse()"), "account/current must return the 401 auth-required contract for missing sessions.");
assert.ok(creatorSession.includes('getAuthenticatedCcnContext({ workspace: "creator", allowTestContext: false })'), "Creator dashboard must use real server-side Creator auth context.");
assert.ok(ccnAuth.includes("resolveOrCreateCcnAccount(data.user)"), "Server auth context must resolve the canonical CCN account.");
assert.ok(ccnAuth.includes("creatorAccess: primaryRole === \"creator\""), "Creator role must remain server-derived.");
assert.ok(packageJson.includes("test:p0-final-creator-session-creation-blocker"), "Regression verifier must be registered.");

console.log("P0 final Creator session creation blocker verifier passed.");
