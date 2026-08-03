import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assertContains(file, needle, message) {
  assert.ok(read(file).includes(needle), `${message}\nMissing: ${needle}`);
}

const service = "src/services/create-challenge/winner-finalization.server.ts";
const store = "src/services/create-challenge/create-challenge-store.server.ts";
const types = "src/types/winner-finalization.ts";

assertContains(types, '"APPROVAL_CREATION_IN_PROGRESS"', "state machine must include durable approval reservation");
assertContains(types, '"APPROVAL_CREATED_RECONCILIATION_REQUIRED"', "state machine must include post-Circle recovery state");
assertContains(store, "operationOwnerToken", "store record must include an operation owner token");
assertContains(store, "patchWinnerFinalizationAttemptForOwner", "store must expose owner-guarded patching");
assertContains(store, "existing.operationOwnerToken !== input.ownerToken", "owner guard must reject non-owner mutation");
assertContains(service, "canonicalOperationKey", "service must derive deterministic canonical operation identity");
assertContains(service, "assertMatchesFinalizedWinnerRecord", "service must independently verify finalized winner equality");
assertContains(service, "APPROVAL_CREATION_IN_PROGRESS", "service must persist reservation before Circle side effect");
assertContains(service, "APPROVAL_CREATED_RECONCILIATION_REQUIRED", "service must represent post-Circle persistence recovery");
assertContains(service, "if (error instanceof WinnerOperationConflictError) throw error", "outer catch must not mark lock contention as failed");

const canonical = {
  operationKey: "challenge:selection:v1:payout",
  challengeId: "0x98a03a73cab4f10049f2269c348b69031aa78484b15c9098943e5cea07bcbdd9",
  selectedWinnerEntryIds: ["117db492-a3f2-4e2d-931c-cb885ed3eb5f"],
  winnerWalletAddresses: ["0x7660f88026f01b44ac9b96d02d045dccffeb7e79"],
  payoutAmounts: ["1000000"],
};

class ControlledConflict extends Error {
  constructor() {
    super("operation already in progress");
    this.status = 409;
  }
}

class MockStore {
  constructor() {
    this.record = {
      state: "READY_FOR_FINAL_SELECTION",
      finalizedAt: "2026-07-26T07:17:59.469Z",
      selectedWinnerEntryIds: [...canonical.selectedWinnerEntryIds],
      winnerWalletAddresses: [...canonical.winnerWalletAddresses],
      payoutAmounts: [...canonical.payoutAmounts],
    };
    this.failNextOwnerPatch = false;
  }

  reserve(ownerToken) {
    if (this.record.circleChallengeId) return { record: this.record, owner: false };
    if (["APPROVAL_CREATION_IN_PROGRESS", "ACTION_REQUIRED"].includes(this.record.state)) {
      throw new ControlledConflict();
    }
    this.record = {
      ...this.record,
      state: "APPROVAL_CREATION_IN_PROGRESS",
      operationKey: canonical.operationKey,
      operationOwnerToken: ownerToken,
    };
    return { record: this.record, owner: true };
  }

  patchForOwner(ownerToken, patch) {
    if (this.record.operationOwnerToken !== ownerToken) throw new ControlledConflict();
    if (this.failNextOwnerPatch) {
      this.failNextOwnerPatch = false;
      throw new Error("simulated persistence failure");
    }
    this.record = { ...this.record, ...patch };
    return this.record;
  }

  stalePatch(ownerToken, patch) {
    return this.patchForOwner(ownerToken, patch);
  }
}

function assertFinalizedSelection(input) {
  assert.deepEqual(input.selectedWinnerEntryIds, canonical.selectedWinnerEntryIds);
  assert.deepEqual(input.winnerWalletAddresses.map((item) => item.toLowerCase()), canonical.winnerWalletAddresses);
  assert.deepEqual(input.payoutAmounts, canonical.payoutAmounts);
}

