import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(path, text, message) {
  assert.ok(read(path).includes(text), message ?? `${path} must include ${text}`);
}

function excludes(path, text, message) {
  assert.ok(!read(path).includes(text), message ?? `${path} must not include ${text}`);
}

const canonical = "src/services/submissions/canonical-challenge-lifecycle.server.ts";
const submissionStore = "src/services/submissions/submission-store.server.ts";
const submissionTypes = "src/types/submission.ts";
const winnerRoute = "src/app/api/create-challenge/winner-finalization/route.ts";
const draftRoute = "src/app/api/internal/submissions/draft/route.ts";
const finalizeRoute = "src/app/api/internal/submissions/finalize/route.ts";
const statusRoute = "src/app/api/internal/submissions/status/route.ts";
const blindRoute = "src/app/api/internal/blind-review/entries/route.ts";
const payoutAdapter = "src/services/circle/payout-contract-execution.server.ts";

includes(canonical, "getCreateChallengeDraftStrict", "canonical lifecycle must resolve the Create Challenge draft");
includes(canonical, "getFundingIntentFromDraft", "canonical lifecycle must derive funding identity from the draft");
includes(canonical, "CREATE_CHALLENGE_ESCROW_CONTRACT", "canonical lifecycle must bind to active escrow contract");
includes(canonical, "draft.deployment.publicationStatus !== \"live\"", "submissions must require LIVE challenges");
includes(canonical, "findOnChainVerificationForDraft", "submissions must require persisted on-chain funding evidence");
includes(canonical, "resolveCanonicalWinnerSelection", "winner selection must be server-resolved from blind entries");
includes(canonical, "resolveSubmittedSelections", "winner selection must resolve canonical submissions server-side");
includes(canonical, "payoutAmountUnits: draft.prizePool.distributionUnits[index]", "payout allocation must come from draft prize distribution");
excludes(canonical, "getEscrowFundingIntent", "production canonical lifecycle must not read the historical escrow funding singleton");

for (const route of [draftRoute, finalizeRoute, statusRoute, blindRoute]) {
  includes(route, "canonical-challenge-lifecycle.server", `${route} must use canonical challenge lifecycle`);
  excludes(route, "verifyFundedChallengeForSubmission", `${route} must not use historical funded challenge verifier`);
  excludes(route, "getEscrowFundingIntent", `${route} must not read historical escrow funding intent`);
}

includes(submissionTypes, "blindEntryId: string", "blind-review projection must expose a non-identity canonical reference");
includes(submissionStore, "MAX_SUBMISSIONS_PER_CHALLENGE", "submission store must enforce max submission count");
includes(submissionStore, "MAX_SUBMISSION_VERSIONS", "submission store must enforce max three versions");
includes(submissionStore, "creatorWalletAddress", "canonical store must retain creator wallet internally");
includes(submissionStore, "assertBlindReviewProjectionIsAnonymous", "blind-review privacy guard must remain present");
includes(submissionStore, '"creatorWalletAddress"', "privacy guard must reject creator wallet field in projection");
includes(submissionStore, "resolveSubmittedSelections", "store must resolve blind entry IDs back to submitted canonical records");

includes(winnerRoute, "resolveCanonicalWinnerSelection", "winner finalization must derive winners from blind selections");
includes(winnerRoute, "selectedBlindEntryIds", "winner finalization route must accept blind entry IDs");
includes(winnerRoute, "Client-supplied winner wallet payloads are not accepted", "arbitrary client winner wallet payloads must be rejected");
excludes(winnerRoute, "parseWinners(body.selectedWinners)", "winner finalization must not trust client selectedWinners payloads");

includes(payoutAdapter, "CCN_PAYOUT_WALLET_ID", "payout runtime must require configured payout wallet ID");
includes(payoutAdapter, "CCN_PAYOUT_WALLET_ADDRESS", "payout runtime must require configured payout wallet address");
includes(payoutAdapter, "Scoped payout wallet mapping does not match server configuration", "payout env must match scoped wallet mapping");
includes(payoutAdapter, "verifyPayoutWalletResolverRole", "payout preparation must verify resolver role");

console.log("Sprint 08A canonical lifecycle static verification passed.");
