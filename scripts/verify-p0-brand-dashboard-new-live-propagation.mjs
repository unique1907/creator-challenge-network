import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function read(path) {
  return readFileSync(path, "utf8");
}

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return readFileSync(path, "utf8").split(/\r?\n/).reduce((env, line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) return env;
    env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
    return env;
  }, {});
}

const dashboardPage = read("src/app/dashboard/page.tsx");
const campaignsPage = read("src/app/dashboard/campaigns/page.tsx");
const dashboardList = read("src/features/dashboard/components/brand-dashboard-challenges.tsx");
const viewModel = read("src/features/dashboard/brand-dashboard-view-model.ts");

assert.ok(
  dashboardPage.includes("listCreateChallengeDrafts({ ccnAccountId: context.ccnAccountId })"),
  "/dashboard must read the authenticated Brand-owned canonical draft collection.",
);
assert.ok(
  campaignsPage.includes("listCreateChallengeDrafts({ ccnAccountId: context.ccnAccountId })"),
  "/dashboard/campaigns must read the same authenticated Brand-owned canonical draft collection.",
);
assert.ok(
  campaignsPage.includes("campaignLimit: null"),
  "/dashboard/campaigns must remain complete and unlimited.",
);
assert.ok(
  viewModel.includes("const sourceRows = campaignRows"),
  "Dashboard view model must build one canonical source collection before page-specific limiting.",
);
assert.ok(
  viewModel.includes("export function compareBrandDashboardRows"),
  "Dashboard summary must use the shared Brand row comparator before applying the six-row limit.",
);
assert.ok(
  viewModel.includes('if (bucket === "Needs Action") return 0;') &&
    viewModel.includes('if (bucket === "Active") return 1;') &&
    viewModel.includes('if (bucket === "Drafts") return 2;') &&
    viewModel.includes('if (bucket === "Closed") return 3;'),
  "Summary priority must be Needs Action, Active, Drafts, Closed, then Completed.",
);
assert.ok(
  viewModel.includes("dashboardSummaryRows.slice(0, 6)"),
  "Dashboard summary must remain limited to six rows by default.",
);
assert.ok(
  dashboardList.includes("Business Challenges"),
  "Dashboard summary count label must use approved Business Challenge wording.",
);
assert.ok(
  !dashboardList.includes("active records from your CCN workspace"),
  "Dashboard summary must not call a mixed six-row summary active records.",
);

function bucketPriority(bucket) {
  if (bucket === "Needs Action") return 0;
  if (bucket === "Active") return 1;
  if (bucket === "Drafts") return 2;
  if (bucket === "Closed") return 3;
  return 4;
}

function timestamp(value) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function compareAscNullLast(left, right) {
  const leftValid = Number.isFinite(left);
  const rightValid = Number.isFinite(right);
  if (leftValid && rightValid && left !== right) return left - right;
  if (leftValid !== rightValid) return leftValid ? -1 : 1;
  return 0;
}

function compareDescNullLast(left, right) {
  const leftValid = Number.isFinite(left);
  const rightValid = Number.isFinite(right);
  if (leftValid && rightValid && left !== right) return right - left;
  if (leftValid !== rightValid) return leftValid ? -1 : 1;
  return 0;
}

function compareRowsByDashboardSummary(left, right) {
  const priority = bucketPriority(left.bucket) - bucketPriority(right.bucket);
  if (priority) return priority;
  if (left.bucket === "Active" && right.bucket === "Active") {
    const byDeadline = compareAscNullLast(timestamp(left.submissionDeadline), timestamp(right.submissionDeadline));
    if (byDeadline) return byDeadline;
  }
  if (left.bucket === "Drafts" && right.bucket === "Drafts") {
    const byUpdated = compareDescNullLast(timestamp(left.updatedAt), timestamp(right.updatedAt));
    if (byUpdated) return byUpdated;
  }
  if (left.bucket === "Completed" && right.bucket === "Completed") {
    const byCompleted = compareDescNullLast(timestamp(left.completedAt), timestamp(right.completedAt));
    if (byCompleted) return byCompleted;
  }
  const byUpdated = compareDescNullLast(timestamp(left.updatedAt), timestamp(right.updatedAt));
  if (byUpdated) return byUpdated;
  if (left.isUnnamedDraft !== right.isUnnamedDraft) return left.isUnnamedDraft ? 1 : -1;
  return left.title.localeCompare(right.title);
}

