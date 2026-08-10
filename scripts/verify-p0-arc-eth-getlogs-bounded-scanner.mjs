import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const funding = read("src/services/create-challenge/create-challenge-funding.server.ts");
const fundRoute = read("src/app/api/create-challenge/fund/route.ts");
const reconcileRoute = read("src/app/api/create-challenge/reconcile/route.ts");
const contract = read("contracts/src/CCNEscrow.sol");

assert.ok(funding.includes("const LOG_BLOCK_CHUNK_SIZE = BigInt(500);"), "Arc log scanner must use the locked 500-block chunk size");
assert.ok(funding.includes("const LOG_CHUNK_RETRY_ATTEMPTS = 2;"), "Arc log scanner must use bounded two-attempt retries");
assert.ok(!funding.includes("LOG_BLOCK_SPAN"), "old 10,000-block span must be removed");

const scannerStart = funding.indexOf("async function scanDecodedLogs");
assert.notEqual(scannerStart, -1, "shared decoded log scanner must exist");
const scanner = funding.slice(scannerStart, funding.indexOf("async function getChallengeFundedLogs"));
assert.ok(scanner.includes("exactBlock"), "scanner must support exact single-block verification");
assert.ok(scanner.includes("LOG_BLOCK_CHUNK_SIZE - BigInt(1)"), "scanner must build inclusive 500-block ranges");
assert.ok(scanner.includes('input.direction === "backward"'), "scanner must support backward scans for latest approval evidence");
assert.ok(scanner.includes("stopOnFirstMatch && page.length > 0"), "scanner must stop after the relevant event is found");
assert.ok(scanner.includes("fromBlock: from") && scanner.includes("toBlock: to"), "scanner must pass deterministic inclusive ranges");
assert.ok(!scanner.includes("fromBlock: `0x${deploymentBlock.toString(16)}`") || scanner.includes("to = from + chunkSpan"), "scanner must not request deployment-to-latest in one call");

const rangeStart = funding.indexOf("async function getLogsForRange");
assert.notEqual(rangeStart, -1, "per-range log query helper must exist");
const rangeHelper = funding.slice(rangeStart, scannerStart);
assert.ok(rangeHelper.includes('rpc<ReceiptLog[]>("eth_getLogs"'), "range helper must be the only raw eth_getLogs call site");
assert.ok(rangeHelper.includes("attempt <= LOG_CHUNK_RETRY_ATTEMPTS"), "range helper must bound retries per chunk");
assert.ok(rangeHelper.includes("isRecoverableLogRpcError(error)") && rangeHelper.includes("error.safe.code"), "range helper must preserve original RPC code internally");
assert.ok(rangeHelper.includes("logRangeVerificationError(input.fromBlock, input.toBlock"), "permanent chunk failure must expose exact failing range");

assert.ok(
  funding.includes("Arc event verification is temporarily unavailable for blocks ${from.toString()}-${to.toString()}. No funding transaction was submitted. Retry verification before funding."),
  "raw -32603 payload must be replaced by the clear recoverable user message",
);

const receiptStart = funding.indexOf("function getChallengeFundedEventFromReceipt");
assert.notEqual(receiptStart, -1, "receipt-first ChallengeFunded inspection must exist");
const buildStart = funding.indexOf("async function buildCanonicalFundingVerification");
const fundingCreateStart = funding.indexOf("export async function createProductFundingChallenge");
const buildSource = funding.slice(buildStart, fundingCreateStart);
assert.ok(
  buildSource.includes("SELECTORS.isFunded") &&
    buildSource.includes("SELECTORS.allowance") &&
    buildSource.includes("SELECTORS.getChallenge") &&
    buildSource.includes("SELECTORS.getPrizeDistribution"),
  "restored baseline verification must read canonical funding, allowance, challenge, and prize distribution state",
);
assert.ok(buildSource.indexOf("let receipt = fundingTx ? await getReceipt(fundingTx) : null") < buildSource.indexOf("getChallengeFundedEventFromReceipt"), "known transaction receipt must be inspected before historical scans");
assert.ok(buildSource.includes("receiptFundedEvent"), "receipt logs must be used as funding event evidence");
assert.ok(buildSource.includes("exactBlock: receipt.blockNumber"), "known transaction block must use exact single-block scanning when receipt logs do not match");
assert.ok(buildSource.includes("} else if (escrow.isFunded) {"), "historical funding scans must be reserved for already-funded chain state without known receipt evidence");
assert.ok(buildSource.includes("if (!persistedApprovalTx && BigInt(allowance) >= BigInt(intent.totalRequired))"), "approval log recovery must only scan when allowance is sufficient and no approval tx is persisted");
assert.ok(!buildSource.includes("safe.status !== 503"), "permanent log scanner failures must not be swallowed");

const fundingAction = funding.slice(fundingCreateStart, funding.indexOf("function collectStringCandidates"));
assert.ok(fundingAction.indexOf("const activeAttempt = fundingAttempts.find") < fundingAction.indexOf("const verification = await getCanonicalFundingVerification"), "funding must reuse active attempts before verification");
assert.ok(fundingAction.indexOf("const verification = await getCanonicalFundingVerification") < fundingAction.indexOf('circleFetch<CircleContractExecutionResponse>'), "canonical verification must happen before Circle funding submission");
assert.ok(!fundingAction.includes('phase: "PRE_CIRCLE_PREPARING"'), "restored funding path must not use the abandoned pre-Circle preparing phase");
assert.ok(fundingAction.indexOf('circleFetch<CircleContractExecutionResponse>') < fundingAction.indexOf("await persistFundingAttempt"), "restored funding path must persist funding attempt evidence after Circle accepts contractExecution");

assert.ok(fundRoute.includes("createProductFundingChallenge"), "fund route must still use the canonical funding service");
assert.ok(reconcileRoute.includes("reconcileProductTransaction"), "reconcile route must still use the canonical reconciliation service");
assert.ok(contract.includes("event ChallengeFunded("), "contract event definition must remain unchanged");
assert.ok(contract.includes("function fundChallenge("), "contract funding entrypoint must remain unchanged");

console.log("p0 arc eth_getLogs bounded scanner regression: ok");
