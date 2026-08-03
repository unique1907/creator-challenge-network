import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assertContains(path, needle, message) {
  assert.ok(read(path).includes(needle), `${message}\nMissing: ${needle}\nFile: ${path}`);
}

function assertNotContains(path, needle, message) {
  assert.ok(!read(path).includes(needle), `${message}\nUnexpected: ${needle}\nFile: ${path}`);
}

const service = "src/services/create-challenge/winner-finalization.server.ts";
const adapter = "src/services/circle/payout-contract-execution.server.ts";
const store = "src/services/create-challenge/create-challenge-store.server.ts";
const workspace = "src/features/dashboard/components/campaign-workspace.tsx";
const tabs = "src/features/dashboard/components/campaign-workspace-tabs.tsx";

assertContains(adapter, "readEscrowChallengeSnapshot", "payout adapter must expose an escrow snapshot reader");
assertContains(adapter, "getPrizeDistribution", "snapshot reader must read getPrizeDistribution");
assertContains(adapter, "treasury", "snapshot reader must read treasury");
assertContains(adapter, '"REJECTED"', "Circle terminal failures must include rejected equivalents");
assertContains(adapter, '"TIMED_OUT"', "Circle terminal failures must include timeout equivalents");

assertContains(service, "verifyOnChainPayoutReadiness", "service must verify app state against on-chain escrow state");
assertContains(service, "readEscrowChallengeSnapshot", "service must use the runtime escrow snapshot before approval");
assertContains(service, "assertPayoutReadiness", "service must fail closed on payout readiness mismatch");
assertContains(service, "mismatches.push(\"prizePool\")", "readiness must reject prize pool mismatches");
assertContains(service, "mismatches.push(\"platformFee\")", "readiness must reject platform fee mismatches");
assertContains(service, "mismatches.push(\"prizeDistribution\")", "readiness must reject distribution mismatches");
assertContains(service, "mismatches.push(\"winnerCount\")", "readiness must reject winner count mismatches");
assertContains(service, "mismatches.push(\"sponsor\")", "readiness must reject sponsor wallet mismatches");
assertContains(service, "mismatches.push(\"submissionDeadline\")", "readiness must reject submission deadline mismatches");
assertContains(service, "mismatches.push(\"reviewDeadline\")", "readiness must reject review deadline mismatches");
assertContains(service, "mismatches.push(\"contractStatus\")", "readiness must reject non-funded contract status");
assertContains(service, "assertVerifiedWinnerPayoutWallets", "service must verify winner payout wallets");
assertContains(service, "getVerifiedCreatorPayoutMapping(winner.creatorAccountId)", "winner wallet check must use the canonical Creator Foundation payout resolver");
assertNotContains(service, "role: \"CREATOR\"", "settlement winner wallet verification must not depend on legacy CREATOR:PAYOUT mappings");
assertNotContains(service, "purpose: \"PAYOUT\"", "settlement winner wallet verification must not depend on legacy CREATOR:PAYOUT mappings");
assertContains(service, 'mapping.blockchain !== "ARC-TESTNET"', "wrong-network creator payout wallets must fail closed");
assertContains(service, 'mapping.accountType !== "SCA"', "non-SCA creator payout wallets must fail closed");
assertContains(service, 'mapping.walletState.toLowerCase() !== "live"', "inactive creator payout wallets must fail closed");
assertContains(service, "mapping.walletAddress.toLowerCase() !== walletAddress", "mismatched creator payout wallets must fail closed");
assertContains(service, "0x1111111111111111111111111111111111111111", "known placeholder winner wallet must be rejected");
assertContains(service, "Winner payout wallet is not verified for this creator.", "winner wallet rejection must use safe copy");
assertContains(service, "resolveSubmittedSelections", "finalized settlement recovery must resolve canonical submissions");
assertContains(service, "getPayoutChallengeTransaction", "status recovery must inspect an existing Circle challenge");
assertContains(service, "getPayoutTransactionStatus", "status recovery must inspect an existing Circle transaction");
assertContains(service, "reconcileFinalizedWinnerPayout", "status recovery must reuse blockchain-first reconciliation");
assertContains(service, "isTerminalNegativeCircleState", "service must map terminal Circle failures");
assertContains(service, 'state: "FINALIZATION_FAILED"', "terminal Circle failures must persist FINALIZATION_FAILED");
assertContains(service, "persistVerifiedPayoutEvidence", "verified settlement must persist normalized payout evidence");
assertContains(service, 'eventType: "ChallengePayout"', "application event type must normalize WinnersPaid as ChallengePayout");
assertContains(service, 'eventName: "WinnersPaid"', "normalized evidence must retain the contract event name");
assertContains(service, 'eventType: "SETTLEMENT_COMPLETED"', "settlement completion lifecycle event must be persisted");

