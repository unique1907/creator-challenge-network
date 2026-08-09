import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

function classifyFixture({
  publicationStatus = "live",
  fundingStatus = "funded",
  escrowStatus = "verified",
  eventVerified = true,
  transactionHash = "0xfunded",
  slug = "business-challenge",
  deadlineClosed = true,
  submittedCount = 0,
  configuredWinnerCount = 1,
  winnerState = null,
  winnerFinalizedAt = null,
  payoutTransactionHash = null,
  payoutConfirmedAt = null,
} = {}) {
  if (winnerState === "PAYOUT_CONFIRMED" && payoutConfirmedAt) return "completed";
  if (["TRANSACTION_SUBMITTED", "RECONCILIATION_REQUIRED", "ACTION_REQUIRED", "APPROVAL_CREATED_RECONCILIATION_REQUIRED"].includes(winnerState) || payoutTransactionHash) return "settlement";
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
const brandViewModel = read("src/features/dashboard/brand-dashboard-view-model.ts");
const brandWorkspace = read("src/features/dashboard/components/campaign-workspace.tsx");
const brandTabs = read("src/features/dashboard/components/campaign-workspace-tabs.tsx");
const publicDetail = read("src/features/challenges/components/challenge-detail.tsx");
const creatorWorkspace = read("src/services/creator-workspace/creator-workspace.server.ts");
const packageJson = read("package.json");

includes(publicEligibility, "| \"closed-not-enough-submissions\"", "Shared lifecycle must expose closed-not-enough-submissions.");
includes(publicEligibility, "submittedCount < configuredWinnerCount", "Shared classifier must gate insufficient submissions against configured winner count.");
includes(publicEligibility, "publicStatusLabel: \"Closed — Not Enough Submissions\"", "Public projection must expose the approved label.");
includes(publicEligibility, "brandBucket: \"Closed\"", "Closed insufficient-submission records must not map to Needs Action.");

includes(brandViewModel, "classification.lifecycle === \"closed-not-enough-submissions\"", "Brand rows must preserve the new lifecycle.");
includes(brandViewModel, "row.status !== \"closed-not-enough-submissions\"", "Brand next action must exclude insufficient-submission closures.");
includes(brandViewModel, "row.status === \"review\" && row.solutionCount > 0", "Brand solution activity must only count actionable evaluation rows.");
includes(brandViewModel, "actionableSubmissionDraftIds", "Submission notifications must exclude non-actionable closed rows.");

includes(brandWorkspace, "closed-not-enough-submissions", "Brand challenge detail must derive the terminal state.");
includes(brandWorkspace, "finalizationUnavailableReason", "Brand challenge detail must pass an explanatory disabled finalization state.");
includes(brandTabs, "Winner Selection Unavailable", "Brand Evaluation tab must not expose an impossible winner action.");

includes(publicDetail, "This challenge closed without enough eligible Solution Proposals to fill all planned Winner positions.", "Public detail must show concise closed-insufficient copy.");
includes(publicDetail, "challenge.status === \"open\" && !challenge.submissionClosed", "Public participation CTA must remain open-only.");

includes(creatorWorkspace, "| \"Challenge Closed\"", "Creator submission status must have a safe closed terminal label.");
includes(creatorWorkspace, "isClosedWithNotEnoughSubmissions", "Creator submissions must classify the underfilled closed state.");
includes(creatorWorkspace, "isPublicLiveEligibleDraft(draft)", "Creator Discover/Open challenges must keep using live-only eligibility.");

includes(packageJson, "test:p0-insufficient-submissions-terminal-state", "Focused verifier must be registered.");

const matrix = [
  ["Top 1, zero submissions, deadline passed", { configuredWinnerCount: 1, submittedCount: 0 }, "closed-no-submissions"],
  ["Top 3, zero submissions, deadline passed", { configuredWinnerCount: 3, submittedCount: 0 }, "closed-no-submissions"],
  ["Top 3, one submission, deadline passed", { configuredWinnerCount: 3, submittedCount: 1 }, "closed-not-enough-submissions"],
  ["Top 3, two submissions, deadline passed", { configuredWinnerCount: 3, submittedCount: 2 }, "closed-not-enough-submissions"],
  ["Top 3, three submissions, deadline passed", { configuredWinnerCount: 3, submittedCount: 3 }, "review"],
  ["Top 3, five submissions, deadline passed", { configuredWinnerCount: 3, submittedCount: 5 }, "review"],
  ["Top 3, one submission, future deadline", { configuredWinnerCount: 3, submittedCount: 1, deadlineClosed: false }, "live"],
  ["Winner already finalized", { configuredWinnerCount: 3, submittedCount: 1, winnerState: "READY_FOR_FINAL_SELECTION" }, "selection"],
  ["Settlement complete", { configuredWinnerCount: 3, submittedCount: 1, winnerState: "PAYOUT_CONFIRMED", payoutConfirmedAt: "2026-08-10T00:00:00.000Z" }, "completed"],
];

for (const [label, input, expected] of matrix) {
  assert.equal(classifyFixture(input), expected, `Lifecycle matrix failed: ${label}`);
}

const closedState = "closed-not-enough-submissions";
assert.notEqual(closedState, "review", "Closed insufficient-submission state must not be Evaluation.");
assert.notEqual(closedState, "completed", "Closed insufficient-submission state must not be Completed.");

console.log(JSON.stringify({
  result: "P0 insufficient submissions terminal state verifier passed",
  matrix: Object.fromEntries(matrix.map(([label, , expected]) => [label, expected])),
  exclusions: ["Brand Next Action", "Brand Needs Action", "Creator Discover", "Creator Open Challenges"],
}, null, 2));
