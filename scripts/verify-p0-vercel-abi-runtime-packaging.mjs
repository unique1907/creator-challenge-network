import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const funding = read("src/services/create-challenge/create-challenge-funding.server.ts");
const abiModule = read("src/contracts/ccn-escrow-abi.ts");
const contract = read("contracts/src/CCNEscrow.sol");
const packageJson = read("package.json");

assert.ok(
  funding.includes('import { CCN_ESCROW_ABI, type CcnEscrowAbiEntry } from "@/contracts/ccn-escrow-abi";'),
  "funding runtime must import the bundled CCNEscrow ABI module",
);
assert.ok(!funding.includes('from "node:fs"'), "funding runtime must not import node:fs for ABI loading");
assert.ok(!funding.includes('from "node:path"'), "funding runtime must not import node:path for ABI loading");
assert.ok(!funding.includes("contracts/out"), "funding runtime must not depend on Foundry contracts/out artifacts");
assert.ok(!funding.includes("CCNEscrow.json"), "funding runtime must not open CCNEscrow.json at request time");

const loadStart = funding.indexOf("function loadEscrowAbi()");
assert.notEqual(loadStart, -1, "loadEscrowAbi must still exist");
const loadSource = funding.slice(loadStart, funding.indexOf("function assertCompiledEscrowAbi"));
assert.ok(loadSource.includes("CCN_ESCROW_ABI"), "loadEscrowAbi must use the bundled ABI");
assert.ok(!loadSource.includes("readFileSync"), "loadEscrowAbi must perform no filesystem reads");
assert.ok(!loadSource.includes("process.cwd()"), "loadEscrowAbi must not resolve runtime filesystem artifact paths");

const buildStart = funding.indexOf("async function buildCanonicalFundingVerification");
const fundingCreateStart = funding.indexOf("export async function createProductFundingChallenge");
assert.notEqual(buildStart, -1, "canonical funding verification builder must exist");
assert.notEqual(fundingCreateStart, -1, "createProductFundingChallenge must exist");
const buildSource = funding.slice(buildStart, fundingCreateStart);
assert.ok(
  buildSource.indexOf("assertCompiledEscrowAbi();") < buildSource.indexOf("const callResults = await rpcBatch"),
  "ABI shape validation must still run before canonical Arc verification calls",
);
assert.ok(
  buildSource.includes("SELECTORS.isFunded") &&
    buildSource.includes("SELECTORS.getChallenge") &&
    buildSource.includes("SELECTORS.getPrizeDistribution") &&
    buildSource.includes("SELECTORS.paused") &&
    buildSource.includes("SELECTORS.allowance"),
  "Arc verification semantics must still include funded, challenge, distribution, paused, and allowance checks",
);

const requiredAbiNames = [
  "ChallengeFunded",
  "fundChallenge",
  "getChallenge",
  "getPrizeDistribution",
  "getTotalLockedLiabilities",
  "isFunded",
  "paused",
  "totalLockedPlatformFees",
  "totalLockedPrizePools",
  "treasury",
  "usdc",
];
for (const name of requiredAbiNames) {
  assert.ok(abiModule.includes(`name: "${name}"`), `bundled ABI must include ${name}`);
}
for (const fragment of [
  '{ name: "challengeId", type: "bytes32", indexed: true }',
  '{ name: "sponsor", type: "address", indexed: true }',
  '{ name: "prizePool", type: "uint256", indexed: false }',
  '{ name: "platformFee", type: "uint256", indexed: false }',
  '{ name: "winnerCount", type: "uint8", indexed: false }',
  '{ name: "submissionDeadline", type: "uint64", indexed: false }',
  '{ name: "reviewDeadline", type: "uint64", indexed: false }',
]) {
  assert.ok(abiModule.includes(fragment), `ChallengeFunded ABI must preserve ${fragment}`);
}
assert.ok(
  abiModule.includes('{ name: "status", type: "uint8" }') &&
    abiModule.includes('{ name: "", type: "uint256[]" }'),
  "bundled ABI must preserve getChallenge status and getPrizeDistribution outputs",
);

assert.ok(contract.includes("event ChallengeFunded("), "Solidity ChallengeFunded event must remain present");
assert.ok(contract.includes("function fundChallenge("), "Solidity fundChallenge entrypoint must remain present");
assert.ok(contract.includes("function getChallenge(bytes32 challengeId)"), "Solidity getChallenge view must remain present");
assert.ok(contract.includes("function getPrizeDistribution(bytes32 challengeId)"), "Solidity getPrizeDistribution view must remain present");
assert.ok(contract.includes("function isFunded(bytes32 challengeId)"), "Solidity isFunded view must remain present");
assert.ok(contract.includes("function getTotalLockedLiabilities()"), "Solidity liability view must remain present");

const fundingAction = funding.slice(fundingCreateStart, funding.indexOf("function collectStringCandidates"));
assert.ok(
  fundingAction.includes('endpoint: "/v1/w3s/user/transactions/contractExecution"') &&
    fundingAction.includes('abiFunctionSignature: "fundChallenge(bytes32,uint256[],uint256,uint64,uint64)"'),
  "Circle contractExecution request target and function signature must remain unchanged",
);
assert.ok(
  fundingAction.indexOf("const verification = await getCanonicalFundingVerification") <
    fundingAction.indexOf('circleFetch<CircleContractExecutionResponse>'),
  "canonical Arc verification must still happen before Circle contractExecution",
);
assert.ok(
  packageJson.includes('"test:p0-vercel-abi-runtime-packaging": "node scripts/verify-p0-vercel-abi-runtime-packaging.mjs"'),
  "package script must expose the focused Vercel ABI runtime packaging verifier",
);

console.log("p0 vercel abi runtime packaging: ok");
