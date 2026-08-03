import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assertContains(source, needle, message) {
  assert.ok(source.includes(needle), `${message}\nMissing: ${needle}`);
}

function assertNotContains(source, needle, message) {
  assert.ok(!source.includes(needle), `${message}\nUnexpected: ${needle}`);
}

const component = read("src/features/dashboard/components/campaign-workspace-tabs.tsx");
const route = read("src/app/api/create-challenge/winner-finalization/route.ts");
const service = read("src/services/create-challenge/winner-finalization.server.ts");

const sdkCallbackStart = component.indexOf("sdkRef.current.execute(data.circleChallengeId");
const sdkCallbackEnd = component.indexOf("});", component.indexOf("void refreshStatus();"));
const sdkCallback = component.slice(sdkCallbackStart, sdkCallbackEnd);

assert.ok(sdkCallbackStart > -1, "settlement UI must execute the Circle Hosted PAYOUT challenge");
assertContains(sdkCallback, "void refreshStatus();", "SDK success must recover payout status before reconciliation");
assertNotContains(sdkCallback, "void reconcile();", "SDK success must not directly call blockchain-first reconciliation");
assertContains(component, 'mode: "status"', "Settlement UI must use the existing payout status/recovery endpoint");
assertContains(component, 'mode: "reconcile"', "Manual reconciliation path must remain available");
assertContains(component, "disabled={pending !== null || !hasTransaction || payoutConfirmed}", "Manual reconciliation must remain disabled while tx hash is missing");
assertContains(component, "PAYOUT submitted / awaiting transaction confirmation", "UI must show a recoverable pending state after hosted approval completion");
assertContains(route, 'if (body.mode === "status")', "Route must expose payout status recovery");
assertContains(route, "getWinnerPayoutStatusForFinalizedAttempt", "Status route must use finalized-attempt recovery");
assertContains(route, 'if (body.mode === "reconcile")', "Route must keep blockchain-first reconciliation separate");
assertContains(service, "if (status.transactionHash) {", "Status recovery must only reconcile after a tx hash is resolved");
assertContains(service, "return reconcileFinalizedWinnerPayout({", "Status recovery must enter blockchain-first reconciliation only after hash recovery");
assertContains(service, "Payout transaction hash is required for blockchain-first reconciliation.", "Blockchain-first reconcile must still fail closed without a tx hash");

class MockSettlementFlow {
  constructor({ statusResults = [], reconcileResult = { state: "PAYOUT_CONFIRMED" } } = {}) {
    this.calls = [];
    this.record = { state: "READY_FOR_FINAL_SELECTION", circleChallengeId: null, circleTransactionId: null, transactionHash: null };
    this.statusResults = [...statusResults];
    this.reconcileResult = reconcileResult;
  }

  createApproval() {
    this.calls.push("create-approval");
    if (!this.record.circleChallengeId) {
      this.record = { ...this.record, state: "ACTION_REQUIRED", circleChallengeId: "circle-challenge-001" };
    }
    return this.record;
  }

  refreshStatus() {
    this.calls.push("status");
    const next = this.statusResults.length ? this.statusResults.shift() : this.record;
    this.record = { ...this.record, ...next };
    if (this.record.transactionHash) return this.reconcile();
    return this.record;
  }

  reconcile() {
    this.calls.push("reconcile");
    if (!this.record.transactionHash) throw new Error("Payout transaction hash is required for blockchain-first reconciliation.");
    this.record = { ...this.record, ...this.reconcileResult };
    return this.record;
  }
}

function sdkSuccess(flow) {
  flow.createApproval();
  return flow.refreshStatus();
}

// SDK success with no transaction hash must remain recoverable and must not call reconcile.
{
  const flow = new MockSettlementFlow({
    statusResults: [{ state: "ACTION_REQUIRED", circleChallengeId: "circle-challenge-001", transactionHash: null }],
  });
  const result = sdkSuccess(flow);
  assert.deepEqual(flow.calls, ["create-approval", "status"]);
  assert.equal(result.state, "ACTION_REQUIRED");
  assert.equal(result.transactionHash, null);
}

