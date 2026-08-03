import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.request(url, {
      method: options.method ?? "GET",
      headers: options.headers ?? {},
      timeout: options.timeout ?? 15000,
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on("timeout", () => {
      req.destroy(new Error(`Timed out requesting ${url}`));
    });
    req.on("error", reject);
    req.end();
  });
}

const auth = read("src/services/auth/ccn-auth.server.ts");
assert.ok(auth.includes("headers"), "auth helper must inspect request headers for deterministic tests");
assert.ok(auth.includes("x-ccn-test-auth"), "test fallback must require an explicit deterministic request header");
assert.ok(auth.includes("isDeterministicTestAuthRequest"), "test fallback must be isolated behind a named request gate");
assert.ok(auth.includes("await isDeterministicTestAuthRequest()"), "allowTestContext must not grant access without deterministic request proof");
assert.ok(!auth.includes("options.allowTestContext && options.workspace) {\n    const demo"), "legacy unconditional allowTestContext fallback must be removed");

const createChallenge = read("src/app/create-challenge/page.tsx");
assert.ok(createChallenge.includes("getAuthenticatedCcnContext({ workspace: \"brand\", allowTestContext: true })"), "Create Challenge must use the shared Brand auth guard path");
assert.ok(createChallenge.includes("redirect(\"/auth/sign-in\")"), "signed-out Create Challenge requests must redirect server-side");
assert.ok(createChallenge.includes("!context.brandAccess"), "authenticated non-Brand accounts must receive safe Brand denial");

const authActions = read("src/features/auth/components/auth-actions.tsx");
assert.ok(authActions.includes("NEXT_PUBLIC_AUTH_GOOGLE_ENABLED"), "Google visibility must be explicit env-driven");
assert.ok(authActions.includes("NEXT_PUBLIC_AUTH_GITHUB_ENABLED"), "GitHub visibility must be explicit env-driven");
assert.ok(authActions.includes("visibleOauthProviders"), "only enabled OAuth providers should be rendered");
assert.ok(authActions.includes("OAuth provider is not currently available."), "disabled OAuth errors must be safe");
assert.ok(authActions.includes("Please wait before requesting another email."), "email rate limit errors must be safe");
assert.ok(authActions.includes("signInWithOtp"), "email magic link must remain available");
assert.ok(authActions.indexOf("if (!providerConfig?.enabled)") < authActions.indexOf("signInWithOAuth({"), "disabled OAuth providers must be blocked before Supabase OAuth call");
assert.ok(!authActions.includes("Unsupported provider: provider is not enabled"), "raw unsupported provider text must not be rendered directly");
assert.ok(!authActions.includes("localStorage"), "auth UI must not introduce localStorage auth fallback");
assert.ok(!authActions.includes("sessionStorage"), "auth UI must not introduce sessionStorage auth fallback");

const envExample = read(".env.example");
assert.ok(envExample.includes("NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=false"), ".env.example must document disabled-by-default Google provider flag");
assert.ok(envExample.includes("NEXT_PUBLIC_AUTH_GITHUB_ENABLED=false"), ".env.example must document disabled-by-default GitHub provider flag");

const signOut = read("src/app/auth/sign-out/route.ts");
assert.ok(signOut.includes("supabase.auth.signOut()"), "sign-out must invalidate Supabase session");
assert.ok(signOut.includes("clearCreatorSession()"), "sign-out must clear the development Creator session cookie");

const runtimeUrl = process.env.CCN_SPRINT_08E_RUNTIME_URL;
let runtime = { checked: false };
if (runtimeUrl) {
  const blocked = await request(`${runtimeUrl.replace(/\/$/, "")}/create-challenge`, {
    headers: { accept: "text/html" },
  });
  const location = String(blocked.headers.location ?? "");
  const body = blocked.body;
  const blockedByRedirect = [301, 302, 303, 307, 308].includes(blocked.statusCode ?? 0) && location.includes("/auth/sign-in");
  const blockedBySigninPage = (blocked.statusCode === 200 && body.includes("Sign in to your workspace") && !body.includes("Start New Challenge"));
  assert.ok(blockedByRedirect || blockedBySigninPage, `signed-out /create-challenge must be blocked, got ${blocked.statusCode} ${location}`);
  assert.ok(!body.includes("Start New Challenge"), "signed-out Create Challenge must not render draft creation controls");
  runtime = {
    checked: true,
    url: runtimeUrl,
    statusCode: blocked.statusCode,
    location: location || null,
    startNewChallengeVisible: body.includes("Start New Challenge"),
  };
}

console.log(JSON.stringify({
  result: "Sprint 8E protected route/auth provider verification passed",
  createChallengeProtected: true,
  deterministicFallbackRequiresHeader: true,
  oauthProvidersDefaultDisabled: true,
  emailMagicLinkAvailable: true,
  browserStorageFallback: false,
  runtime,
}, null, 2));
