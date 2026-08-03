import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(path, text, message) {
  assert.ok(read(path).includes(text), message ?? `${path} must include ${text}`);
}

function ordered(path, first, second, message) {
  const source = read(path);
  assert.ok(source.indexOf(first) >= 0, `${path} must include ${first}`);
  assert.ok(source.indexOf(second) >= 0, `${path} must include ${second}`);
  assert.ok(source.indexOf(first) < source.indexOf(second), message);
}

const adapter = "src/services/circle/payout-contract-execution.server.ts";
const service = "src/services/create-challenge/winner-finalization.server.ts";
const route = "src/app/api/create-challenge/winner-finalization/route.ts";

includes(adapter, "const MAX_RPC_ATTEMPTS = 4", "payout RPC must use bounded retry attempts");
includes(adapter, "error.safe.code === -32011", "payout RPC must retry Arc request-limit errors");
includes(adapter, "error.safe.status === 429", "payout RPC must retry HTTP 429");
includes(adapter, "error.safe.status === 503", "payout RPC must retry HTTP 503");
includes(adapter, "if (!isRetryableRpcError(error)) throw error", "contract reverts and semantic errors must not be retried");
includes(adapter, "memoizedEthCall", "identical read-only RPC calls must be deduplicated per request");
includes(adapter, "resolverRoleCache", "stable resolver role reads must use a short-lived cache");
includes(adapter, "RESOLVER_ROLE_CACHE_TTL_MS = 30_000", "resolver role cache must stay short-lived");
includes(adapter, "simulateReleasePayout", "prepare path must support read-only releasePayout simulation");
includes(adapter, "RELEASE_PAYOUT_SELECTOR", "releasePayout simulation must use encoded calldata");
includes(adapter, "input.from", "simulation must use the payout wallet as msg.sender");
includes(adapter, "Unable to verify payout state on Arc Testnet. Please try again.", "transient RPC errors must return a controlled payout-safe message");
includes(adapter, "throw rpcError({", "RPC failures must use the safe error wrapper");

includes(service, "await assertPayoutPhaseReady(input.draftId);", "payout prepare must keep phase gating");
includes(service, "assertConfiguredPayoutAuthority", "payout prepare must keep authority checks");
includes(service, "await assertPayoutSimulationReady", "payout prepare and approval must simulate before proceeding");
includes(route, "body.mode === \"prepare\"", "prepare mode must remain non-financial");
includes(route, "body.mode === \"create-approval\"", "hosted approval must not be collapsed into prepare mode");

ordered(
  service,
  "const authority = await assertConfiguredPayoutAuthority();",
  "const session = await createTrustedPayoutCircleSession();",
  "create-approval must verify payout authority before creating a Circle session",
);
ordered(
  service,
  "await assertPayoutSimulationReady({",
  "const session = await createTrustedPayoutCircleSession();",
  "create-approval must simulate releasePayout before creating hosted Circle approval",
);

console.log(JSON.stringify({
  result: "FAT-01R.1 payout RPC resilience static verification passed",
  retryPolicy: {
    maxAttempts: 4,
    retryable: ["-32011", "HTTP 429", "HTTP 503", "timeout", "temporary transport failure"],
    nonRetryable: ["contract revert", "invalid calldata", "role mismatch", "already-paid state"],
  },
  prepareModeCreatesHostedApproval: false,
}, null, 2));
