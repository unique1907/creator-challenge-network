import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const funding = read("src/services/create-challenge/create-challenge-funding.server.ts");
const store = read("src/services/create-challenge/create-challenge-store.server.ts");

const fundingStart = funding.indexOf("export async function createProductFundingChallenge");
assert.notEqual(fundingStart, -1, "canonical funding action must exist");
const fundingAction = funding.slice(fundingStart, funding.indexOf("function collectStringCandidates"));

assert.ok(!funding.includes('const FUNDING_PRE_SUBMIT_PREFIX = "pre-submit:";'), "restored funding path must not create pre-submit Circle sentinels");
assert.ok(!funding.includes("function fundingPreSubmitChallengeId"), "restored funding path must not derive fake Circle challenge IDs");
assert.ok(!funding.includes("function isPreSubmitFundingAttempt"), "restored funding path must not treat sentinel IDs as funding attempts");
assert.ok(!funding.includes("function fundingWalletSnapshotFromDraft"), "funding scope must be resolved from the live Brand wallet, not a draft snapshot");
assert.ok(!funding.includes("async function runPreCircleFundingPhase"), "restored funding path must not wrap pre-Circle checks in abandoned hotfix phases");
assert.ok(!funding.includes("async function findFundingAttemptsFromCircle"), "restored funding path must not perform pre-Circle Circle recovery lookup");
assert.ok(!funding.includes("PRE_CIRCLE_"), "restored funding path must not persist PRE_CIRCLE diagnostic phases");

assert.ok(!store.includes('"PREPARING"'), "funding attempt statuses must not include abandoned pre-Circle preparing state");
assert.ok(store.includes('"PENDING"'), "funding attempts must still support Circle submission tracking");
assert.ok(!store.includes('"RECOVERY_REQUIRED"'), "funding attempt statuses must not include abandoned recovery-required state");
assert.ok(
  !store.includes("item.idempotencyKey === input.attempt.idempotencyKey"),
  "funding attempt upsert must not merge fake pre-submit sentinel rows by idempotency key",
);

assert.ok(
  fundingAction.indexOf("const wallet = await getBrandWallet(userToken, draftId, input)") <
    fundingAction.indexOf("const scope = approvalAttemptScope"),
  "funding must resolve the canonical Brand wallet before funding attempt lookup",
);
assert.ok(
  fundingAction.indexOf("const activeAttempt = fundingAttempts.find") <
    fundingAction.indexOf("const verification = await getCanonicalFundingVerification"),
  "accepted Circle funding attempts must still be resumed before new verification/submission",
);
assert.ok(
  fundingAction.indexOf("const verification = await getCanonicalFundingVerification") <
    fundingAction.indexOf("const idempotencyKey = stableUuid("),
  "restored path must perform canonical Arc/allowance verification before computing submission idempotency",
);
assert.ok(
  fundingAction.indexOf("if (verification.escrow.isFunded)") <
    fundingAction.indexOf('circleFetch<CircleContractExecutionResponse>'),
  "Arc funded state must prevent a new Circle submission",
);
assert.ok(
  fundingAction.indexOf("if (BigInt(verification.allowance) < BigInt(intent.totalRequired))") <
    fundingAction.indexOf('circleFetch<CircleContractExecutionResponse>'),
  "allowance must be validated before Circle contractExecution",
);
assert.ok(
  fundingAction.indexOf('circleFetch<CircleContractExecutionResponse>') <
    fundingAction.indexOf("await persistFundingAttempt"),
  "restored path must persist funding evidence only after Circle accepts the contractExecution request",
);
assert.ok(
  fundingAction.includes("fundingChallengeId: activeAttempt.circleChallengeId"),
  "accepted Circle challenges must be resumed instead of resubmitted",
);
assert.ok(
  fundingAction.includes("idempotencyKey,"),
  "Circle funding submission must reuse the stable funding idempotency key",
);

console.log("p0 production funding restored baseline: ok");