const fixtureRows = [
  {
    draftId: "needs-action-review",
    title: "Evaluation Challenge",
    bucket: "Needs Action",
    isUnnamedDraft: false,
    publishedAt: "2026-08-07T11:00:00.000Z",
    submissionDeadline: "2026-08-18T11:00:00.000Z",
    updatedAt: "2026-08-07T11:00:00.000Z",
  },
  {
    draftId: "new-live-circle",
    title: "Increase USDC Adoption Among Online Businesses",
    bucket: "Active",
    isUnnamedDraft: false,
    publishedAt: "2026-08-09T08:00:00.000Z",
    submissionDeadline: "2026-08-20T08:00:00.000Z",
    updatedAt: "2026-08-09T08:00:00.000Z",
  },
  {
    draftId: "meaningful-draft",
    title: "Improve Partner Activation",
    bucket: "Drafts",
    isUnnamedDraft: false,
    publishedAt: null,
    updatedAt: "2026-08-09T09:30:00.000Z",
  },
  {
    draftId: "completed",
    title: "Completed Challenge",
    bucket: "Completed",
    isUnnamedDraft: false,
    publishedAt: "2026-08-04T10:00:00.000Z",
    completedAt: "2026-08-08T10:00:00.000Z",
    updatedAt: "2026-08-08T10:00:00.000Z",
  },
  ...Array.from({ length: 6 }, (_, index) => ({
    draftId: `stale-untitled-${index + 1}`,
    title: "Untitled draft",
    bucket: "Drafts",
    isUnnamedDraft: true,
    publishedAt: null,
    updatedAt: `2026-08-09T09:${20 - index}:00.000Z`,
  })),
];

const dashboardSummary = [...fixtureRows].sort(compareRowsByDashboardSummary).slice(0, 6);
assert.equal(fixtureRows.length, 10, "Fixture must represent more than six Brand-owned records.");
assert.equal(dashboardSummary.length, 6, "Dashboard summary must remain limited to six rows.");
assert.equal(
  dashboardSummary[0]?.draftId,
  "needs-action-review",
  "Needs Action work must remain prioritized ahead of active/live work.",
);
assert.ok(
  dashboardSummary.some((row) => row.draftId === "new-live-circle"),
  "Newly published LIVE challenge must survive summary ordering and six-row limit.",
);
assert.ok(
  dashboardSummary.filter((row) => row.isUnnamedDraft).length < 6,
  "Stale unnamed drafts must not monopolize the limited Dashboard summary.",
);
assert.ok(
  fixtureRows.some((row) => row.draftId.startsWith("stale-untitled")),
  "Draft rows must remain preserved in the source collection.",
);

const env = { ...readEnvFile(".env.local"), ...process.env };
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
assert.ok(supabaseUrl, "Supabase URL is required for read-only Circle runtime propagation verification.");
assert.ok(serviceKey, "Supabase service key is required for read-only Circle runtime propagation verification.");

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const targetTitle = "Increase USDC Adoption Among Online Businesses";

const [draftsResult, fundingResult] = await Promise.all([
  supabase
    .from("ccn_challenge_drafts")
    .select("draft_id,challenge_id,title,publication_status,funding_status,escrow_status,event_verified,draft_state,updated_at"),
  supabase.from("ccn_challenge_funding_records").select("record_state"),
]);
assert.ifError(draftsResult.error);
assert.ifError(fundingResult.error);

const target = (draftsResult.data ?? []).find((row) => row.title === targetTitle);
assert.ok(target, "Circle challenge must exist in canonical persisted challenge drafts.");
const targetDraftId = target.draft_state?.challenge?.id || target.draft_id;
const targetFunding = (fundingResult.data ?? []).find((row) => row.record_state?.draftId === targetDraftId);
assert.ok(targetFunding?.record_state?.ccnAccountId, "Circle challenge must have an owning Brand funding record.");

