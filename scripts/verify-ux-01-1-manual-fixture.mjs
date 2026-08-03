import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.CCN_TEST_BASE_URL ?? "http://localhost:3000";
const fixtureUrl = "/submit/manual-test-fixture";
const canonicalStore = ".local/create-challenge-flow.json";
const submissionStore = ".local/internal-submissions-spike.json";

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function hashIfExists(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return "missing";
  return createHash("sha256").update(fs.readFileSync(full)).digest("hex");
}

function assertIncludes(file, needle, message) {
  assert.ok(read(file).includes(needle), message);
}

function assertExcludes(file, needle, message) {
  assert.ok(!read(file).includes(needle), message);
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { text };
  }
  return { response, text, json };
}

async function postJson(pathname, body = {}, cookie = "") {
  return request(pathname, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function signIn() {
  const response = await postJson("/api/creator/session", { ccnAccountId: "ccn-test-creator-001" });
  assert.equal(response.response.status, 200, "Demo Creator sign-in must succeed in development smoke mode");
  const cookie = response.response.headers.get("set-cookie");
  assert.ok(cookie?.includes("ccn_creator_session="), "Creator session cookie must be set");
  return cookie.split(";")[0];
}

assertIncludes("src/services/submissions/manual-creator-fixture.server.ts", "NODE_ENV === \"development\"", "fixture must be development gated");
assertIncludes("src/services/submissions/manual-creator-fixture.server.ts", "CCN_SMOKE_TEST_MODE", "fixture must require smoke mode");
assertIncludes("src/services/submissions/manual-creator-fixture.server.ts", "noFundingIntent: true", "fixture must report no funding intent");
assertIncludes("src/services/submissions/manual-creator-fixture.server.ts", "noCircleOperation: true", "fixture must report no Circle operation");
assertIncludes("src/services/submissions/manual-creator-fixture.server.ts", "noPayoutEligibility: true", "fixture must report no payout eligibility");
assertIncludes("src/app/submit/manual-test-fixture/page.tsx", "notFound()", "fixture page must fail closed when disabled");
assertIncludes("src/features/creator-submission-spike/components/manual-creator-fixture-client.tsx", "Development manual test fixture", "fixture UI must label itself clearly");
assertExcludes("src/services/submissions/manual-creator-fixture.server.ts", "createProductFundingChallenge", "fixture must not import funding");
assertExcludes("src/services/submissions/manual-creator-fixture.server.ts", "createProductPayout", "fixture must not import payout");
assertExcludes("src/services/submissions/manual-creator-fixture.server.ts", "Circle SDK", "fixture must not use Circle SDK");

const canonicalBefore = hashIfExists(canonicalStore);
const submissionsBefore = hashIfExists(submissionStore);

const reset = await postJson("/api/internal/submissions/manual-fixture/reset");
assert.equal(reset.response.status, 200, "manual fixture reset must be available in development smoke mode");
assert.deepEqual(
  reset.json.cleared,
  ["manual fixture submission", "manual fixture uploaded assets", "manual fixture finalize keys"],
  "reset must clear only manual fixture fields and uploaded assets",
);

const page = await request(fixtureUrl);
assert.equal(page.response.status, 200, "manual fixture route must load in development smoke mode");
assert.ok(page.text.includes("Development manual test fixture"), "manual fixture label must render");
assert.ok(page.text.includes("Sign in required"), "unauthenticated form must remain gated");
assert.ok(!page.text.includes("Wallet ID"), "manual fixture UI must not show wallet ID metadata");
assert.ok(!page.text.includes("Circle user"), "manual fixture UI must not show Circle user metadata");

const unauth = await postJson("/api/internal/submissions/manual-fixture/draft", {
  title: "Blocked",
  description: "Blocked",
  primaryAssetUrl: "https://example.com/blocked",
  supportingLinks: [],
});
assert.equal(unauth.response.status, 401, "unauthenticated draft save must be rejected");

const cookie = await signIn();
const status = await postJson("/api/internal/submissions/manual-fixture/status", {}, cookie);
assert.equal(status.response.status, 200, "authenticated manual fixture status must succeed");
assert.equal(status.json.fixture.fixtureId, "manual-creator-ux-01-1");
assert.equal(status.json.challenge.publicationStatus, "manual-test-only");
assert.equal(status.json.challenge.fundingIntentId, undefined);
assert.equal(status.json.isolation.noFundingIntent, true);
assert.equal(status.json.isolation.noCircleOperation, true);
assert.equal(status.json.isolation.noPayoutEligibility, true);
assert.equal(status.json.isolation.noWinnerFinalization, true);

const invalid = await postJson("/api/internal/submissions/manual-fixture/draft", {
  title: "",
  description: "Missing title",
  primaryAssetUrl: "notaurl",
  supportingLinks: [],
}, cookie);
assert.equal(invalid.response.status, 400, "invalid manual fixture draft must be rejected");

const draft = await postJson("/api/internal/submissions/manual-fixture/draft", {
  title: "Manual Fixture Creator Entry",
  description: "A safe manual acceptance test entry for the Creator UX gate.",
  primaryAssetUrl: "https://example.com/manual-fixture-entry",
  supportingLinks: ["https://example.com/manual-fixture-support"],
}, cookie);
assert.equal(draft.response.status, 200, "valid manual fixture draft must save");
assert.equal(draft.json.submission.status, "DRAFT");
assert.equal(draft.json.submission.creatorAccountId, "ccn-test-creator-001");
assert.equal(draft.json.submission.challengeId, "0x1111111111111111111111111111111111111111111111111111111111110111");

const refresh = await postJson("/api/internal/submissions/manual-fixture/status", {}, cookie);
assert.equal(refresh.json.submission.title, "Manual Fixture Creator Entry", "refresh must preserve draft");

const finalized = await postJson("/api/internal/submissions/manual-fixture/finalize", {
  idempotencyKey: "ux-01-1-manual-fixture-finalize",
}, cookie);
assert.equal(finalized.response.status, 200, "manual fixture finalize must succeed");
assert.equal(finalized.json.submission.status, "SUBMITTED");
assert.ok(finalized.json.submission.submittedAt, "finalized manual fixture must have submittedAt");

const repeatedFinalize = await postJson("/api/internal/submissions/manual-fixture/finalize", {
  idempotencyKey: "ux-01-1-manual-fixture-finalize",
}, cookie);
assert.equal(repeatedFinalize.response.status, 200, "repeated finalize must be idempotent");
assert.equal(repeatedFinalize.json.submission.id, finalized.json.submission.id);

const immutable = await postJson("/api/internal/submissions/manual-fixture/draft", {
  title: "Mutation after finalized",
  description: "Should fail",
  primaryAssetUrl: "https://example.com/immutable",
  supportingLinks: [],
}, cookie);
assert.equal(immutable.response.status, 400, "finalized manual fixture submission must be immutable");
assert.match(immutable.json.error?.message ?? "", /already finalized/i);

assert.equal(hashIfExists(canonicalStore), canonicalBefore, "manual fixture must not modify create-challenge-flow store");
assert.equal(hashIfExists(submissionStore), submissionsBefore, "manual fixture must not modify canonical/internal submission store");

console.log(JSON.stringify({
  result: "UX-01.1 manual Creator fixture verification passed",
  fixtureRoute: fixtureUrl,
  fixtureId: status.json.fixture.fixtureId,
  slug: status.json.fixture.slug,
  status: finalized.json.submission.status,
  canonicalStoreUnchanged: true,
  submissionStoreUnchanged: true,
}, null, 2));
