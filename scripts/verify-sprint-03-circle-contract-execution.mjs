import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const adapter = read("src/services/circle/payout-contract-execution.server.ts");
assert.ok(adapter.includes("/v1/w3s/user/transactions/contractExecution"), "payout adapter must use User-Controlled contract execution");
assert.ok(!adapter.includes("/v1/w3s/developer/transactions/contractExecution"), "payout adapter must not switch custody models");
assert.ok(adapter.includes("releasePayout(bytes32,address[])"), "payout adapter must target releasePayout");
assert.ok(adapter.includes("abiParameters: [input.challengeId, input.winners]"), "payout adapter must build exact releasePayout arguments");
assert.ok(adapter.includes("getScopedStoredWallet"), "payout wallet resolution must reuse scoped wallet mappings when available");
assert.ok(adapter.includes("CCN_PAYOUT_ACCOUNT_ID"), "payout account env must be named");
assert.ok(adapter.includes("CCN_PAYOUT_WALLET_ID"), "payout wallet id env must be named");
assert.ok(adapter.includes("CCN_PAYOUT_WALLET_ADDRESS"), "payout wallet address env must be named");
assert.ok(adapter.includes("CCN_PAYOUT_TREASURY_ADDRESS"), "payout treasury env must be named");
assert.ok(adapter.includes("CCN_ESCROW_CONTRACT_ADDRESS"), "escrow config env must be named");
assert.ok(adapter.includes("RESOLVER_ROLE") || adapter.includes("resolverRole"), "adapter must verify resolver role");
assert.ok(adapter.includes("WinnersPaid"), "adapter must verify WinnersPaid");
assert.ok(adapter.includes("ACTION_REQUIRED"), "adapter must model user approval required state");
assert.ok(adapter.includes("normalizeCircleTransactionState"), "adapter must normalize Circle transaction states");
assert.ok(!adapter.includes("privateKey"), "adapter must not use private keys");
assert.ok(!adapter.includes("transactionHash: \"0x"), "adapter must not fabricate hashes");

const finalization = read("src/services/create-challenge/winner-finalization.server.ts");
assert.ok(finalization.includes("payoutExecutionFacts"), "winner finalization facts must expose payout execution capabilities");
assert.ok(finalization.includes("createWinnerPayoutApproval"), "winner finalization must expose Sprint 04 hosted approval entrypoint");
assert.ok(finalization.includes("createPayoutContractExecutionChallenge("), "winner finalization may create payout challenge only through hosted approval integration");
assert.ok(finalization.includes("verifyWinnersPaidReceipt"), "winner finalization must not confirm payout without WinnersPaid reconciliation");
assert.ok(finalization.includes('state: verified ? "PAYOUT_CONFIRMED" : "RECONCILIATION_REQUIRED"'), "winner finalization must confirm only after verified chain evidence");
assert.ok(!finalization.includes('state: "ALREADY_FINALIZED"'), "winner finalization must not mark already finalized in Sprint 03");

const store = read("src/services/create-challenge/create-challenge-store.server.ts");
assert.ok(store.includes("payoutWalletId"), "finalization attempt must be able to persist payout wallet id");
assert.ok(store.includes("circleStatus"), "finalization attempt must be able to persist Circle status");
assert.ok(store.includes("reconciliation"), "finalization attempt must be able to persist reconciliation evidence");

const contract = read("contracts/src/CCNEscrow.sol");
assert.ok(contract.includes("function releasePayout"), "contract releasePayout must remain present");
assert.ok(contract.includes("event WinnersPaid"), "contract WinnersPaid event must remain present");

const report = read("SPRINT_03_REPORT.md");
assert.ok(report.includes("PARTIAL") || report.includes("FAIL"), "Sprint 03 report must not claim false success");
assert.ok(report.includes("No real Circle transaction was created"), "report must disclose no real transaction creation");

console.log("sprint 03 Circle contract execution gate: ok");
