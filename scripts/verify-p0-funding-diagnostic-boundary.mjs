import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const route = read("src/app/api/create-challenge/fund/route.ts");
const funding = read("src/services/create-challenge/create-challenge-funding.server.ts");

assert.ok(route.includes('event: "create_challenge_funding_failed"'), "generic funding failure must emit a structured server diagnostic event");
assert.ok(route.includes('message: "Funding request failed.", code'), "generic client response must preserve safe copy and include a technical code");
assert.ok(route.includes("function classifyFundingException"), "generic funding failures must be classified at the route boundary");
assert.ok(route.includes('"FUNDING_PERSISTENCE_FAILED"'), "persistence failures must have a safe diagnostic code");
assert.ok(route.includes('"FUNDING_WALLET_RESOLUTION_FAILED"'), "wallet failures must have a safe diagnostic code");
assert.ok(route.includes('"FUNDING_ARC_READ_FAILED"'), "Arc read failures must have a safe diagnostic code");
assert.ok(route.includes('"FUNDING_CIRCLE_REQUEST_FAILED"'), "Circle request failures must have a safe diagnostic code");
assert.ok(route.includes('"FUNDING_UNKNOWN_SERVER_ERROR"'), "unknown failures must have a safe fallback diagnostic code");

assert.ok(route.includes("if (error instanceof CircleSpikeError)"), "existing CircleSpikeError handling must remain first-class");
assert.ok(route.includes("return NextResponse.json({ error: error.safe }, { status: error.safe.status ?? 400 })"), "CircleSpikeError response semantics must remain unchanged");
assert.ok(route.includes("if (error instanceof CcnAuthError) return authErrorResponse(error);"), "CcnAuthError handling must remain unchanged");
assert.ok(route.includes("return safeRouteError(error, { draftId });"), "route must pass only safe request context into the error boundary");

assert.ok(route.includes("console.error"), "diagnostic must be server-side logging only");
assert.ok(route.includes("JSON.stringify(diagnostic)"), "diagnostic log must be structured");
assert.ok(route.includes("safeString"), "diagnostic fields must be sanitized before logging");
const diagnosticStart = route.indexOf("function logFundingDiagnostic");
const diagnosticBody = route.slice(diagnosticStart, route.indexOf("function safeRouteError", diagnosticStart));
for (const forbidden of ["headers", "CIRCLE_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "userToken:", "body.userToken", "Authorization"]) {
  assert.ok(!diagnosticBody.includes(forbidden), `diagnostic logger must not log or reference sensitive ${forbidden}`);
}

const postStart = route.indexOf("export async function POST");
const postBody = route.slice(postStart);
assert.ok(postBody.includes("createProductFundingChallenge(body.userToken, draftId, { ccnAccountId: context.ccnAccountId })"), "successful funding path must still call the canonical funding service exactly once");
assert.ok(postBody.includes("getCreateChallengePaymentOverview(draftId, undefined, { ccnAccountId: context.ccnAccountId })"), "successful payment overview refresh must remain unchanged");
assert.ok(!route.includes("circleFetch<") && !route.includes("fetch(") && !route.includes("rpc("), "fund route diagnostic must not add Circle or Arc calls");

const fundingStart = funding.indexOf("export async function createProductFundingChallenge");
const fundingAction = funding.slice(fundingStart, funding.indexOf("function collectStringCandidates"));
assert.ok(fundingAction.indexOf("const wallet = await getBrandWallet") < fundingAction.indexOf("const verification = await getCanonicalFundingVerification"), "funding execution order must remain unchanged");
assert.ok(fundingAction.indexOf("const verification = await getCanonicalFundingVerification") < fundingAction.indexOf('circleFetch<CircleContractExecutionResponse>'), "Circle submission must still happen after canonical verification");
assert.ok(fundingAction.indexOf('circleFetch<CircleContractExecutionResponse>') < fundingAction.indexOf("await persistFundingAttempt"), "persistence after Circle acceptance must remain unchanged");

console.log("p0 funding diagnostic boundary: ok");
