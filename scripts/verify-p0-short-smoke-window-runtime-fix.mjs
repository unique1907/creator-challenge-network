import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
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

const now = 2_100_000_000;
const smokePolicy = getCreateChallengeDeadlinePolicy({
  env: {
    NODE_ENV: "development",
    VERCEL_ENV: "development",
    CCN_DEPLOYMENT_ENV: "development",
    CCN_SMOKE_TEST_MODE: "true",
    CCN_ENABLE_SHORT_SMOKE_WINDOWS: "true",
    CCN_MIN_SUBMISSION_WINDOW_SECONDS: "900",
    CCN_MIN_REVIEW_WINDOW_SECONDS: "900",
  },
});

assert.equal(smokePolicy.mode, "smoke", "smoke policy must resolve on the server from development smoke env");
assert.equal(smokePolicy.minimumSubmissionLeadMinutes, SHORT_SMOKE_DEADLINE_WINDOW_MINUTES, "smoke submission minimum must remain 15 minutes");
assert.equal(smokePolicy.minimumReviewGapMinutes, SHORT_SMOKE_DEADLINE_WINDOW_MINUTES, "smoke review minimum must remain 15 minutes");

const twentyMinuteSubmission = now + 20 * 60;
const twentyMinuteReview = twentyMinuteSubmission + 20 * 60;
const runtimeValidation = validateCreateChallengeDeadlines({
  nowSeconds: now,
  submissionDeadline: twentyMinuteSubmission,
  reviewDeadline: twentyMinuteReview,
  policy: smokePolicy,
});

assert.deepEqual(runtimeValidation.errors, [], "server-resolved smoke policy must accept 20-minute submission/review windows");
assert.equal(runtimeValidation.policy.mode, "smoke", "explicit policy must be returned by runtime validation");

assert.throws(
  () => validateCreateChallengeDeadlines({
    nowSeconds: now,
    submissionDeadline: twentyMinuteSubmission,
    reviewDeadline: twentyMinuteReview,
    env: { NODE_ENV: "development" },
  }),
  /requires an explicit server-resolved deadline policy/,
  "development validation must fail loudly when policy propagation is missing",
);

includes(
  "src/app/create-challenge/page.tsx",
  "initialDeadlinePolicy={initialDeadlinePolicy}",
  "server-rendered wizard must receive a safe deadline policy prop",
);
includes(
  "src/app/api/create-challenge/draft/route.ts",
  "deadlinePolicy,",
  "draft API must return the resolved deadline policy",
);
includes(
  "src/app/api/create-challenge/draft/route.ts",
  "validateCreateChallengeDraft(draft, body.step, { deadlinePolicy })",
  "draft save validation must use the resolved deadline policy",
);
includes(
  "src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx",
  "initialDeadlinePolicy?: CreateChallengeDeadlinePolicy",
  "wizard must accept server-resolved policy",
);
includes(
  "src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx",
  "setDeadlinePolicy(payload.deadlinePolicy",
  "wizard must store deadline policy returned with draft payloads",
);
includes(
  "src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx",
  "Smoke schedule active · Submission lead:",
  "wizard must render the dev-only smoke schedule notice from resolved policy",
);
includes(
  "src/services/create-challenge/create-challenge-funding.server.ts",
  "deadlinePolicyForDraft",
  "financial preflight and publish guards must use the same deadline policy",
);
includes(
  "src/app/api/create-challenge/media/cover/route.ts",
  "deadlinePolicy,",
  "cover media responses must preserve deadline policy alongside launch readiness",
);
includes(
  "src/services/create-challenge/create-challenge-store.server.ts",
  "inputPrecisionBufferMs",
  "auto-created smoke drafts must avoid minute-input truncation at the minimum boundary",
);
includes(
  "src/app/api/internal/deadline-policy/route.ts",
  "minimumSubmissionLeadMinutes",
  "development-only diagnostic endpoint must expose only safe policy minute values",
);
notIncludes(
  "src/features/create-challenge/data/demo-draft.ts",
  "isSmokeTest",
  "normal demo draft must not be smoke-marked",
);

console.log(JSON.stringify({
  result: "P0 short smoke window runtime fix verification passed",
  acceptedSubmissionLeadMinutes: 20,
  acceptedReviewGapMinutes: 20,
  explicitPolicyMode: runtimeValidation.policy.mode,
  missingDevelopmentPolicyFailsLoudly: true,
  noCircleOrBlockchainAction: true,
}, null, 2));
