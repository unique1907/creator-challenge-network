import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const contract = read("contracts/src/CCNEscrow.sol");
assert.ok(contract.includes("function releasePayout"), "CCNEscrow must expose releasePayout");
assert.ok(contract.includes("event WinnersPaid"), "CCNEscrow must expose WinnersPaid");
assert.ok(contract.includes("onlyRole(RESOLVER_ROLE)"), "releasePayout must remain resolver-gated");

const store = read("src/services/create-challenge/create-challenge-store.server.ts");
assert.ok(store.includes("winnerFinalizationAttempts"), "winner finalization attempts must be persisted");
assert.ok(store.includes("acquireWinnerFinalizationAttemptLock"), "persistent finalization lock helper must exist");
assert.ok(store.includes('stableUuid("winner-payout"'), "payout idempotency must be deterministic");
assert.ok(!store.includes("let inMemoryFinalizationLock"), "process-local finalization lock must not remain in store");

const service = read("src/services/create-challenge/winner-finalization.server.ts");
assert.ok(!service.includes("inMemoryFinalizationLock"), "process-local finalization lock must be removed");
assert.ok(service.includes("acquireWinnerFinalizationAttemptLock"), "service must use persistent lock");
assert.ok(service.includes("CCN_PAYOUT_TREASURY_ADDRESS"), "treasury must be server configured");
assert.ok(service.includes("createWinnerPayoutApproval"), "live payout must require hosted approval before execution");
assert.ok(service.includes("verifyWinnersPaidReceipt"), "live payout must remain blocked from confirmation until WinnersPaid is reconciled");
assert.ok(!service.includes('transactionHash: "0x'), "service must not fabricate transaction hashes");

const route = read("src/app/api/create-challenge/winner-finalization/route.ts");
assert.ok(!route.includes("body.treasuryRecipient"), "route must not accept client treasury recipient");

const report = read("SPRINT_02_REPORT.md");
assert.ok(report.includes("FAIL"), "Sprint 02 report must disclose the remaining blocker");
assert.ok(report.includes("No transaction submitted"), "report must not claim fabricated payout execution");

console.log("sprint 02 Circle payout execution gate: ok");
