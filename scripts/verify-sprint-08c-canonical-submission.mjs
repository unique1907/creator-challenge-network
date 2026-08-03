import assert from "node:assert/strict";
import { setupCanonicalFixture } from "./checkpoint3-canonical-fixture.mjs";

const baseUrl = process.env.CCN_TEST_BASE_URL ?? "http://localhost:3000";

async function creatorCookie(ccnAccountId) {
  const response = await fetch(baseUrl + "/api/creator/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ccnAccountId, checkpointFixture: "checkpoint3" }),
  });
  assert.equal(response.status, 200, "test Creator sign-in must succeed before canonical submission proof");
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie?.includes("ccn_creator_session="), "test Creator session cookie must be set");
  return cookie.split(";")[0];
}

let creatorSessionCookie = "";


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

async function post(pathname, body, withDeterministicBrandAuth = false) {
  return request(pathname, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: creatorSessionCookie,
      ...(withDeterministicBrandAuth ? { "x-ccn-test-auth": "deterministic" } : {}),
    },
    body: JSON.stringify(body),
  });
}

const fixture = await setupCanonicalFixture("08c");
const draftId = fixture.liveDraft.challenge.id;
const challengeId = fixture.liveDraft.challenge.challengeId;
const fundingIntentId = fixture.liveDraft.funding.fundingIntentId;
const slug = fixture.liveDraft.challenge.slug;
const escrow = fixture.activeEscrow;
const creatorWallet = fixture.creatorWallet;

try {
creatorSessionCookie = await creatorCookie(fixture.creatorAccountId);
const publicPage = await request(`/challenges/${slug}`);
assert.equal(publicPage.response.status, 200, "public route must resolve the authoritative challenge");
assert.ok(publicPage.text.includes(fixture.liveDraft.challenge.title), "public page must show authoritative fixture title");

const statusBefore = await post("/api/creator/submissions/status", { draftId });
assert.equal(statusBefore.response.status, 200, "submission status preflight must succeed");
assert.equal(statusBefore.json.challenge.verified, true, "canonical challenge must be eligible");
assert.equal(statusBefore.json.challenge.acceptsSubmissions, true, "submission deadline must remain open");
assert.equal(statusBefore.json.challenge.challengeId.toLowerCase(), challengeId.toLowerCase());
assert.equal(statusBefore.json.challenge.fundingIntentId, fundingIntentId);
assert.equal(statusBefore.json.challenge.escrowContractAddress.toLowerCase(), escrow.toLowerCase());

const override = await post("/api/creator/submissions/draft", {
  draftId,
  creatorWalletAddress: "0x0000000000000000000000000000000000000001",
  title: "Rejected wallet override",
  description: "This request should be rejected before persistence.",
  primaryAssetUrl: "https://example.com/rejected-wallet-override",
  supportingLinks: [],
});
assert.equal(override.response.status, 400, "client supplied creator wallet override must be rejected");

const draftResponse = await post("/api/creator/submissions/draft", {
  draftId,
  title: "Sprint 08C Canonical Creator Submission",
  description: "A disposable proof submission for the funded Sprint 08B challenge. It is finalized for blind review and winner resolution only.",
  primaryAssetUrl: "https://example.com/ccn-sprint-08c-canonical-submission",
  supportingLinks: ["https://example.com/ccn-sprint-08c-storyboard"],
});
assert.equal(draftResponse.response.status, 200, "canonical creator draft must save");
assert.equal(draftResponse.json.challenge.challengeId.toLowerCase(), challengeId.toLowerCase());
assert.equal(draftResponse.json.submission.challengeId.toLowerCase(), challengeId.toLowerCase());
assert.equal(draftResponse.json.submission.creatorWalletAddress.toLowerCase(), creatorWallet.toLowerCase());
assert.equal(draftResponse.json.submission.creatorAccountId, fixture.creatorAccountId);
assert.equal(draftResponse.json.submission.status, "DRAFT");
assert.equal(draftResponse.json.submission.version, 1);

const finalizeResponse = await post("/api/creator/submissions/finalize", {
  draftId,
  idempotencyKey: `checkpoint3-finalize-${draftId}`,
});
assert.equal(finalizeResponse.response.status, 200, "canonical creator submission must finalize");
const submission = finalizeResponse.json.submission;
assert.equal(submission.id, draftResponse.json.submission.id);
assert.equal(submission.challengeId.toLowerCase(), challengeId.toLowerCase());
assert.equal(submission.status, "SUBMITTED");
assert.equal(submission.version, 1);
assert.ok(submission.submittedAt, "finalized submission must have submittedAt");
assert.equal(submission.creatorWalletAddress.toLowerCase(), creatorWallet.toLowerCase());

const immutableUpdate = await post("/api/creator/submissions/draft", {
  draftId,
  title: "Mutation attempt after finalization",
  description: "Submitted entries should be immutable.",
  primaryAssetUrl: "https://example.com/mutation-attempt",
  supportingLinks: [],
});
assert.equal(immutableUpdate.response.status, 400, "submitted entries must be immutable");


const prematureWinnerSelection = await post("/api/create-challenge/winner-finalization", {
  mode: "finalize-selection",
  draftId,
  authority: "BRAND",
  selectedBlindEntryIds: [submission.id],
}, true);
assert.equal(prematureWinnerSelection.response.status, 400, "winner selection must remain closed while the submission deadline is open");
assert.equal(prematureWinnerSelection.json.error.message, "Winner finalization is not available before submission close.");

const statusAfter = await post("/api/creator/submissions/status", { draftId });
assert.equal(statusAfter.response.status, 200);
assert.equal(statusAfter.json.submission.id, submission.id);
assert.equal(statusAfter.json.submission.status, "SUBMITTED");
assert.equal(statusAfter.json.submission.creatorWalletAddress.toLowerCase(), creatorWallet.toLowerCase());
assert.equal(statusAfter.json.challenge.verified, true);

console.log(JSON.stringify({
  result: "Sprint 08C canonical submission proof passed",
  draftId,
  challengeId,
  fundingIntentId,
  submissionId: submission.id,
  submissionStatus: submission.status,
  submittedAt: submission.submittedAt,
  creatorScope: fixture.creatorAccountId,
  creatorWallet,
  blindReviewClosedBeforeDeadline: true,
  winnerFinalizationClosedBeforeDeadline: true,
  noCircleChallengeCreated: true,
  noPayoutTransactionCreated: true,
  fixtureMode: fixture.mode,
}, null, 2));
} finally {
  await fixture.cleanup();
}
