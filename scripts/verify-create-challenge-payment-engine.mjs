import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const revenueConfig = read("src/config/create-challenge-payment.ts");
assert.ok(revenueConfig.includes('feeType: "PERCENT"'), "revenue model v1 must use percent fees");
assert.ok(revenueConfig.includes("feeValue: 10"), "revenue model v1 must use a 10 percent fee");
assert.ok(revenueConfig.includes('feePayer: "BRAND"'), "revenue model v1 must be paid by the Brand");
assert.ok(revenueConfig.includes("calculatePlatformFeeUnits"), "platform fee calculation must live in the canonical config module");

const finance = read("src/utils/create-challenge-finance.ts");
assert.ok(finance.includes("calculatePlatformFeeUnits(prizePoolUnits)"), "prize math must use the canonical revenue engine");
assert.ok(!finance.includes("PLATFORM_FEE_BPS"), "prize math must not define a duplicate platform fee percentage");
assert.ok(!finance.includes("BigInt(100)"), "prize math must not hardcode the old 1 percent fee");

const store = read("src/services/create-challenge/create-challenge-store.server.ts");
assert.ok(store.includes("CREATE_CHALLENGE_STORE_PATH"), "store must use an explicit configured path");
assert.ok(!store.includes('const STORE_PATH = join(process.cwd()'), "store path must not depend on process.cwd()");
assert.ok(store.includes("onChainVerificationsByTxHash"), "store must persist on-chain verifications by tx hash");
assert.ok(!store.includes("withKnownSuccessfulFundingRepair"), "store must not contain historical hardcoded funding repair logic");
assert.ok(!store.includes("0xb54ec51d29215aa8188fe61a3ce9524d456fdd280a40749c04cc5b486819e6dc"), "store must not embed historical local transaction hashes");
assert.ok(!store.includes("342e8371-87be-5ca5-b73a-9cdf8e53ac42"), "store must not embed historical Circle transaction IDs");
assert.ok(!store.includes("2f5fbbff-203f-5733-bf1b-69a4d80b7e8b"), "store must not embed historical wallet IDs");
assert.ok(store.includes("StoreCorruptionError"), "store read failures must never become an empty store");
assert.ok(store.includes("updateStore"), "critical store writes must go through updateStore");
assert.ok(store.includes("rename(tempPath, CREATE_CHALLENGE_STORE_PATH)"), "store writes must be atomic temp-file replacements");
assert.ok(store.includes("production must use a real database") || store.includes("productionWarning"), "local JSON store must warn about production DB");

const funding = read("src/services/create-challenge/create-challenge-funding.server.ts");
const activeStart = funding.indexOf("function activeApprovalStatus");
assert.notEqual(activeStart, -1, "activeApprovalStatus must exist");
const activeSource = funding.slice(activeStart, activeStart + 240);
assert.ok(activeSource.includes('status === "APPROVED"'), "APPROVED Circle status must be treated as active/completed");
const resolverStart = funding.indexOf("export function resolveCircleTransactionIdFromChallenge");
const resolverSource = funding.slice(resolverStart, resolverStart + 220);
assert.ok(resolverSource.indexOf("collectCorrelationIds") < resolverSource.indexOf("collectExplicitTransactionIds"), "transaction resolver must prefer correlationIds");
assert.ok(!resolverSource.includes("challenge.id"), "challenge id must not be treated as transaction id");
assert.ok(funding.includes("upsertOnChainVerification"), "funding verification must persist by-tx-hash evidence");
assert.ok(funding.includes("restoreFundingStateFromChain"), "funding recovery must restore generic persisted state from on-chain evidence");
assert.ok(funding.includes("findOnChainVerificationForDraft"), "funding publish/recovery must use exact draft/challenge/funding intent verification");
assert.ok(funding.includes('state: "RESTORED_FROM_CHAIN"'), "reconcile must report generic chain restoration without creating new funding");
assert.ok(funding.includes("eventVerified: verified.eventVerified"), "verified chain recovery must persist event verification from chain evidence");
assert.ok(funding.includes("transactionHash: verified.fundingTx"), "verified chain recovery must persist the funding transaction hash");
assert.ok(funding.indexOf("const activeFunding = attempts.find") < funding.indexOf("const verification = await getCanonicalFundingVerification"), "funding must reuse active attempts before creating new work");

const brand = read("src/services/create-challenge/brand-payment-account.server.ts");
assert.ok(brand.includes("hasVerifiedFundingEvidence"), "payment overview must consider exact funding evidence");
assert.ok(brand.includes("BigInt(allowance) >= BigInt(totalRequiredUnits)"), "allowance must be canonical approval evidence");
assert.ok(brand.indexOf("hasActiveFundingAttempt") < brand.indexOf("BigInt(allowance) >= BigInt(totalRequiredUnits)"), "funding pending must outrank allowance approval");
assert.ok(brand.includes("allowance,") && brand.includes("requiredAllowance") && brand.includes("approvalRequired"), "payment overview must expose allowance fields");
assert.ok(brand.includes("isCompleteFundingAttempt") && brand.includes("verifyAndPromoteCompleteFundingAttempt"), "payment overview must promote completed generic funding attempts from receipt evidence");
assert.ok(brand.includes("findOnChainVerificationForDraft(scope)"), "payment overview must use exact-scope on-chain verification records");
assert.ok(brand.includes("fundingStatus: \"funded\""), "payment overview promotion must repair funded draft status");
assert.ok(brand.includes("publicationStatus: \"ready-to-publish\""), "payment overview promotion must make verified drafts ready to publish");

for (const route of ["approve", "fund", "reconcile", "approval-recovery", "publish", "preflight", "verify"]) {
  const source = read(`src/app/api/create-challenge/${route}/route.ts`);
  assert.ok(source.includes("requireDraftId"), `${route} route must require exact draftId`);
}
for (const route of ["payment-overview", "payment-account"]) {
  const source = read(`src/app/api/create-challenge/${route}/route.ts`);
  assert.ok(source.includes("requireSearchDraftId"), `${route} route must require exact query draftId`);
}
const draftRoute = read("src/app/api/create-challenge/draft/route.ts");
assert.ok(draftRoute.includes("draftId is required unless new=1 or list=1"), "draft GET must not silently use activeDraftId");
assert.ok(draftRoute.includes("getCreateChallengeDraftForAccount"), "draft GET must use owner-scoped exact draft lookup");

const wizard = read("src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx");
assert.ok(wizard.includes("Choose Continue Problem Draft or New Business Challenge to begin."), "wizard must not silently create a draft without explicit choice");
assert.ok(!wizard.includes(': "/api/create-challenge/draft?new=1";'), "wizard must not auto-create a draft on missing draftId fallback");
assert.ok(wizard.includes("const blockingError: SafeError | null = error;"), "backend errors must render regardless of payment state");
assert.ok(wizard.includes('"RECONCILE"') && wizard.includes('"PUBLISH"'), "reconcile/publish error scopes must be represented");

console.log("create challenge payment engine regression: ok");
