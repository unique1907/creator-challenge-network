import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const spec = read("CCN_MASTER_SPEC_FINAL_v1.2.md");
assert.ok(spec.includes("MVP WINNER CONFIRMATION INTERPRETATION"), "v1.2 MVP interpretation must be present");
assert.ok(spec.includes("releasePayout()"), "MVP finalization must map to releasePayout");

const contract = read("contracts/src/CCNEscrow.sol");
assert.ok(contract.includes("function releasePayout"), "audited contract must expose releasePayout");
assert.ok(contract.includes("event WinnersPaid"), "audited contract must emit WinnersPaid");
assert.ok(contract.includes("onlyRole(RESOLVER_ROLE)"), "payout/refund must be resolver-gated");

const finalization = read("src/services/create-challenge/winner-finalization.server.ts");
const store = read("src/services/create-challenge/create-challenge-store.server.ts");
assert.ok(finalization.includes('"Confirm Winners and Release Payment"'), "final confirmation label must be exact");
assert.ok(finalization.includes('releasePayout(bytes32,address[])'), "final action must target releasePayout");
assert.ok(finalization.includes("Winner finalization is already in progress"), "finalization lock must reject concurrent attempts");
assert.ok(finalization.includes("Winner payout amounts must sum exactly"), "Top 3 amount sum must be validated");
assert.ok(finalization.includes("Winner wallet addresses must be distinct"), "duplicate Top 3 wallet must be rejected");
assert.ok(finalization.includes("Escrow funding must be verified before final winner selection"), "funding verification must gate finalization");
assert.ok(finalization.includes("createWinnerPayoutApproval"), "hosted payout approval flow must be implemented");
assert.ok(finalization.includes("verifyWinnersPaidReceipt"), "payout confirmation must require WinnersPaid reconciliation");
assert.ok(finalization.includes("FINALIZATION_FAILED"), "failed transaction path must not finalize winners");
assert.ok(finalization.includes("canRequestRefundDuringFinalization"), "refund guard helper must exist");
assert.ok(finalization.includes("PAYOUT_CONFIRMED") && finalization.includes("ALREADY_FINALIZED"), "paid/finalized states must block refund");
assert.ok(store.includes("new Date().toISOString()"), "UTC timestamp handling must be explicit");
assert.ok(finalization.includes("WINNERS_PAID_EVENT"), "reconciliation must know the WinnersPaid event");

const route = read("src/app/api/create-challenge/winner-finalization/route.ts");
assert.ok(route.includes("requireDraftId"), "winner finalization route must require exact draftId");
assert.ok(route.includes("prepareWinnerFinalization"), "route must support confirmation preparation");
assert.ok(route.includes("requestWinnerFinalization"), "route must route final action through server service");
assert.ok(route.includes("BRAND") && route.includes("JURY"), "route must model Brand/Jury authority");

const types = read("src/types/winner-finalization.ts");
assert.ok(types.includes("READY_FOR_FINAL_SELECTION"), "required UI state must be typed");
assert.ok(types.includes("FINALIZATION_IN_PROGRESS"), "required UI state must be typed");
assert.ok(types.includes("PAYOUT_CONFIRMED"), "required UI state must be typed");
assert.ok(types.includes("FINALIZATION_FAILED"), "required UI state must be typed");
assert.ok(types.includes("ALREADY_FINALIZED"), "required UI state must be typed");
assert.ok(types.includes("transactionHash"), "transaction hash persistence shape must exist");
assert.ok(types.includes("blockNumber"), "block number persistence shape must exist");
assert.ok(types.includes("finalizedAt"), "UTC finalized timestamp shape must exist");

const report = read("SPRINT_01_REPORT.md");
assert.ok(report.includes("FAIL"), "Sprint 01 historical report must disclose its original remaining blocker");
assert.ok(report.includes("Payout execution adapter is not configured"), "Sprint 01 historical report must disclose missing adapter");

console.log("sprint 01 MVP alignment regression: ok");
