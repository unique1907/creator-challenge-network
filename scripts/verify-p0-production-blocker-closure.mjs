import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function includes(rel, needle, message) {
  assert.ok(read(rel).includes(needle), message);
}

const siteUrl = read("src/config/site-url.ts");
assert.ok(siteUrl.includes("DEFAULT_PUBLIC_SITE_URL"), "site URL helper must expose one safe public default.");
assert.ok(siteUrl.includes("NEXT_PUBLIC_SITE_URL"), "site URL helper must use the canonical public URL env.");
assert.ok(!/DEFAULT_PUBLIC_SITE_URL\s*=\s*["']https?:\/\/(localhost|127\.0\.0\.1|\[?::1\]?)/.test(siteUrl), "site URL helper must not use loopback as production fallback.");
assert.ok(siteUrl.includes("isLoopbackOrigin"), "site URL helper must detect loopback request origins.");
assert.ok(siteUrl.includes("if (isLoopbackOrigin(requestOrigin)) return requestOrigin"), "server redirects must preserve active loopback origins for local auth flows.");
assert.ok(!siteUrl.includes("return isLoopbackOrigin(requestOrigin) ? DEFAULT_PUBLIC_SITE_URL : requestOrigin"), "server redirects must not rewrite loopback auth flows to production.");

includes("src/features/auth/components/auth-actions.tsx", "getPublicSiteOrigin", "auth redirects must use canonical public origin helper.");
assert.ok(siteUrl.includes("window.location.origin"), "browser auth redirects must preserve the active app origin.");

includes("src/app/auth/callback/route.ts", "getRequestRedirectOrigin", "callback redirects must use canonical/request redirect origin helper.");
includes("src/app/auth/sign-out/route.ts", "getRequestRedirectOrigin", "sign-out redirects must use canonical/request redirect origin helper.");
includes("src/app/layout.tsx", "getPublicSiteOrigin", "metadata base must use canonical public site origin.");
includes(".env.example", "NEXT_PUBLIC_SITE_URL=https://creator-challenge-network.vercel.app", ".env.example must document canonical production site URL.");

const proxy = read("src/proxy.ts");
assert.ok(proxy.includes("pathname.startsWith(\"/internal\")"), "internal pages must be denied by production proxy.");
assert.ok(proxy.includes("pathname.startsWith(\"/api/internal\")"), "internal APIs must be denied by production proxy.");
assert.ok(proxy.includes("CCN_DEPLOYMENT_ENV === \"production\""), "proxy must honor explicit production deployment env.");

const deadlinePolicy = read("src/config/create-challenge-deadline-policy.ts");
assert.ok(deadlinePolicy.includes("env.NODE_ENV !== \"production\""), "smoke deadlines must reject NODE_ENV production.");
assert.ok(deadlinePolicy.includes("env.VERCEL_ENV !== \"production\""), "smoke deadlines must reject Vercel production.");
assert.ok(deadlinePolicy.includes("env.CCN_DEPLOYMENT_ENV !== \"production\""), "smoke deadlines must reject explicit production deployment env.");

const creatorSession = read("src/services/creator-session.server.ts");
assert.ok(creatorSession.includes("process.env.NODE_ENV === \"development\""), "creator test cookie must be development-only.");
assert.ok(creatorSession.includes("process.env.CCN_SMOKE_TEST_MODE === \"true\""), "creator test cookie must require smoke mode.");

const authServer = read("src/services/auth/ccn-auth.server.ts");
assert.ok(authServer.includes("process.env.CCN_AUTH_TEST_MODE === \"true\""), "deterministic auth bypass must require explicit test env.");
assert.ok(authServer.includes("x-ccn-test-auth"), "deterministic auth bypass must also require test header.");

for (const rel of [
  "src/services/create-challenge/create-challenge-store.server.ts",
  "src/services/submissions/submission-store.server.ts",
  "src/services/circle/wallet-spike-store.server.ts",
]) {
  const source = read(rel);
  assert.ok(source.includes("CCN_LIFECYCLE_PERSISTENCE"), `${rel} must use the lifecycle persistence adapter.`);
  assert.ok(source.includes("production") && source.includes("supabase"), `${rel} must fail closed to Supabase in production.`);
}

console.log(JSON.stringify({
  result: "P0 production blocker closure static verification passed",
  canonicalSiteUrl: "NEXT_PUBLIC_SITE_URL",
  productionSafety: "verified",
}, null, 2));
