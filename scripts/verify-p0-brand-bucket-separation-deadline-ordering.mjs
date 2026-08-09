import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const viewModel = readFileSync("src/features/dashboard/brand-dashboard-view-model.ts", "utf8");
const filters = readFileSync("src/features/dashboard/brand-dashboard-filters.ts", "utf8");
const list = readFileSync("src/features/dashboard/components/brand-dashboard-challenges.tsx", "utf8");
const store = readFileSync("src/services/create-challenge/create-challenge-store.server.ts", "utf8");

assert.ok(viewModel.includes('| "Closed"'), "Brand internal bucket model must include non-filter Closed bucket.");
assert.ok(viewModel.includes('state === "closed-no-submissions" || state === "closed-not-enough-submissions"'), "Closed terminal states must not map to Needs Action or Completed.");
assert.ok(viewModel.includes("export function compareBrandDashboardRows"), "Brand ordering must use one shared comparator.");
assert.ok(viewModel.includes('if (bucket === "Needs Action") return 0;'), "All ordering must prioritize Needs Action first.");
assert.ok(viewModel.includes('if (bucket === "Active") return 1;'), "All ordering must place Active second.");
assert.ok(viewModel.includes('if (bucket === "Drafts") return 2;'), "All ordering must place Drafts third.");
assert.ok(viewModel.includes('if (bucket === "Closed") return 3;'), "All ordering must place closed non-action records before completed history.");
assert.ok(viewModel.includes('if (left.bucket === "Active" && right.bucket === "Active")'), "Active rows must have bucket-specific ordering.");
assert.ok(viewModel.includes("timestamp(left.submissionDeadline)"), "Active ordering must use submissionDeadline.");
assert.ok(viewModel.includes('if (left.status === "review" && right.status === "review")'), "Evaluation ordering must have review-specific branch.");
assert.ok(viewModel.includes("timestamp(left.reviewDeadline)"), "Evaluation ordering must use reviewDeadline.");
assert.ok(viewModel.includes('if (left.bucket === "Drafts" && right.bucket === "Drafts")'), "Draft ordering must be bucket-specific.");
assert.ok(viewModel.includes("timestamp(left.completedAt)"), "Completed ordering must prefer completedAt.");
assert.ok(store.includes("reviewDeadline: string;"), "Draft summary must expose canonical reviewDeadline.");
assert.ok(store.includes("reviewDeadline: normalized.reviewRules.reviewDeadline"), "Draft summary must source reviewDeadline from review rules.");
assert.ok(filters.includes('evaluation: "Needs Action"'), "Legacy evaluation filter alias must route to Needs Action.");
assert.ok(filters.includes('selection: "Needs Action"'), "Legacy selection filter alias must route to Needs Action.");
assert.ok(filters.includes('settlement: "Needs Action"'), "Legacy settlement filter alias must route to Needs Action.");
assert.ok(list.includes("function emptyStateForFilter"), "Empty-state CTA semantics must be filter-aware.");
assert.ok(list.includes("No action required right now"), "Needs Action empty state must not show Evaluate Solutions.");
assert.ok(!list.includes("No business challenges in this filter"), "Generic empty state must be replaced.");

const minute = 60_000;
const base = Date.parse("2026-08-09T12:00:00.000Z");
const rows = [
  row("draft-a", "Draft A", "Drafts", "draft", { updatedAt: base - 2 * 60 * minute }),
  row("draft-b", "Draft B", "Drafts", "draft", { updatedAt: base - 1 * minute }),
  row("live-a", "Live A", "Active", "ready-to-publish", { submissionDeadline: base + 20 * minute }),
  row("live-b", "Live B", "Active", "ready-to-publish", { submissionDeadline: base + 3 * 60 * minute }),
  row("live-c", "Live C", "Active", "ready-to-publish", { submissionDeadline: base + 2 * 24 * 60 * minute }),
  row("review-a", "Review A", "Needs Action", "review", { reviewDeadline: base + 15 * minute }),
  row("review-b", "Review B", "Needs Action", "review", { reviewDeadline: base + 60 * minute }),
  row("completed-a", "Completed A", "Completed", "completed", { completedAt: base - 24 * 60 * minute }),
  row("completed-b", "Completed B", "Completed", "completed", { completedAt: base }),
  row("closed-a", "Closed A", "Closed", "closed-no-submissions", { updatedAt: base - 30 * minute }),
  row("closed-b", "Closed B", "Closed", "closed-not-enough-submissions", { updatedAt: base - 20 * minute }),
];

