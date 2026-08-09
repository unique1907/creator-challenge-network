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
const viewModel = read("src/features/dashboard/brand-dashboard-view-model.ts");
const challengeList = read("src/features/dashboard/components/brand-dashboard-challenges.tsx");

assert.ok(
  dashboardPage.includes("listCreateChallengeDrafts({ ccnAccountId: context.ccnAccountId })"),
  "/dashboard must use the authenticated Brand-owned challenge repository query.",
);
assert.ok(
  campaignsPage.includes("listCreateChallengeDrafts({ ccnAccountId: context.ccnAccountId })"),
  "/dashboard/campaigns must use the same authenticated Brand-owned challenge repository query.",
);
assert.ok(
  campaignsPage.includes("campaignLimit: null"),
  "/dashboard/campaigns must remain complete/unlimited.",
);
assert.ok(
  viewModel.includes("const sourceRows = campaignRows"),
  "View model must build one canonical projected source collection.",
);
assert.ok(
  viewModel.includes("const dashboardSummaryRows = [...sourceRows].sort(compareBrandDashboardRows);"),
  "Dashboard summary rows must be selected from the canonical source collection.",
);
assert.ok(
  viewModel.includes("? dashboardSummaryRows.slice(0, identity.campaignLimit)") &&
    viewModel.includes(": dashboardSummaryRows.slice(0, 6)"),
  "Dashboard limit must be applied after canonical summary ordering.",
);
assert.ok(
  viewModel.includes("? sortedRows") && viewModel.includes("identity.campaignLimit === null"),
  "Unlimited /dashboard/campaigns rows must remain the full projected collection.",
);
assert.ok(
  viewModel.includes("timestamp(left.submissionDeadline)") && viewModel.includes("timestamp(left.reviewDeadline)"),
  "Dashboard summary ordering must use canonical deadline timestamps.",
);
assert.ok(
  viewModel.includes("function brandBucketPriority") &&
    viewModel.includes('if (bucket === "Needs Action") return 0;') &&
    viewModel.includes('if (bucket === "Active") return 1;'),
  "Dashboard summary ordering must prioritize operational buckets before applying the six-row limit.",
);
assert.ok(
  challengeList.includes('useState<BrandDashboardFilter>("All")'),
  "Dashboard simplified filters must remain locked to the shared filter inventory.",
);

const env = { ...readEnvFile(".env.local"), ...process.env };
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
assert.ok(supabaseUrl, "Supabase URL is required for real parity verification.");
assert.ok(serviceKey, "Supabase service key is required for read-only real parity verification.");

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const ccnAccountId = "cb82d778-c6eb-481f-8e38-e9f6ac558278";
const targetTitles = [
  "Demo Uber: Increase Airport Ride Bookings",
  "Demo Walmart: Improve In-Store Shopping Experience",
];

const [draftsResult, fundingResult] = await Promise.all([
  supabase.from("ccn_challenge_drafts").select("draft_id,challenge_id,title,publication_status,funding_status,escrow_status,event_verified,draft_state,updated_at"),
  supabase.from("ccn_challenge_funding_records").select("record_state"),
]);
assert.ifError(draftsResult.error);
assert.ifError(fundingResult.error);

const allowedDraftIds = new Set(
  (fundingResult.data ?? [])
    .map((row) => row.record_state)
    .filter((record) => record?.ccnAccountId === ccnAccountId)
    .map((record) => record.draftId),
);

const sourceRows = (draftsResult.data ?? [])
  .filter((row) => allowedDraftIds.has(row.draft_state?.challenge?.id || ""))
  .map((row) => ({
    draftId: row.draft_id,
    challengeId: row.challenge_id,
    title: row.title,
    publicationStatus: row.publication_status,
    fundingStatus: row.funding_status,
    escrowStatus: row.escrow_status,
    eventVerified: row.event_verified,
    publishedAt: row.draft_state?.deployment?.publishedAt ?? null,
    updatedAt: row.updated_at,
  }));

assert.ok(sourceRows.length > 6, "Real Brand source collection must be larger than the Dashboard summary limit.");
for (const title of targetTitles) {
  const row = sourceRows.find((candidate) => candidate.title === title);
  assert.ok(row, `${title} must be present in canonical Brand source collection.`);
  assert.equal(row.publicationStatus, "live", `${title} must be live.`);
  assert.equal(row.fundingStatus, "live", `${title} must be funded/live.`);
  assert.equal(row.escrowStatus, "verified", `${title} must be escrow verified.`);
  assert.equal(row.eventVerified, true, `${title} must be event verified.`);
}

function rowPublishedOrUpdatedTime(row) {
  const published = row.publishedAt ? new Date(row.publishedAt).getTime() : Number.NaN;
  if (!Number.isNaN(published)) return published;
  const updated = new Date(row.updatedAt).getTime();
  return Number.isNaN(updated) ? 0 : updated;
}

function dashboardSummarySortScore(row) {
  if (row.publicationStatus === "live" && (row.fundingStatus === "funded" || row.fundingStatus === "live")) return 10;
  if (row.publicationStatus === "published" || row.publicationStatus === "ready-to-publish") return 0;
  if (row.title && row.title !== "Untitled challenge" && row.title !== "Untitled draft") return 20;
  return 40;
}

const dashboardSelection = [...sourceRows]
  .sort((left, right) => {
    const scoreDiff = dashboardSummarySortScore(left) - dashboardSummarySortScore(right);
    if (scoreDiff) return scoreDiff;
    const diff = rowPublishedOrUpdatedTime(right) - rowPublishedOrUpdatedTime(left);
    return diff || left.title.localeCompare(right.title);
  })
  .slice(0, 6);

for (const title of targetTitles) {
  assert.ok(
    dashboardSelection.some((row) => row.title === title),
    `${title} must be included in Dashboard summary after canonical source selection and limit.`,
  );
}

const duplicateIds = dashboardSelection
  .map((row) => row.draftId)
  .filter((draftId, index, list) => list.indexOf(draftId) !== index);
assert.deepEqual(duplicateIds, [], "Dashboard summary must not contain duplicate draft IDs.");

console.log(JSON.stringify({
  result: "P0 Brand Dashboard/Campaigns data parity verifier passed",
  ccnAccountId,
  sourceRows: sourceRows.length,
  dashboardLimit: 6,
  dashboardSelection: dashboardSelection.map((row) => ({
    title: row.title,
    draftId: row.draftId,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
  })),
}, null, 2));
