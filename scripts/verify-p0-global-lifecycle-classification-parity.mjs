import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

function excludes(source, needle, message) {
  assert.equal(source.includes(needle), false, message);
}

function classifyFixture({
  publicationStatus = "live",
  fundingStatus = "funded",
  escrowStatus = "verified",
  eventVerified = true,
  transactionHash = "0xfunded",
  slug = "demo-business-challenge",
  deadlineClosed = false,
  submittedCount = 0,
  configuredWinnerCount = 1,
  winnerState = null,
  winnerFinalizedAt = null,
  payoutApprovalCreatedAt = null,
  payoutTransactionHash = null,
  payoutConfirmedAt = null,
} = {}) {
  if (winnerState === "PAYOUT_CONFIRMED" && payoutConfirmedAt) return "completed";
  if (
    ["TRANSACTION_SUBMITTED", "RECONCILIATION_REQUIRED", "ACTION_REQUIRED", "APPROVAL_CREATED_RECONCILIATION_REQUIRED"].includes(winnerState) ||
    payoutApprovalCreatedAt ||
    payoutTransactionHash
  ) return "settlement";
  if (winnerFinalizedAt || winnerState === "READY_FOR_FINAL_SELECTION") return "selection";

  const published = publicationStatus === "live";
  const funded = fundingStatus === "funded" || fundingStatus === "live";
  const verified = funded && escrowStatus === "verified" && eventVerified === true && Boolean(transactionHash);
  const publicSlug = Boolean(slug && slug !== "new-challenge");

  if (published && verified && publicSlug && !deadlineClosed) return "live";
  if (published && verified && deadlineClosed) {
    if (submittedCount === 0) return "closed-no-submissions";
    if (submittedCount < configuredWinnerCount) return "closed-not-enough-submissions";
    return "review";
  }
  if (published || funded || escrowStatus === "verified") return "not-live";
  return "draft";
}

const publicEligibility = read("src/services/create-challenge/public-challenge-eligibility.ts");
const publicProjection = read("src/services/create-challenge/published-challenge.server.ts");
const publicChallengeCard = read("src/features/challenges/components/challenge-card.tsx");
const publicChallengeDetail = read("src/features/challenges/components/challenge-detail.tsx");
const challengeUtils = read("src/features/challenges/lib/challenge-utils.ts");
const creatorWorkspace = read("src/services/creator-workspace/creator-workspace.server.ts");
const brandViewModel = read("src/features/dashboard/brand-dashboard-view-model.ts");
const types = read("src/types/ccn.ts");

includes(publicEligibility, "export function classifyChallengeLifecycle", "Shared lifecycle classifier must be exported.");
includes(publicEligibility, "submittedCount === 0", "Classifier must distinguish zero-submission closures.");
includes(publicEligibility, "lifecycle: \"closed-no-submissions\"", "Classifier must expose closed/no-submissions state.");
includes(publicEligibility, "lifecycle: \"closed-not-enough-submissions\"", "Classifier must expose closed/not-enough-submissions state.");
includes(publicEligibility, "submittedCount < configuredWinnerCount", "Classifier must gate review by configured winner count.");
includes(publicEligibility, "publicStatus: \"closed\"", "Public projection must have a closed presentation status.");
includes(publicEligibility, "lifecycle: \"closed-no-submissions\"", "Closed/no-submissions must remain a distinct lifecycle, not Active or Completed.");
includes(publicEligibility, "isLiveOpportunity: true", "Classifier must explicitly identify true live opportunities.");
includes(publicEligibility, "acceptsSubmissions: true", "Classifier must explicitly identify accepting-submission state.");
includes(publicEligibility, "settlementStates", "Classifier must preserve existing settlement evidence states.");

includes(publicProjection, "classifyCreateChallengeDraftLifecycle", "Public projection must use the shared lifecycle classifier.");
includes(publicProjection, "countSubmittedEntriesForChallenge(challengeId)", "Public projection must classify with real global submitted count.");
includes(publicProjection, "challenge.status === \"open\"", "Homepage live projection must render only true open/live records.");
includes(publicProjection, "!challenge.submissionClosed", "Homepage live projection must exclude closed records.");
includes(publicProjection, "listLiveHomepageChallenges()", "Featured homepage challenge must reuse true live projection.");
excludes(publicProjection, "publicLifecycleForDraft", "Public projection must not keep the old local deadline-only classifier.");