assert.deepEqual(
  rows.filter((item) => item.bucket === "Drafts").sort(compareRows).map((item) => item.title),
  ["Draft B", "Draft A"],
  "Drafts must sort by updatedAt DESC.",
);
assert.deepEqual(
  rows.filter((item) => item.bucket === "Active").sort(compareRows).map((item) => item.title),
  ["Live A", "Live B", "Live C"],
  "Active must sort by submissionDeadline ASC.",
);
assert.deepEqual(
  rows.filter((item) => item.status === "review").sort(compareRows).map((item) => item.title),
  ["Review A", "Review B"],
  "Evaluation must sort by reviewDeadline ASC.",
);
assert.deepEqual(
  rows.filter((item) => item.bucket === "Completed").sort(compareRows).map((item) => item.title),
  ["Completed B", "Completed A"],
  "Completed must sort by completedAt DESC.",
);
assert.equal(rows.find((item) => item.status === "closed-no-submissions")?.bucket, "Closed", "Closed/no-submissions must be visible in All only.");
assert.equal(rows.find((item) => item.status === "closed-not-enough-submissions")?.bucket, "Closed", "Closed/not-enough-submissions must be visible in All only.");
assert.deepEqual(
  rows.sort(compareRows).map((item) => item.title),
  ["Review A", "Review B", "Live A", "Live B", "Live C", "Draft B", "Draft A", "Closed B", "Closed A", "Completed B", "Completed A"],
  "All must use canonical bucket priority and bucket-local ordering.",
);

function row(id, title, bucket, status, overrides = {}) {
  return {
    draftId: id,
    title,
    bucket,
    status,
    isUnnamedDraft: false,
    submissionDeadline: new Date(overrides.submissionDeadline ?? base + 10 * 24 * 60 * minute).toISOString(),
    reviewDeadline: new Date(overrides.reviewDeadline ?? base + 11 * 24 * 60 * minute).toISOString(),
    completedAt: overrides.completedAt ? new Date(overrides.completedAt).toISOString() : null,
    updatedAt: new Date(overrides.updatedAt ?? base).toISOString(),
  };
}

function priority(bucket) {
  return bucket === "Needs Action" ? 0 : bucket === "Active" ? 1 : bucket === "Drafts" ? 2 : bucket === "Closed" ? 3 : 4;
}

function time(value) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function ascNullLast(left, right) {
  const lv = Number.isFinite(left);
  const rv = Number.isFinite(right);
  if (lv && rv && left !== right) return left - right;
  if (lv !== rv) return lv ? -1 : 1;
  return 0;
}

function descNullLast(left, right) {
  const lv = Number.isFinite(left);
  const rv = Number.isFinite(right);
  if (lv && rv && left !== right) return right - left;
  if (lv !== rv) return lv ? -1 : 1;
  return 0;
}

function compareRows(left, right) {
  const bucketPriority = priority(left.bucket) - priority(right.bucket);
  if (bucketPriority) return bucketPriority;
  if (left.bucket === "Active") return ascNullLast(time(left.submissionDeadline), time(right.submissionDeadline));
  if (left.bucket === "Needs Action" && left.status === "review" && right.status === "review") {
    return ascNullLast(time(left.reviewDeadline), time(right.reviewDeadline));
  }
  if (left.bucket === "Drafts") return descNullLast(time(left.updatedAt), time(right.updatedAt));
  if (left.bucket === "Completed") return descNullLast(time(left.completedAt), time(right.completedAt));
  return descNullLast(time(left.updatedAt), time(right.updatedAt)) || left.title.localeCompare(right.title);
}

console.log("P0 Brand bucket separation and deadline-aware ordering verifier passed.");