const ownerAccountId = targetFunding.record_state.ccnAccountId;
const allowedDraftIds = new Set(
  (fundingResult.data ?? [])
    .map((row) => row.record_state)
    .filter((record) => record?.ccnAccountId === ownerAccountId)
    .map((record) => record.draftId),
);

const sourceRows = (draftsResult.data ?? [])
  .filter((row) => allowedDraftIds.has(row.draft_state?.challenge?.id || row.draft_id))
  .map((row) => ({
    draftId: row.draft_state?.challenge?.id || row.draft_id,
    challengeId: row.challenge_id,
    title: row.title,
    publicationStatus: row.publication_status,
    fundingStatus: row.funding_status,
    escrowStatus: row.escrow_status,
    eventVerified: row.event_verified,
    publishedAt: row.draft_state?.deployment?.publishedAt ?? null,
    submissionDeadline: row.draft_state?.reviewRules?.submissionDeadline ?? null,
    completedAt: row.draft_state?.deployment?.completedAt ?? null,
    updatedAt: row.updated_at,
    bucket:
      row.publication_status === "live" && (row.funding_status === "funded" || row.funding_status === "live")
        ? "Active"
        : row.publication_status === "published" || row.publication_status === "ready-to-publish"
          ? "Needs Action"
          : "Drafts",
    isUnnamedDraft: !row.title || row.title === "Untitled challenge" || row.title === "Untitled draft",
  }));

const circleSourceRow = sourceRows.find((row) => row.draftId === targetDraftId);
assert.ok(circleSourceRow, "Circle challenge must be present before Dashboard summary ordering and limit.");
assert.equal(circleSourceRow.publicationStatus, "live", "Circle challenge must be LIVE.");
assert.ok(
  circleSourceRow.fundingStatus === "funded" || circleSourceRow.fundingStatus === "live",
  "Circle challenge must retain funded/live funding state.",
);
assert.equal(circleSourceRow.bucket, "Active", "Circle challenge must map to the Brand Active bucket.");

const runtimeDashboardSummary = [...sourceRows].sort(compareRowsByDashboardSummary).slice(0, 6);
const runtimeTargetIndex = [...sourceRows].sort(compareRowsByDashboardSummary).findIndex((row) => row.draftId === targetDraftId);
const rowsAheadOfTarget = [...sourceRows].sort(compareRowsByDashboardSummary).slice(0, Math.max(runtimeTargetIndex, 0));
assert.ok(runtimeTargetIndex >= 0, "Circle challenge must remain eligible before Dashboard summary limiting.");
assert.ok(
  runtimeDashboardSummary.some((row) => row.draftId === targetDraftId) || rowsAheadOfTarget.every((row) => row.bucket !== "Drafts"),
  "Stale drafts must not push the Circle challenge out of the Brand Dashboard six-row summary.",
);

console.log(JSON.stringify({
  result: "P0 Brand Dashboard new LIVE propagation verifier passed",
  target: {
    title: targetTitle,
    draftId: targetDraftId,
    challengeId: target.challenge_id,
    ownerAccountId,
    lifecycle: "live",
    displayLifecycle: "Open for Solutions",
    simplifiedBucket: circleSourceRow.bucket,
    publishedAt: circleSourceRow.publishedAt,
    updatedAt: circleSourceRow.updatedAt,
    presentBeforeLimit: Boolean(circleSourceRow),
    presentAfterLimit: runtimeDashboardSummary.some((row) => row.draftId === targetDraftId),
    targetSortIndex: runtimeTargetIndex,
    staleDraftsAhead: rowsAheadOfTarget.filter((row) => row.bucket === "Drafts").length,
  },
  fullCollectionCount: sourceRows.length,
  dashboardLimit: 6,
  dashboardSelection: runtimeDashboardSummary.map((row) => ({
    title: row.title,
    draftId: row.draftId,
    bucket: row.bucket,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
  })),
}, null, 2));
