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

assert.ok(store.includes('"SUBMITTING"'), "funding attempts must support a pre-Circle submitting state");
assert.ok(store.includes('"RECOVERY_REQUIRED"'), "funding attempts must support an uncertain recovery-required state");
assert.ok(
  store.includes("item.idempotencyKey === input.attempt.idempotencyKey"),
  "funding attempt upsert must replace a pre-submit sentinel with the accepted Circle challenge by idempotency key",
);

assert.ok(
  funding.includes('const FUNDING_PRE_SUBMIT_PREFIX = "pre-submit:";'),
  "funding service must use an explicit pre-submit attempt marker",
);
assert.ok(
  funding.includes("function fundingPreSubmitChallengeId"),
  "funding service must derive a deterministic pre-submit marker from the funding idempotency key",
);
assert.ok(
  funding.includes("function isPreSubmitFundingAttempt"),
  "funding service must distinguish pre-submit sentinels from real Circle challenges",
);

assert.ok(
  fundingAction.indexOf("const idempotencyKey = stableUuid(") < fundingAction.indexOf("let fundingAttempts = await listFundingAttemptsForScope(scope)"),
  "funding idempotency key must be computed before recovery/listing decisions",
);
assert.ok(
  fundingAction.includes("findFundingAttemptsFromCircle(userToken, draftId"),
  "funding must reconcile Circle evidence before creating a new funding submission",
);
assert.ok(
  fundingAction.indexOf("await upsertFundingAttemptForScope({") < fundingAction.indexOf('circleFetch<CircleContractExecutionResponse>'),
  "durable funding attempt must exist before Circle contractExecution is attempted",
);
assert.ok(
  fundingAction.includes('circleStatus: "SUBMITTING"'),
  "pre-submit funding attempt must be marked submitting",
);
assert.ok(
  funding.includes("function isDefinitiveCircleFundingRejection"),
  "funding service must classify only definitive Circle rejections as terminal",
);
assert.ok(
  funding.includes("error.safe.status >= 400") && funding.includes("error.safe.status < 500"),
  "only Circle 4xx rejections may be treated as terminal failed funding attempts",
);
assert.ok(
  fundingAction.includes('circleStatus: isDefinitiveCircleFundingRejection(error) ? "FAILED" : "RECOVERY_REQUIRED"'),
  "lost response, timeout, or Circle 5xx must leave a recovery-required attempt instead of clearing retry state",
);
assert.ok(
  fundingAction.includes('code: "FUNDING_RECOVERY_REQUIRED"'),
  "retry against uncertain pre-submit state must stop with a safe recovery-required error",
);
assert.ok(
  fundingAction.indexOf("if (verification.escrow.isFunded)") < fundingAction.indexOf('circleFetch<CircleContractExecutionResponse>'),
  "Arc funded state must prevent a new Circle submission",
);
assert.ok(
  fundingAction.includes("fundingChallengeId: activeAttempt.circleChallengeId"),
  "accepted Circle challenges must be resumed instead of resubmitted",
);
assert.ok(
  fundingAction.includes("idempotencyKey,"),
  "Circle funding submission must reuse the stable funding idempotency key",
);

const circleRecoveryStart = funding.indexOf("async function findFundingAttemptsFromCircle");
assert.notEqual(circleRecoveryStart, -1, "funding Circle evidence recovery helper must exist");
const circleRecovery = funding.slice(circleRecoveryStart, funding.indexOf("export async function reconcileCurrentApprovalAttempts"));
assert.ok(circleRecovery.includes("listCircleChallenges(userToken)"), "funding recovery must use read-only Circle challenge listing");
assert.ok(circleRecovery.includes("values.has(refId) || values.has(idempotencyKey)"), "funding recovery must match by refId or idempotency key");
assert.ok(circleRecovery.includes("upsertFundingAttemptForScope"), "funding recovery must persist accepted Circle evidence");

console.log("p0 production funding recovery blocker: ok");