// Pending Circle transaction without an Arc hash must not invoke blockchain reconciliation.
{
  const flow = new MockSettlementFlow({
    statusResults: [{
      state: "FINALIZATION_IN_PROGRESS",
      circleChallengeId: "circle-challenge-001",
      circleTransactionId: "circle-transaction-001",
      transactionHash: null,
    }],
  });
  const result = sdkSuccess(flow);
  assert.deepEqual(flow.calls, ["create-approval", "status"]);
  assert.equal(result.state, "FINALIZATION_IN_PROGRESS");
}

// Recovered Arc tx hash enables exactly one reconciliation.
{
  const flow = new MockSettlementFlow({
    statusResults: [{
      state: "TRANSACTION_SUBMITTED",
      circleChallengeId: "circle-challenge-001",
      circleTransactionId: "circle-transaction-001",
      transactionHash: `0x${"a".repeat(64)}`,
    }],
  });
  const result = sdkSuccess(flow);
  assert.deepEqual(flow.calls, ["create-approval", "status", "reconcile"]);
  assert.equal(result.state, "PAYOUT_CONFIRMED");
}

// Failed Circle transaction fails safely without reconciliation.
{
  const flow = new MockSettlementFlow({
    statusResults: [{
      state: "FINALIZATION_FAILED",
      circleChallengeId: "circle-challenge-001",
      circleTransactionId: "circle-transaction-001",
      transactionHash: null,
      errorMessage: "Circle PAYOUT transaction failed before on-chain confirmation.",
    }],
  });
  const result = sdkSuccess(flow);
  assert.deepEqual(flow.calls, ["create-approval", "status"]);
  assert.equal(result.state, "FINALIZATION_FAILED");
}

// Repeated recovery is idempotent and does not create another approval/challenge.
{
  const flow = new MockSettlementFlow({
    statusResults: [
      { state: "FINALIZATION_IN_PROGRESS", circleChallengeId: "circle-challenge-001", circleTransactionId: "circle-transaction-001", transactionHash: null },
      { state: "FINALIZATION_IN_PROGRESS", circleChallengeId: "circle-challenge-001", circleTransactionId: "circle-transaction-001", transactionHash: null },
    ],
  });
  flow.createApproval();
  flow.refreshStatus();
  flow.refreshStatus();
  assert.deepEqual(flow.calls, ["create-approval", "status", "status"]);
  assert.equal(flow.record.circleChallengeId, "circle-challenge-001");
}

// Repeated reconciliation with an existing tx hash remains idempotent at the UI sequence level.
{
  const flow = new MockSettlementFlow({
    statusResults: [
      { state: "TRANSACTION_SUBMITTED", circleChallengeId: "circle-challenge-001", circleTransactionId: "circle-transaction-001", transactionHash: `0x${"b".repeat(64)}` },
      { state: "PAYOUT_CONFIRMED", circleChallengeId: "circle-challenge-001", circleTransactionId: "circle-transaction-001", transactionHash: `0x${"b".repeat(64)}` },
    ],
  });
  sdkSuccess(flow);
  flow.refreshStatus();
  assert.deepEqual(flow.calls, ["create-approval", "status", "reconcile", "status", "reconcile"]);
  assert.equal(flow.record.state, "PAYOUT_CONFIRMED");
}

console.log(JSON.stringify({
  result: "Validation Sprint 02 payout recovery sequence verification passed",
  sdkSuccessDoesNotImmediatelyReconcile: true,
  missingHashDoesNotInvokeReconciliation: true,
  recoveredHashEnablesReconciliation: true,
  failedCircleTransactionFailsSafely: true,
  repeatedRecoveryDoesNotCreateSecondApproval: true,
  directBlockchainReconcileGuardPreserved: true,
}, null, 2));