includes(types, "\"closed\"", "ChallengeStatus must include the closed/no-submissions display status.");
includes(challengeUtils, "case \"closed\"", "Public status badge styling must handle closed/no-submissions.");
includes(publicChallengeCard, "challenge.publicStatusLabel ?? challenge.status", "Historical public listing must show truthful lifecycle labels.");
includes(publicChallengeCard, "challenge.publicCtaLabel ?? \"View challenge\"", "Historical public listing CTA must use lifecycle-aware copy.");
includes(publicChallengeDetail, "This challenge closed without receiving Solution Proposals.", "Public detail must explain closed/no-submission state.");
includes(publicChallengeDetail, "This challenge closed without enough eligible Solution Proposals", "Public detail must explain closed/not-enough-submissions state.");
includes(publicChallengeDetail, "The Brand is reviewing submitted solutions.", "Public detail must explain review/evaluation state.");
includes(publicChallengeDetail, "challenge.status === \"open\" && !challenge.submissionClosed", "Public detail participation CTA must be gated to true live state.");

includes(creatorWorkspace, "explainPublicLiveEligibility(draft)", "Creator diagnostics must share public live eligibility.");
includes(creatorWorkspace, "isPublicLiveEligibleDraft(draft)", "Creator Discover/Overview must use true live eligibility.");
includes(creatorWorkspace, "if (!discoverable && !submission) return null;", "Creator direct challenge detail must not expose non-live opportunities without an existing submission.");

includes(brandViewModel, "classifyChallengeLifecycle", "Brand rows must use the shared lifecycle classifier.");
includes(brandViewModel, "classification.lifecycle === \"closed-no-submissions\"", "Brand rows must preserve closed/no-submission state.");
includes(brandViewModel, "classification.lifecycle === \"closed-not-enough-submissions\"", "Brand rows must preserve closed/not-enough-submissions state.");
includes(brandViewModel, "Closed - No Submissions", "Brand presentation must label closed/no-submission rows truthfully.");
includes(brandViewModel, "Closed — Not Enough Submissions", "Brand presentation must label insufficient-submission rows truthfully.");
includes(brandViewModel, "row.status === \"closed-no-submissions\"", "Brand sorting/notification logic must handle closed/no-submission rows.");

const matrix = [
  ["future deadline + 0 submissions", { deadlineClosed: false, submittedCount: 0 }, "live"],
  ["future deadline + submissions", { deadlineClosed: false, submittedCount: 3 }, "live"],
  ["deadline passed + 0 submissions", { deadlineClosed: true, submittedCount: 0 }, "closed-no-submissions"],
  ["deadline passed + underfilled submissions, no winner", { deadlineClosed: true, submittedCount: 2, configuredWinnerCount: 3 }, "closed-not-enough-submissions"],
  ["deadline passed + enough submissions, no winner", { deadlineClosed: true, submittedCount: 3, configuredWinnerCount: 3 }, "review"],
  ["winner selected", { deadlineClosed: true, submittedCount: 2, configuredWinnerCount: 3, winnerState: "READY_FOR_FINAL_SELECTION" }, "selection"],
  ["settlement in progress", { deadlineClosed: true, submittedCount: 2, configuredWinnerCount: 3, winnerState: "ACTION_REQUIRED" }, "settlement"],
  ["payout confirmed", { deadlineClosed: true, submittedCount: 2, configuredWinnerCount: 3, winnerState: "PAYOUT_CONFIRMED", payoutConfirmedAt: "2026-08-09T00:00:00.000Z" }, "completed"],
  ["draft unpublished", { publicationStatus: "draft", fundingStatus: "not-started", escrowStatus: "not-started", eventVerified: false, transactionHash: "", slug: "new-challenge" }, "draft"],
];

for (const [label, input, expected] of matrix) {
  assert.equal(classifyFixture(input), expected, `Lifecycle matrix failed: ${label}`);
}

console.log(JSON.stringify({
  result: "P0 global lifecycle classification parity verifier passed",
  matrix: Object.fromEntries(matrix.map(([label, , expected]) => [label, expected])),
  surfaces: ["public homepage", "public challenge listing", "public detail", "creator discover", "creator detail", "brand dashboard/list"],
}, null, 2));
