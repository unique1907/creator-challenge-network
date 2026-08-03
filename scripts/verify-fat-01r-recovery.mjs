import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.CCN_TEST_BASE_URL ?? "http://localhost:3000";
const draftId = "f51a9024-879f-4bc0-b519-3bff298d2614";
const challengeId = "0x98a03a73cab4f10049f2269c348b69031aa78484b15c9098943e5cea07bcbdd9";
const blindEntryId = "117db492-a3f2-4e2d-931c-cb885ed3eb5f";
const creatorWallet = "0x7660f88026f01b44ac9b96d02d045dccffeb7e79";

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function readEnvValue(name) {
  if (process.env[name]) return process.env[name];
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return "";
  const line = fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${name}=`));
  if (!line) return "";
  return line.slice(line.indexOf("=") + 1).trim().replace(/^[\'\"]|[\'\"]$/g, "");
}

function spikeCookie() {
  const key = readEnvValue("INTERNAL_SPIKE_ACCESS_KEY");
  assert.ok(key && key.length >= 8, "INTERNAL_SPIKE_ACCESS_KEY must be configured");
  return `ccn_internal_spike_access=${createHash("sha256").update(`ccn-spike:${key}`).digest("hex")}`;
}

async function creatorCookie() {
  const response = await fetch(baseUrl + "/api/creator/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ccnAccountId: "ccn-test-creator-001" }),
  });
  assert.equal(response.status, 200, "test Creator sign-in must succeed before recovery route proof");
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie?.includes("ccn_creator_session="), "test Creator session cookie must be set");
  return cookie.split(";")[0];
}

let creatorSessionCookie = "";
function routeCookie() {
  return creatorSessionCookie ? `${spikeCookie()}; ${creatorSessionCookie}` : spikeCookie();
}
async function post(pathname, body, cookie = false) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie: routeCookie() } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { text }; }
  return { response, json };
}

async function get(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { cookie: spikeCookie() },
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { text }; }
  return { response, json };
}

const store = readJson(".local/create-challenge-flow.json");
const draft = store.drafts?.[draftId];
assert.ok(draft, "FAT-01 draft must exist");
assert.equal(draft.challenge.challengeId.toLowerCase(), challengeId.toLowerCase());
assert.ok(["funded", "live"].includes(draft.funding.fundingStatus), "FAT-01 draft must be funded or live");
assert.equal(draft.funding.eventVerified, true);
assert.equal(draft.deployment.publicationStatus, "live");
const winnerAttempt = Object.values(store.winnerFinalizationAttempts ?? {}).find(
  (item) => item.challengeId?.toLowerCase() === challengeId.toLowerCase(),
);
const payoutConfirmed = winnerAttempt?.state === "PAYOUT_CONFIRMED";

const submissions = readJson(".local/internal-submissions-spike.json");
const submission = submissions.submissions.find((item) => item.id === blindEntryId);
assert.ok(submission, "FAT-01 submission must exist");
assert.equal(submission.status, "SUBMITTED");
assert.equal(submission.challengeId.toLowerCase(), challengeId.toLowerCase());
assert.equal(submission.creatorWalletAddress.toLowerCase(), creatorWallet.toLowerCase());

creatorSessionCookie = await creatorCookie();
const late = await post("/api/internal/submissions/draft", {
  draftId,
  title: "FAT-01R late submission guard",
  description: "This request must stay rejected after submission close.",
  primaryAssetUrl: "https://example.com/fat-01r-late",
  supportingLinks: [],
}, true);
assert.equal(late.response.status, 400, "new submission draft must reject after deadline");

let blindStatus = "skipped-after-payout";
let identityLeakTest = "skipped-after-payout";
let winnerFinalizeStatus = "skipped-after-payout";

if (payoutConfirmed) {
  const status = await post("/api/create-challenge/winner-finalization", {
    draftId,
    authority: "BRAND",
    mode: "status",
  });
  assert.equal(status.response.status, 200, "payout-confirmed FAT-01 status must load");
  assert.equal(status.json.state, "PAYOUT_CONFIRMED");
  assert.equal(status.json.transactionHash, winnerAttempt.transactionHash);
  winnerFinalizeStatus = status.json.state;
} else {
  const blind = await get(`/api/internal/blind-review/entries?draftId=${draftId}`);
  assert.equal(blind.response.status, 200, "blind review must load after submission deadline");
  assert.equal(blind.json.identityLeakTest, "PASSED");
  assert.ok(blind.json.entries.some((entry) => entry.blindEntryId === blindEntryId));
  const fields = Object.keys(blind.json.entries[0] ?? {});
  for (const forbidden of ["creatorAccountId", "creatorWalletAddress", "walletId", "circleUserId", "email"]) {
    assert.ok(!fields.includes(forbidden), `blind projection must not expose ${forbidden}`);
  }
  blindStatus = String(blind.response.status);
  identityLeakTest = blind.json.identityLeakTest;

  const finalized = await post("/api/create-challenge/winner-finalization", {
    draftId,
    authority: "BRAND",
    mode: "finalize-selection",
    selectedBlindEntryIds: [blindEntryId],
  });
  assert.ok([200, 409].includes(finalized.response.status), "winner selection is finalized or already immutable");
  if (finalized.response.status === 200) {
    assert.equal(finalized.json.winnerWalletAddresses[0].toLowerCase(), creatorWallet.toLowerCase());
    assert.equal(finalized.json.payoutAmounts[0], "1000000");
    assert.equal(finalized.json.state, "READY_FOR_FINAL_SELECTION");
  }
  winnerFinalizeStatus = String(finalized.response.status);
}

console.log(JSON.stringify({
  result: "FAT-01R recovery verification passed",
  draftId,
  challengeId,
  lateSubmissionRejected: late.response.status === 400,
  payoutConfirmed,
  blindReviewStatus: blindStatus,
  identityLeakTest,
  winnerFinalizeStatus,
}, null, 2));
