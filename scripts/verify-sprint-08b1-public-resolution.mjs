import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setupCanonicalFixture } from "./checkpoint3-canonical-fixture.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.CCN_TEST_BASE_URL ?? "http://localhost:3000";

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function readEnvValue(name) {
  if (process.env[name]) return process.env[name];
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return "";
  const line = fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${name}=`));
  if (!line) return "";
  return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
}

function spikeCookie() {
  const key = readEnvValue("INTERNAL_SPIKE_ACCESS_KEY");
  assert.ok(key && key.length >= 8, "INTERNAL_SPIKE_ACCESS_KEY must be configured for route proof");
  const value = createHash("sha256").update(`ccn-spike:${key}`).digest("hex");
  return `ccn_internal_spike_access=${value}`;
}

async function creatorCookie(ccnAccountId) {
  const response = await fetch(baseUrl + "/api/creator/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ccnAccountId, checkpointFixture: "checkpoint3" }),
  });
  assert.equal(response.status, 200, "test Creator sign-in must succeed before submission route proof");
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie?.includes("ccn_creator_session="), "test Creator session cookie must be set");
  return cookie.split(";")[0];
}
async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  return { response, text };
}

async function requestJson(pathname, body, cookie = spikeCookie()) {
  const { response, text } = await request(pathname, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify(body),
  });
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { text };
  }
  return { response, json };
}

const publishedResolver = read("src/services/create-challenge/published-challenge.server.ts");
assert.ok(publishedResolver.includes("getPublishedCreateChallengeBySlug"), "resolver must expose slug-specific lookup");
assert.ok(publishedResolver.includes("matches.length !== 1"), "resolver must reject unknown or ambiguous live slugs");
assert.ok(publishedResolver.includes("listPublishedCreateChallenges"), "listing helper must be separate from single-slug lookup");
assert.ok(!publishedResolver.includes(".find(\n    (item) => item.publicationStatus === \"live\""), "resolver must not use first-live singleton behavior");

const detailRoute = read("src/app/challenges/[slug]/page.tsx");
assert.ok(detailRoute.includes("getPublishedCreateChallengeBySlug(slug)"), "detail route must resolve requested slug exactly");

const publishFlow = read("src/services/create-challenge/create-challenge-funding.server.ts");
assert.ok(publishFlow.includes("assertNoPublishedSlugConflict"), "publish flow must guard duplicate live slugs");
assert.ok(publishFlow.includes("PUBLIC_SLUG_CONFLICT"), "publish flow must return a scoped duplicate slug error");

const canonical = read("src/services/submissions/canonical-challenge-lifecycle.server.ts");
assert.ok(canonical.includes("readActiveEscrowIsFunded"), "submission eligibility must read active escrow funded state");
assert.ok(canonical.includes("CREATE_CHALLENGE_ESCROW_CONTRACT"), "submission eligibility must bind to active escrow");
assert.ok(!canonical.includes("getEscrowFundingIntent"), "submission eligibility must not read historical escrow spike state");

const fixture = await setupCanonicalFixture("08b1");
const sprintDraft = fixture.liveDraft;
const sprintDraftId = sprintDraft.challenge.id;
const sprintChallengeId = sprintDraft.challenge.challengeId;
const sprintFundingIntentId = sprintDraft.funding.fundingIntentId;
const sprintSlug = sprintDraft.challenge.slug;
const blockedDraftId = fixture.blockedDraft.challenge.id;

try {
const publicPage = await request(`/challenges/${sprintSlug}`);
assert.equal(publicPage.response.status, 200, "Sprint 08B public challenge route must resolve");
assert.ok(publicPage.text.includes(sprintDraft.challenge.title), "public route must show the canonical fixture title");
assert.ok(!publicPage.text.includes(fixture.blockedDraft.challenge.title), "public route must not return a blocked fixture draft");
assert.ok(!publicPage.text.includes(sprintDraftId), "public route must not expose the internal draft ID");
assert.ok(!publicPage.text.includes(sprintChallengeId), "public route must not expose the raw challenge ID");
assert.ok(!/2f5fbbff|2123e9|ccn-test-email-001|ccn-payout-operator-001/i.test(publicPage.text), "public route must not expose internal wallet or Circle account identifiers");

const unknownPage = await request("/challenges/unknown-sprint-08b1-slug");
assert.equal(unknownPage.response.status, 404, "unknown slug must return not found");

const nonLivePage = await request(`/challenges/${fixture.blockedDraft.challenge.slug}`);
assert.equal(nonLivePage.response.status, 404, "non-LIVE fixture draft slug must not resolve publicly");

const authCookie = await creatorCookie(fixture.creatorAccountId);
const sprintStatus = await requestJson("/api/internal/submissions/status", { draftId: sprintDraftId }, authCookie);
assert.equal(sprintStatus.response.status, 200, "Sprint 08B submission status route must succeed");
assert.equal(sprintStatus.json.challenge.draftId, sprintDraftId, "submission route must bind exact draft ID");
assert.equal(sprintStatus.json.challenge.challengeId.toLowerCase(), sprintChallengeId.toLowerCase(), "submission route must bind exact challenge ID");
assert.equal(sprintStatus.json.challenge.fundingIntentId, sprintFundingIntentId, "submission route must bind exact funding intent");
assert.equal(sprintStatus.json.challenge.escrowContractAddress.toLowerCase(), fixture.activeEscrow.toLowerCase(), "submission route must bind active escrow");
assert.equal(sprintStatus.json.challenge.publicationStatus, "live", "submission route must see LIVE status");
assert.equal(sprintStatus.json.challenge.verified, true, "Sprint 08B submission eligibility must be accepted");
assert.equal(sprintStatus.json.challenge.acceptsSubmissions, true, "Sprint 08B must accept submissions before deadline");
assert.deepEqual(sprintStatus.json.challenge.blockers, [], "Sprint 08B must have no submission blockers");

const oldStatus = await requestJson("/api/internal/submissions/status", { draftId: blockedDraftId }, authCookie);
assert.equal(oldStatus.response.status, 200, "blocked draft status route should return a safe status response");
assert.equal(oldStatus.json.challenge.verified, false, "blocked fixture challenge must not be eligible");
assert.ok(
  oldStatus.json.challenge.blockers.includes("Challenge is not funded on the active escrow contract."),
  "blocked fixture challenge must be rejected by active escrow funding check",
);

const reloadStatus = await requestJson("/api/internal/submissions/status", { draftId: sprintDraftId }, authCookie);
assert.equal(reloadStatus.response.status, 200, "reload submission status route must succeed");
assert.equal(reloadStatus.json.challenge.verified, true, "reload must preserve accepted eligibility");

console.log(JSON.stringify({
  result: "Sprint 08B.1 public resolution and submission eligibility proof passed",
  publicRoute: `/challenges/${sprintSlug}`,
  publicStatus: publicPage.response.status,
  draftId: sprintDraftId,
  challengeId: sprintChallengeId,
  fundingIntentId: sprintFundingIntentId,
  submissionEligible: sprintStatus.json.challenge.verified,
  oldEscrowRejected: oldStatus.json.challenge.verified === false,
  fixtureMode: fixture.mode,
}, null, 2));
} finally {
  await fixture.cleanup();
}
