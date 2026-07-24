import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const funding = read("src/services/create-challenge/create-challenge-funding.server.ts");
const publishStart = funding.indexOf("export async function verifyAndPublishChallenge");
assert.notEqual(publishStart, -1, "publish verifier must exist");
const publishSource = funding.slice(publishStart, publishStart + 2200);

assert.ok(funding.includes("findOnChainVerificationForDraft"), "publish must be able to read exact persisted on-chain evidence");
assert.ok(funding.includes("function getTrustedPublishEvidence"), "publish must have a durable evidence path");
assert.ok(funding.includes("function recordMatchesPublishScope"), "publish evidence must be scoped");
assert.ok(funding.includes("record.orphaned"), "publish must reject orphaned verification records");
assert.ok(funding.includes('record.eventType !== "ChallengeFunded"'), "publish must only trust ChallengeFunded evidence");
assert.ok(funding.includes("record.walletId !== draft.funding.walletId"), "publish evidence must match the current wallet");
assert.ok(funding.includes("record.fundingIntentId !== intent.fundingIntentId"), "publish evidence must match the current funding intent");
assert.ok(funding.includes("draftHasVerifiedPublishFunding"), "publish must require exact draft funding fields");
assert.ok(
  publishSource.indexOf("getTrustedPublishEvidence") < publishSource.indexOf("verifyFundedChallenge"),
  "publish must use durable evidence before live RPC/log verification",
);
assert.ok(
  publishSource.includes("throw publishBusinessError()"),
  "publish must not return HTTP 200 with published:false for business-not-ready state",
);
assert.ok(
  publishSource.includes("throw publishRpcError()"),
  "publish must expose RPC verification failures as structured 503 errors",
);
assert.ok(
  publishSource.includes("published: true"),
  "successful publish responses must explicitly return published:true",
);

const route = read("src/app/api/create-challenge/publish/route.ts");
assert.ok(route.includes("verifyAndPublishChallenge"), "publish route must use canonical publish verifier");
assert.ok(route.includes("status: error.safe.status ?? 400"), "publish route must preserve structured error status");

const wizard = read("src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx");
assert.ok(wizard.includes("payload.publication.published !== true"), "frontend must reject non-true publish responses");
assert.ok(wizard.includes('code: "PRIZE_POOL_NOT_VERIFIED"'), "frontend must render publish-not-ready as a scoped error");

console.log("create challenge publish verification regression: ok");
