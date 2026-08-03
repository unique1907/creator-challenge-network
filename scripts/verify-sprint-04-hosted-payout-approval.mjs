import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assertContains(file, needle, message) {
  const source = read(file);
  if (!source.includes(needle)) {
    throw new Error(`${message}\nMissing: ${needle}\nFile: ${file}`);
  }
}

function assertNotContains(file, needle, message) {
  const source = read(file);
  if (source.includes(needle)) {
    throw new Error(`${message}\nUnexpected: ${needle}\nFile: ${file}`);
  }
}

const route = "src/app/api/create-challenge/winner-finalization/route.ts";
const service = "src/services/create-challenge/winner-finalization.server.ts";
const adapter = "src/services/circle/payout-contract-execution.server.ts";
const client = "src/features/create-challenge/components/winner-finalization/payout-approval-client.tsx";
const types = "src/types/winner-finalization.ts";

assertContains(route, 'body.mode === "prepare"', "Winner finalization route must expose prepare mode.");
assertContains(route, 'body.mode === "create-approval"', "Winner finalization route must expose create-approval mode.");
assertContains(route, 'body.mode === "status"', "Winner finalization route must expose status mode.");
assertContains(route, 'body.mode === "reconcile"', "Winner finalization route must expose reconcile mode.");
assertContains(route, "assertNoClientAuthorityOverrides", "Route must reject client authority overrides.");
assertContains(route, '"transactionHash"', "Route override guard must reject client transaction hashes.");
assertContains(route, '"payoutWalletAddress"', "Route override guard must reject client payout wallet addresses.");

assertContains(service, "createTrustedPayoutCircleSession", "Service must create server-side trusted Circle sessions.");
assertContains(service, "CCN_PAYOUT_ACCOUNT_ID", "Service must bind the Circle session to the configured payout account.");
assertContains(service, "createPayoutContractExecutionChallenge", "Service must create hosted Circle payout approval challenges.");
assertContains(service, "verifyPayoutWalletResolverRole", "Service must verify resolver authority before payout approval.");
assertContains(service, 'state: "ACTION_REQUIRED"', "Service must persist hosted approval action-required state.");
assertContains(service, "verifyWinnersPaidReceipt", "Service must reconcile WinnersPaid before confirmation.");
assertContains(service, 'state: verified ? "PAYOUT_CONFIRMED" : "RECONCILIATION_REQUIRED"', "Service must only confirm payout after verified receipt/event evidence.");
assertNotContains(service, "0x0000000000000000000000000000000000000000000000000000000000000000", "Service must not fabricate a transaction hash.");

assertContains(adapter, "/v1/w3s/user/transactions/contractExecution", "Adapter must use Circle User-Controlled contractExecution.");
assertContains(adapter, "getPayoutChallengeTransaction", "Adapter must resolve Circle challenge to transaction ID.");
assertContains(adapter, "correlationIds", "Adapter must inspect Circle correlation IDs.");
assertContains(adapter, "circleChallengeId", "Adapter must preserve Circle challenge ID separately.");
assertContains(adapter, "circleTransactionId", "Adapter must preserve Circle transaction ID separately.");
assertContains(adapter, "verifyWinnersPaidReceipt", "Adapter must verify WinnersPaid receipt fields.");

assertContains(client, "@circle-fin/w3s-pw-web-sdk", "Client must use the Circle Web SDK.");
assertContains(client, "setAuthentication", "Client must set Circle hosted approval authentication.");
assertContains(client, ".execute(", "Client must execute the hosted Circle challenge.");
assertContains(client, 'mode: "create-approval"', "Client must request backend approval creation.");
assertContains(client, 'mode: "reconcile"', "Client callback must reconcile through the backend.");
assertNotContains(client, 'state: "PAYOUT_CONFIRMED"', "Client must not locally fabricate payout confirmation.");

assertContains(types, '"ACTION_REQUIRED"', "Winner finalization types must include hosted action-required state.");

console.log("Sprint 04 hosted payout approval static verification passed.");