assertContains(store, "upsertOnChainVerification", "store must retain normalized on-chain verification persistence");
assertContains(store, "upsertLifecycleEvent", "store must expose idempotent settlement lifecycle event persistence");
assertContains(store, "ccn_lifecycle_events", "lifecycle events must use the Supabase lifecycle table");
assertContains(store, 'onConflict: "event_id"', "lifecycle event persistence must be idempotent");

assertContains(workspace, "#settlement", "workspace primary payout action must deep-link to the Settlement tab");
assertNotContains(workspace, "/internal/fat01-payout-approval", "normal Campaign Workspace actions must not expose internal FAT payout routes");
assertContains(tabs, "activeTab", "settlement hash must use the existing tab state mechanism");
assertContains(tabs, 'tab.id !== "settlement" || settlementUnlocked', "Settlement tab must remain lifecycle-gated");
assertContains(tabs, "disabled={pending !== null || payoutConfirmed}", "Refresh Status must remain available before confirmation");

function compareReadiness({ app, chain }) {
  const mismatches = [];
  if (!chain.isFunded) mismatches.push("isFunded");
  if (chain.status !== "FUNDED") mismatches.push("contractStatus");
  if (chain.sponsor.toLowerCase() !== app.sponsor.toLowerCase()) mismatches.push("sponsor");
  if (String(BigInt(chain.prizePool)) !== String(BigInt(app.prizePool))) mismatches.push("prizePool");
  if (String(BigInt(chain.platformFee)) !== String(BigInt(app.platformFee))) mismatches.push("platformFee");
  if (chain.winnerCount !== app.winnerCount) mismatches.push("winnerCount");
  if (chain.prizeDistribution.join(":") !== app.prizeDistribution.join(":")) mismatches.push("prizeDistribution");
  if (chain.submissionDeadline !== app.submissionDeadline) mismatches.push("submissionDeadline");
  if (chain.reviewDeadline !== app.reviewDeadline) mismatches.push("reviewDeadline");
  return mismatches;
}

const app = {
  sponsor: "0xB1E2700290381396BC2A85bb6C286EaD5e80A5dd",
  prizePool: "1000000",
  platformFee: "100000",
  winnerCount: 1,
  prizeDistribution: ["1000000"],
  submissionDeadline: 100,
  reviewDeadline: 200,
};
const exactChain = { ...app, isFunded: true, status: "FUNDED" };
assert.deepEqual(compareReadiness({ app, chain: exactChain }), []);
assert.ok(compareReadiness({ app, chain: { ...exactChain, prizePool: "2000000" } }).includes("prizePool"));
assert.ok(compareReadiness({ app, chain: { ...exactChain, platformFee: "200000" } }).includes("platformFee"));
assert.ok(compareReadiness({ app, chain: { ...exactChain, prizeDistribution: ["500000", "500000"] } }).includes("prizeDistribution"));
assert.ok(compareReadiness({ app, chain: { ...exactChain, winnerCount: 3 } }).includes("winnerCount"));
assert.ok(compareReadiness({ app, chain: { ...exactChain, sponsor: "0x0000000000000000000000000000000000000001" } }).includes("sponsor"));
assert.ok(compareReadiness({ app, chain: { ...exactChain, submissionDeadline: 101 } }).includes("submissionDeadline"));
assert.ok(compareReadiness({ app, chain: { ...exactChain, reviewDeadline: 201 } }).includes("reviewDeadline"));
assert.ok(compareReadiness({ app, chain: { ...exactChain, isFunded: false } }).includes("isFunded"));
assert.ok(compareReadiness({ app, chain: { ...exactChain, status: "PAID" } }).includes("contractStatus"));

console.log(JSON.stringify({
  result: "Sprint 5C settlement remediation static verification passed",
  onChainReadinessCases: 9,
  winnerWalletHardening: true,
  readOnlyCircleRecovery: true,
  terminalFailureMapping: true,
  workspaceSettlementRouting: true,
  normalizedPayoutEvidence: true,
  usesMocksOnly: true,
}, null, 2));