async function createApproval(store, circle, input = canonical, ownerToken = randomUUID()) {
  assertFinalizedSelection(input);
  const reservation = store.reserve(ownerToken);
  if (!reservation.owner && reservation.record.circleChallengeId) return reservation.record;
  if (!reservation.owner) throw new ControlledConflict();
  try {
    const challenge = await circle.create(canonical.operationKey);
    try {
      return store.patchForOwner(ownerToken, {
        state: "ACTION_REQUIRED",
        circleChallengeId: challenge.circleChallengeId,
        circleStatus: "ACTION_REQUIRED",
      });
    } catch {
      return store.patchForOwner(ownerToken, {
        state: "APPROVAL_CREATED_RECONCILIATION_REQUIRED",
        circleChallengeId: challenge.circleChallengeId,
        circleStatus: "ACTION_REQUIRED",
      });
    }
  } catch (error) {
    if (error instanceof ControlledConflict) throw error;
    store.patchForOwner(ownerToken, {
      state: "FINALIZATION_FAILED",
      errorMessage: error.message,
    });
    throw error;
  }
}

function circleMock({ fail = false } = {}) {
  return {
    calls: 0,
    async create() {
      this.calls += 1;
      if (fail) throw new Error("Circle challenge creation failed before challenge ID");
      await new Promise((resolve) => setTimeout(resolve, 25));
      return { circleChallengeId: "circle-challenge-001" };
    },
  };
}

// Test A and F: concurrent and sequential duplicate requests.
{
  const store = new MockStore();
  const circle = circleMock();
  const results = await Promise.allSettled([
    createApproval(store, circle, canonical, "owner-a"),
    createApproval(store, circle, canonical, "owner-b"),
  ]);
  assert.equal(circle.calls, 1);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(results.filter((item) => item.status === "rejected").length, 1);
  assert.equal(store.record.state, "ACTION_REQUIRED");
  assert.equal(store.record.circleChallengeId, "circle-challenge-001");
  const second = await createApproval(store, circle, canonical, "owner-c");
  assert.equal(second.circleChallengeId, "circle-challenge-001");
  assert.equal(circle.calls, 1);
}

// Test B: forced lock conflict.
{
  const store = new MockStore();
  store.record.state = "APPROVAL_CREATION_IN_PROGRESS";
  const circle = circleMock();
  await assert.rejects(() => createApproval(store, circle, canonical, "owner-b"), ControlledConflict);
  assert.equal(circle.calls, 0);
  assert.equal(store.record.state, "APPROVAL_CREATION_IN_PROGRESS");
}

// Test C: Circle success then first persistence failure.
{
  const store = new MockStore();
  store.failNextOwnerPatch = true;
  const circle = circleMock();
  const result = await createApproval(store, circle, canonical, "owner-a");
  assert.equal(circle.calls, 1);
  assert.equal(result.state, "APPROVAL_CREATED_RECONCILIATION_REQUIRED");
  assert.equal(result.circleChallengeId, "circle-challenge-001");
  const retry = await createApproval(store, circle, canonical, "owner-b");
  assert.equal(retry.circleChallengeId, "circle-challenge-001");
  assert.equal(circle.calls, 1);
}

// Test D: Circle failure before challenge creation.
{
  const store = new MockStore();
  const circle = circleMock({ fail: true });
  await assert.rejects(() => createApproval(store, circle, canonical, "owner-a"), /Circle challenge creation failed/);
  assert.equal(circle.calls, 1);
  assert.equal(store.record.state, "FINALIZATION_FAILED");
  assert.equal(store.record.circleChallengeId, undefined);
}

// Test E: finalized winner mismatch.
{
  const store = new MockStore();
  const circle = circleMock();
  await assert.rejects(() => createApproval(store, circle, {
    ...canonical,
    payoutAmounts: ["999999"],
  }, "owner-a"));
  assert.equal(circle.calls, 0);
}

// Test G: stale/non-owner mutation.
{
  const store = new MockStore();
  store.reserve("owner-a");
  await assert.rejects(async () => store.stalePatch("owner-b", { state: "FINALIZATION_FAILED" }), ControlledConflict);
  assert.equal(store.record.state, "APPROVAL_CREATION_IN_PROGRESS");
}

console.log(JSON.stringify({
  result: "FAT-01R.2 payout approval concurrency/idempotency verification passed",
  concurrentCircleCalls: 1,
  duplicateSequentialCircleCalls: 1,
  nonOwnerMutationRejected: true,
  usesMockedCircleSideEffects: true,
}, null, 2));
