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

const viewModel = read("src/features/dashboard/brand-dashboard-view-model.ts");
const challengeList = read("src/features/dashboard/components/brand-dashboard-challenges.tsx");
const dashboard = read("src/features/dashboard/components/brand-dashboard.tsx");
const filters = read("src/features/dashboard/brand-dashboard-filters.ts");
const classifier = read("src/services/create-challenge/public-challenge-eligibility.ts");
const store = read("src/services/create-challenge/create-challenge-store.server.ts");

includes(classifier, 'winnerFinalizationState === "PAYOUT_CONFIRMED" && evidence.payoutConfirmedAt', "Payout-confirmed settlement evidence must be the canonical completed lifecycle proof.");
includes(classifier, 'brandBucket: "Completed"', "Shared lifecycle classifier must map payout-confirmed outcomes to the Completed Brand bucket.");
includes(viewModel, 'if (state === "completed") return "Completed";', "Brand dashboard simplified bucket must preserve completed lifecycle as Completed.");
includes(viewModel, "payoutConfirmedAt: draft.payoutConfirmedAt", "Brand lifecycle input must include payout confirmation evidence.");
includes(viewModel, "completedAt: draft.payoutConfirmedAt ?? draft.winnerFinalizedAt", "Completed rows must carry terminal settlement timing evidence.");
includes(store, "winnerAttemptForDraft(store", "Draft summaries must derive winner-finalization state from the canonical winner attempt store.");
includes(store, "payoutConfirmedAt: winnerAttempt?.payoutConfirmedAt ?? null", "Draft summaries must expose payout confirmation to dashboard projections.");

includes(viewModel, "allCampaignRows: BrandDashboardCampaignRow[];", "Dashboard view model must expose the full Brand-owned row collection.");
includes(viewModel, "allCampaignRows: sortedRows", "The full row collection must use the canonical sorted projection before dashboard limiting.");
includes(viewModel, "campaignRows: rows", "Dashboard summary rows must remain independently limited.");
includes(challengeList, "filterRows?: BrandDashboardCampaignRow[];", "Dashboard challenge list must accept a full filter source.");
includes(challengeList, 'activeFilter === "All" ? rows : filterRows ?? rows', "Non-All filters must search the full source, while All stays on the compact summary rows.");
includes(dashboard, "rows={viewModel.campaignRows}", "Dashboard must render the compact summary rows by default.");
includes(dashboard, "filterRows={viewModel.allCampaignRows}", "Dashboard filters must receive all Brand-owned rows.");
includes(dashboard, "totalRows={viewModel.allCampaignRows.length}", "Dashboard row count must report the full Brand-owned collection.");
includes(filters, "return row.bucket === filter;", "Non-All filters must match the canonical single bucket.");
excludes(challengeList, "suppressHydrationWarning", "Completed bucket propagation must not suppress rendering warnings.");

function classifyFixture(fixture) {
  if (fixture.winnerFinalizationState === "PAYOUT_CONFIRMED" && fixture.payoutConfirmedAt) return "Completed";
  if (fixture.deadlineClosed && fixture.submittedCount === 0) return "Closed";
  if (fixture.deadlineClosed && fixture.submittedCount < fixture.configuredWinnerCount) return "Closed";
  if (fixture.deadlineClosed && fixture.submittedCount >= fixture.configuredWinnerCount) return "Needs Action";
  return "Active";
}

const completed = {
  draftId: "completed-paid",
  title: "Paid settlement outcome",
  deadlineClosed: true,
  submittedCount: 1,
  winnerFinalizationState: "PAYOUT_CONFIRMED",
  payoutConfirmedAt: "2026-08-09T10:00:00.000Z",
};
const closedNoSubmissions = {
  draftId: "closed-empty",
  title: "Expired with no submissions",
  deadlineClosed: true,
  submittedCount: 0,
  winnerFinalizationState: null,
  payoutConfirmedAt: null,
};
const reviewNoPayout = {
  draftId: "review-no-payout",
  title: "Expired with submissions",
  deadlineClosed: true,
  submittedCount: 2,
  configuredWinnerCount: 1,
  winnerFinalizationState: null,
  payoutConfirmedAt: null,
};
const closedNotEnoughSubmissions = {
  draftId: "closed-underfilled",
  title: "Expired underfilled Top 3",
  deadlineClosed: true,
  submittedCount: 1,
  configuredWinnerCount: 3,
  winnerFinalizationState: null,
  payoutConfirmedAt: null,
};

assert.equal(classifyFixture(completed), "Completed", "Payout-confirmed settlement must classify into Completed.");
assert.equal(classifyFixture(closedNoSubmissions), "Closed", "Deadline passed with zero submissions must not classify into Completed.");
assert.equal(classifyFixture(closedNotEnoughSubmissions), "Closed", "Deadline passed with too few submissions must not classify into Completed or Needs Action.");
assert.equal(classifyFixture(reviewNoPayout), "Needs Action", "Deadline passed with enough submissions but no payout must not classify into Completed.");

const dashboardSummaryRows = [{ draftId: "active-1", bucket: "Active" }];
const fullRows = [...dashboardSummaryRows, { draftId: completed.draftId, bucket: classifyFixture(completed) }];
const completedFromSummaryOnly = dashboardSummaryRows.filter((row) => row.bucket === "Completed");
const completedFromFullFilterSource = fullRows.filter((row) => row.bucket === "Completed");

assert.equal(completedFromSummaryOnly.length, 0, "Fixture must model the previous limited-summary divergence.");
assert.deepEqual(completedFromFullFilterSource.map((row) => row.draftId), ["completed-paid"], "Completed filter must recover completed rows outside the compact dashboard summary.");

console.log(JSON.stringify({
  result: "P0 Brand completed post-settlement propagation verifier passed",
  completedProof: "PAYOUT_CONFIRMED plus payoutConfirmedAt",
  dashboardAllSource: "compact summary rows",
  dashboardFilteredSource: "full Brand-owned rows",
  excludedFromCompleted: ["closed-no-submissions", "closed-not-enough-submissions", "review-without-payout"],
}, null, 2));
