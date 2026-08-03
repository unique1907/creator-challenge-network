import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(file, needle, message) {
  assert.ok(read(file).includes(needle), message);
}

function notIncludes(file, needle, message) {
  assert.ok(!read(file).includes(needle), message);
}

const policy = "src/config/create-challenge-deadline-policy.ts";
const store = "src/services/create-challenge/create-challenge-store.server.ts";
const readiness = "src/utils/create-challenge-launch-readiness.ts";
const legacyFunding = "src/services/circle/escrow-funding.server.ts";
const wizard = "src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx";
const envExample = ".env.example";
const contract = "contracts/src/CCNEscrow.sol";

includes(policy, "PRODUCTION_DEADLINE_WINDOW_MINUTES = 1_440", "production default must remain 24 hours");
includes(policy, "SHORT_SMOKE_DEADLINE_WINDOW_MINUTES = 15", "short smoke default must remain 15 minutes");
includes(policy, "CCN_ENABLE_SHORT_SMOKE_WINDOWS", "policy must read explicit short smoke window flag");
includes(policy, "CCN_SMOKE_TEST_MODE", "policy must read server-side smoke mode");
includes(policy, "mode: \"production\"", "policy must expose production mode");
includes(policy, "mode: \"smoke\"", "policy must expose smoke mode");
includes(policy, "minimumSubmissionLeadMinutes", "policy must expose submission lead minutes");
includes(policy, "minimumReviewGapMinutes", "policy must expose review gap minutes");
includes(policy, "requires an explicit server-resolved deadline policy", "development validators must fail loudly when policy is missing");
includes(policy, "validateCreateChallengeDeadlines", "policy must own deadline validation");

includes(readiness, "validateCreateChallengeDeadlines", "Create Challenge validation must use canonical deadline policy");
includes(readiness, "policy: options.deadlinePolicy", "Create Challenge validation must receive explicit server policy");
notIncludes(store, "now + 24 * 60 * 60", "Create Challenge store must not hardcode 24h submission window");
notIncludes(store, "submissionDeadline + 24 * 60 * 60", "Create Challenge store must not hardcode 24h review window");

includes(legacyFunding, "getCreateChallengeDeadlinePolicy", "legacy/internal funding preflight must use canonical deadline policy");
notIncludes(legacyFunding, "24 * 60 * 60", "legacy/internal funding preflight must not hardcode 24h policy");

includes(wizard, "Smoke schedule active · Submission lead:", "Create Challenge UI must identify smoke schedule from resolved policy");
includes(wizard, "deadlinePolicy?.mode === \"smoke\"", "Create Challenge UI notice must be derived from the validation policy");
includes(wizard, "Submission UTC", "Create Challenge UI must show submission deadline UTC for smoke challenges");
includes(wizard, "Review UTC", "Create Challenge UI must show review deadline UTC for smoke challenges");

includes(envExample, "CCN_SMOKE_TEST_MODE=false", ".env.example must document safe smoke flag default");
includes(envExample, "CCN_ENABLE_SHORT_SMOKE_WINDOWS=false", ".env.example must document explicit short-window flag default");
includes(envExample, "CCN_MIN_SUBMISSION_WINDOW_SECONDS=900", ".env.example must document historical smoke submission value");
includes(envExample, "CCN_MIN_REVIEW_WINDOW_SECONDS=900", ".env.example must document historical smoke review value");

includes(contract, "if (submissionDeadline <= block.timestamp) revert InvalidSubmissionDeadline();", "contract submission deadline rule must remain unchanged");
includes(contract, "if (reviewDeadline <= submissionDeadline) revert InvalidReviewDeadline();", "contract review deadline rule must remain unchanged");
includes(contract, "if (block.timestamp < escrow.reviewDeadline) revert ReviewPeriodNotEnded();", "contract payout deadline rule must remain unchanged");

const now = new Date();
const submission = new Date(now.getTime() + 15 * 60 * 1000);
const review = new Date(submission.getTime() + 15 * 60 * 1000);

console.log(JSON.stringify({
  result: "Sprint 08E.1 accelerated deadline policy static verification passed",
  productionDefaults: { submissionMinutes: 1440, reviewMinutes: 1440 },
  smokePolicy: { submissionMinutes: 15, reviewMinutes: 15, refusesProduction: true },
  proposedTimeline: {
    creationUtc: now.toISOString(),
    submissionDeadlineUtc: submission.toISOString(),
    reviewDeadlineUtc: review.toISOString(),
    earliestPayoutUtc: review.toISOString(),
  },
  noTransactionCreated: true,
}, null, 2));
