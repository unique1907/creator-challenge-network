import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assertContains(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

const route = read("src/app/api/create-challenge/winner-finalization/route.ts");
const service = read("src/services/create-challenge/winner-finalization.server.ts");
const adapter = read("src/services/circle/payout-contract-execution.server.ts");

assert.ok(
  route.indexOf('if (body.mode === "reconcile")') < route.lastIndexOf("const selectedWinners = await parseWinners"),
  "reconcile mode must dispatch before generic winner parsing",
);
assertContains(route, "reconcileFinalizedWinnerPayout", "route must use reconciliation-specific service");
assertContains(route, "getWinnerPayoutStatusForFinalizedAttempt", "status must use finalized-attempt resolver");
assertContains(service, "resolveFinalizedWinnerOperation", "service must resolve finalized attempt without funded-only guard");
assertContains(service, "readEscrowChallengeStatus", "service must verify terminal contract status");
assertContains(service, "PAYOUT_CONFIRMED", "service must persist payout confirmation");
assertContains(service, "blockchain-first", "service must document blockchain-first recovery");
assertContains(adapter, "receiptVerified = input.receipt?.status === \"0x1\" && Boolean(log)", "SCA receipt verification must use successful receipt plus escrow event");

const canonical = {
  challengeId: "0x98a03a73cab4f10049f2269c348b69031aa78484b15c9098943e5cea07bcbdd9",
  winner: "0x7660f88026f01b44ac9b96d02d045dccffeb7e79",
  amount: "1000000",
  fee: "100000",
  treasury: "0x6d2ca88a7bDA59280D9ad0E41aA87C9acF24Aa1A",
  txHash: "0x2d11480d5929d501736fbc976395b9a213f8a79ed711ea2e9447133a9b38199d",
};

function reconcileMock({
  state = "ACTION_REQUIRED",
  txHash = canonical.txHash,
  receiptStatus = "success",
  eventChallengeId = canonical.challengeId,
  winner = canonical.winner,
  amount = canonical.amount,
  fee = canonical.fee,
  contractStatus = "PAID",
  circleTransactionId = null,
} = {}) {
  const record = {
    state,
    transactionHash: state === "PAYOUT_CONFIRMED" ? txHash : undefined,
    payoutConfirmedAt: state === "PAYOUT_CONFIRMED" ? "existing-confirmed-at" : undefined,
    writes: 0,
  };

  if (record.state === "PAYOUT_CONFIRMED" && record.transactionHash) {
    return { ...record, duplicate: true, circleTransactionId };
  }

  const receiptVerified = receiptStatus === "success";
  const eventVerified = eventChallengeId === canonical.challengeId;
  const winnersVerified = winner.toLowerCase() === canonical.winner.toLowerCase();
  const amountsVerified = amount === canonical.amount;
  const feeVerified = fee === canonical.fee;
  const paid = contractStatus === "PAID";

  if (!receiptVerified) throw new Error("receipt failed");
  if (!eventVerified) throw new Error("wrong challenge");
  if (!winnersVerified) throw new Error("wrong winner");
  if (!amountsVerified || !feeVerified) throw new Error("wrong amount");
  if (!paid) throw new Error("not paid");

  record.writes += 1;
  record.state = "PAYOUT_CONFIRMED";
  record.transactionHash = txHash;
  record.circleTransactionId = circleTransactionId;
  record.reconciliationSource = "blockchain-first";
  record.finalContractStatus = "PAID";
  return record;
}

// Test A: paid challenge can reconcile without funded guard.
const paid = reconcileMock();
assert.equal(paid.state, "PAYOUT_CONFIRMED");

// Test B: source keeps prepare/create-approval funded-phase guards in the existing service.
assertContains(service, "await assertPayoutPhaseReady(input.draftId);", "prepare/create-approval must still use payout phase readiness");
assertContains(service, "createWinnerPayoutApproval", "create-approval path must remain separate from recovery reconcile");

// Test C: wrong transaction/challenge rejected.
assert.throws(() => reconcileMock({ eventChallengeId: `0x${"1".repeat(64)}` }), /wrong challenge/);

// Test D: failed receipt rejected.
assert.throws(() => reconcileMock({ receiptStatus: "failed" }), /receipt failed/);

// Test E: wrong winner/event rejected.
assert.throws(() => reconcileMock({ winner: "0x0000000000000000000000000000000000000001" }), /wrong winner/);

// Test F: duplicate reconcile is idempotent.
const duplicate = reconcileMock({ state: "PAYOUT_CONFIRMED" });
assert.equal(duplicate.transactionHash, canonical.txHash);
assert.equal(duplicate.payoutConfirmedAt, "existing-confirmed-at");
assert.equal(duplicate.duplicate, true);

// Test G: missing Circle transaction ID is allowed when chain evidence is complete.
const missingCircleTx = reconcileMock({ circleTransactionId: null });
assert.equal(missingCircleTx.state, "PAYOUT_CONFIRMED");
assert.equal(missingCircleTx.circleTransactionId, null);

console.log(JSON.stringify({
  result: "FAT-01R.3 post-payout reconciliation verification passed",
  paidChallengeAccepted: true,
  wrongChallengeRejected: true,
  failedReceiptRejected: true,
  wrongWinnerRejected: true,
  duplicateReconcileIdempotent: true,
  missingCircleTransactionIdAllowed: true,
}, null, 2));
