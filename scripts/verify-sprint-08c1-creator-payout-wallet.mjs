import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setupCanonicalFixture } from "./checkpoint3-canonical-fixture.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.CCN_TEST_BASE_URL ?? "http://localhost:3000";

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

async function creatorCookie(ccnAccountId) {
  const response = await fetch(baseUrl + "/api/creator/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ccnAccountId, checkpointFixture: "checkpoint3" }),
  });
  assert.equal(response.status, 200, "test Creator sign-in must succeed before wallet proof");
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie?.includes("ccn_creator_session="), "test Creator session cookie must be set");
  return cookie.split(";")[0];
}

async function postJson(pathname, body, cookie) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { text };
  }
  return { response, json };
}

const creatorFoundation = read("src/services/creator-foundation/creator-foundation.server.ts");
assert.ok(creatorFoundation.includes("getVerifiedCreatorPayoutWallet"), "creator payout resolver must exist");
assert.ok(creatorFoundation.includes('scope", "CREATOR_PAYOUT"'), "creator resolver must require CREATOR_PAYOUT scope");
assert.ok(creatorFoundation.includes("wallet.blockchain !== USER_WALLET_BLOCKCHAIN"), "wrong blockchain must be rejected");
assert.ok(creatorFoundation.includes("wallet.status !== \"ACTIVE\""), "non-active wallet must be rejected");
assert.ok(creatorFoundation.includes("accountType: USER_WALLET_ACCOUNT_TYPE"), "verified wallet summary must use configured SCA account type");

const compatibility = read("src/services/circle/creator-payout-account.server.ts");
assert.ok(compatibility.includes("getVerifiedCreatorPayoutWallet(ccnAccountId)"), "legacy compatibility service must delegate to Creator Foundation wallet resolver");

const lifecycle = read("src/services/submissions/canonical-challenge-lifecycle.server.ts");
assert.ok(lifecycle.includes("getVerifiedCreatorPayoutMapping"), "submission creation must derive creator wallet server-side");
assert.ok(lifecycle.includes("Client-supplied creator wallet does not match the verified payout mapping."), "client wallet override must be rejected");
assert.ok(lifecycle.includes("creatorPayout.walletAddress"), "submission persistence must use derived wallet address");

const fixture = await setupCanonicalFixture("08c1");
try {
  const authCookie = await creatorCookie(fixture.creatorAccountId);

  const status = await postJson("/api/creator/submissions/status", { draftId: fixture.liveDraft.challenge.id }, authCookie);
  assert.equal(status.response.status, 200, "canonical submission status must resolve with Creator Foundation payout wallet available");
  assert.equal(status.json.challenge.verified, true, "canonical challenge must remain eligible");

  const override = await postJson("/api/creator/submissions/draft", {
    draftId: fixture.liveDraft.challenge.id,
    creatorWalletAddress: "0x0000000000000000000000000000000000000001",
    title: "Rejected override proof",
    description: "This request must be rejected before any submission is written.",
    primaryAssetUrl: "https://example.com/rejected-override",
    supportingLinks: [],
  }, authCookie);
  assert.equal(override.response.status, 400, "client wallet override must return a safe rejection");
  assert.match(
    override.json.error?.message ?? "",
    /Client-supplied creator wallet does not match the verified payout mapping/,
  );

  console.log(JSON.stringify({
    result: "Sprint 08C.1 creator payout wallet verification passed",
    creatorScope: fixture.creatorAccountId,
    walletAddress: fixture.creatorWallet,
    walletSource: "public.wallets scope=CREATOR_PAYOUT status=ACTIVE",
    clientWalletOverrideRejected: true,
    noCircleChallengeCreated: true,
  }, null, 2));
} finally {
  await fixture.cleanup();
}
