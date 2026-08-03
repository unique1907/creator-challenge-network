import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  PRODUCTION_DEADLINE_WINDOW_MINUTES,
  SHORT_SMOKE_DEADLINE_WINDOW_MINUTES,
  getCreateChallengeDeadlinePolicy,
  validateCreateChallengeDeadlines,
} = await import("../src/config/create-challenge-deadline-policy.ts");

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(file, needle, message) {
  assert.ok(read(file).includes(needle), message);
}

function notIncludes(file, needle, message) {
  assert.ok(!read(file).includes(needle), message);
}

function env(overrides = {}) {
  return {
    NODE_ENV: "development",
    VERCEL_ENV: "development",
    CCN_DEPLOYMENT_ENV: "development",
    ...overrides,
  };
}

function validate(input) {
  const policy = getCreateChallengeDeadlinePolicy({ env: input.env });
  return validateCreateChallengeDeadlines({
    ...input,
    policy,
  });
}

const now = 2_000_000_000;
const productionSubmission = now + PRODUCTION_DEADLINE_WINDOW_MINUTES * 60;
const smokeSubmission = now + SHORT_SMOKE_DEADLINE_WINDOW_MINUTES * 60;
const smokeReview = smokeSubmission + SHORT_SMOKE_DEADLINE_WINDOW_MINUTES * 60;
const smokeEnv = env({ CCN_ENABLE_SHORT_SMOKE_WINDOWS: "true" });

assert.equal(PRODUCTION_DEADLINE_WINDOW_MINUTES, 1_440, "production minimum must remain 1 day");
assert.equal(SHORT_SMOKE_DEADLINE_WINDOW_MINUTES, 15, "short smoke minimum must be 15 minutes");

assert.equal(
  getCreateChallengeDeadlinePolicy({
    env: smokeEnv,
  }).mode,
  "smoke",
  "short-window flag must enable development smoke mode",
);

assert.equal(
  getCreateChallengeDeadlinePolicy({
    env: env({ CCN_SMOKE_TEST_MODE: "true" }),
  }).mode,
  "smoke",
  "legacy smoke flag must remain supported",
);

assert.equal(
  getCreateChallengeDeadlinePolicy({
    env: env({ NODE_ENV: "production", CCN_ENABLE_SHORT_SMOKE_WINDOWS: "true" }),
  }).mode,
  "production",
  "production must not silently enable short smoke windows",
);

assert.ok(
  validate({
    env: env(),
    nowSeconds: now,
    submissionDeadline: now + 60 * 60,
    reviewDeadline: now + 2 * 60 * 60,
  }).errors.includes("Submission date and time must be at least 1 day from now."),
  "normal mode must reject submission deadlines under 1 day",
);

assert.ok(
  validate({
    env: env(),
    nowSeconds: now,
    submissionDeadline: productionSubmission,
    reviewDeadline: productionSubmission + 60 * 60,
  }).errors.includes("Review date and time must be at least 1 day after submissions close."),
  "normal mode must reject review deadlines under 1 day after submission close",
);

assert.deepEqual(
  validate({
    env: smokeEnv,
    nowSeconds: now,
    submissionDeadline: smokeSubmission,
    reviewDeadline: smokeReview,
  }).errors,
  [],
  "smoke mode must accept exactly 15-minute submission and review windows",
);

assert.ok(
  validate({
    env: smokeEnv,
    nowSeconds: now,
    submissionDeadline: smokeSubmission - 1,
    reviewDeadline: smokeReview,
  }).errors.includes("Submission date and time must be at least 15 minutes from now."),
  "smoke mode must reject submission deadlines under 15 minutes",
);

assert.ok(
  validate({
    env: smokeEnv,
    nowSeconds: now,
    submissionDeadline: smokeSubmission,
    reviewDeadline: smokeReview - 1,
  }).errors.includes("Review date and time must be at least 15 minutes after submissions close."),
  "smoke mode must reject review deadlines under 15 minutes",
);

assert.throws(
  () => validateCreateChallengeDeadlines({
    nowSeconds: now,
    submissionDeadline: smokeSubmission,
    reviewDeadline: smokeReview,
    env: env(),
  }),
  /requires an explicit server-resolved deadline policy/,
  "development validation must throw when policy is not explicitly propagated",
);

includes("src/utils/create-challenge-launch-readiness.ts", "validateCreateChallengeDeadlines", "client/server launch readiness must call the canonical deadline validator");
includes("src/services/create-challenge/create-challenge-funding.server.ts", "validateCreateChallengeLaunchReadiness(draft, { deadlinePolicy })", "publish preflight must use shared launch readiness validation with the resolved deadline policy");
includes("src/services/create-challenge/create-challenge-store.server.ts", "createNewSmokeTestCreateChallengeDraft", "server must keep isolated smoke draft creation");
includes("src/services/create-challenge/create-challenge-store.server.ts", "policy.minimumSubmissionLeadMinutes * 60 * 1000", "server-derived smoke submission deadline must use canonical policy minutes");
includes("src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx", "Smoke schedule active · Submission lead:", "UI must show short-window smoke notice");
includes("src/app/api/internal/deadline-policy/route.ts", "minimumReviewGapMinutes", "development diagnostic endpoint must expose safe policy values");
notIncludes("src/features/create-challenge/data/demo-draft.ts", "isSmokeTest", "normal demo draft must not become smoke-marked");

console.log(JSON.stringify({
  result: "P0 short smoke window recovery verification passed",
  productionMinimumMinutes: PRODUCTION_DEADLINE_WINDOW_MINUTES,
  shortSmokeMinimumMinutes: SHORT_SMOKE_DEADLINE_WINDOW_MINUTES,
  normalModeRejectsUnderOneDay: true,
  smokeModeAcceptsFifteenMinutes: true,
  missingPolicyFailsLoudly: true,
  clientServerPreflightConsistency: true,
  noTransactionsCreated: true,
}, null, 2));
