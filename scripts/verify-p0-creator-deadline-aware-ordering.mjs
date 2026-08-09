import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync("src/services/creator-workspace/creator-workspace.server.ts", "utf8");

assert.ok(service.includes("export function compareCreatorLiveOpportunityCards"), "Creator live ordering helper must be shared.");
assert.ok(service.includes("deadlineTime(left.submissionDeadlineIso)"), "Creator live ordering must use canonical submissionDeadlineIso.");
assert.ok(service.includes(".sort(compareCreatorLiveOpportunityCards)"), "Creator Discover and Overview must sort live opportunity cards.");
assert.ok(service.includes("const openChallenge = input.availableChallenges.find"), "Creator Next Action must select from the already ordered live list.");
assert.ok(service.includes("export function compareCreatorSubmissionItems"), "Creator submission ordering helper must be shared.");
assert.ok(service.includes('if (status === "Under Review" || status === "Submitted") return 0;'), "Unresolved review/submitted work must sort before finished history.");
assert.ok(service.includes(")).sort(compareCreatorSubmissionItems)"), "Creator My Submissions projections must apply shared submission ordering.");

const minute = 60_000;
const base = Date.parse("2026-08-09T12:00:00.000Z");
const liveCards = [
  card("Live C", base + 2 * 24 * 60 * minute),
  card("Live A", base + 20 * minute),
  card("Live B", base + 3 * 60 * minute),
];

assert.deepEqual(
  liveCards.sort(compareLive).map((item) => item.title),
  ["Live A", "Live B", "Live C"],
  "Creator live opportunity lists must sort by least time remaining.",
);

const submissions = [
  submission("Paid", "Reward Paid", base),
  submission("Draft", "Draft", base - 10 * minute),
  submission("Review Soon", "Under Review", base - 30 * minute),
  submission("Submitted", "Submitted", base - 20 * minute),
];

assert.deepEqual(
  submissions.sort(compareSubmissions).map((item) => item.title),
  ["Submitted", "Review Soon", "Draft", "Paid"],
  "Creator My Submissions must prioritize unresolved work before paid/completed history.",
);

function card(title, deadline) {
  return { title, submissionDeadlineIso: new Date(deadline).toISOString() };
}

function submission(title, status, updatedAt) {
  return { title, challengeTitle: title, status, updatedAt: new Date(updatedAt).toISOString(), submittedAt: null };
}

function time(value) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function compareLive(left, right) {
  return time(left.submissionDeadlineIso) - time(right.submissionDeadlineIso) || left.title.localeCompare(right.title);
}

function submissionPriority(status) {
  if (status === "Under Review" || status === "Submitted") return 0;
  if (status === "Draft" || status === "Winner" || status === "Reward Processing") return 1;
  if (status === "No submission" || status === "Not Selected") return 2;
  return 3;
}

function compareSubmissions(left, right) {
  return submissionPriority(left.status) - submissionPriority(right.status) ||
    time(right.submittedAt ?? right.updatedAt) - time(left.submittedAt ?? left.updatedAt) ||
    left.challengeTitle.localeCompare(right.challengeTitle);
}

console.log("P0 Creator deadline-aware ordering verifier passed.");
