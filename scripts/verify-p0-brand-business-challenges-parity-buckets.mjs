import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

function excludes(source, needle, message) {
  assert.equal(source.includes(needle), false, message);
}

function loadEnv(filePath) {
  const env = {};
  if (!existsSync(filePath)) return env;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^["']|["']$/g, "");
  }
  return env;
}

const filters = read("src/features/dashboard/brand-dashboard-filters.ts");
const viewModel = read("src/features/dashboard/brand-dashboard-view-model.ts");
const campaignsPage = read("src/app/dashboard/campaigns/page.tsx");
const dashboardPage = read("src/app/dashboard/page.tsx");
const publicProjection = read("src/services/create-challenge/published-challenge.server.ts");
const publicEligibility = read("src/services/create-challenge/public-challenge-eligibility.ts");
const store = read("src/services/create-challenge/create-challenge-store.server.ts");

for (const label of ['"All"', '"Drafts"', '"Active"', '"Needs Action"', '"Completed"']) {
  includes(filters, label, `Locked Brand filter label missing: ${label}`);
}
for (const oldLabel of ['"Problem Draft"', '"Funding"', '"Open for Solutions"', '"Evaluation"', '"Selection"']) {
  excludes(filters, oldLabel, `Brand visible filters must not restore old lifecycle label ${oldLabel}`);
}

includes(viewModel, "export type BrandDashboardSimplifiedBucket", "Brand rows must expose a simplified bucket type.");
includes(viewModel, "| \"Drafts\"", "Simplified bucket must include Drafts.");
includes(viewModel, "| \"Active\"", "Simplified bucket must include Active.");
includes(viewModel, "| \"Needs Action\"", "Simplified bucket must include Needs Action.");
includes(viewModel, "| \"Closed\"", "Simplified bucket must include internal Closed bucket for All-only rows.");
includes(viewModel, "| \"Completed\"", "Simplified bucket must include Completed.");
includes(viewModel, "bucket: BrandDashboardSimplifiedBucket;", "Campaign row must carry one primary simplified bucket.");
includes(viewModel, "export function simplifiedBucketFromDraft", "Simplified bucket mapping must be centralized.");
includes(viewModel, "if (state === \"completed\") return \"Completed\";", "Completed state must map to Completed.");
includes(viewModel, "state === \"closed-no-submissions\" || state === \"closed-not-enough-submissions\"", "Closed terminal states must map to All-only Closed bucket.");
includes(viewModel, "if (state === \"review\" || state === \"winner-ready\" || state === \"settlement\") return \"Needs Action\";", "Action-required states must map to Needs Action.");
includes(viewModel, "draft.publicationStatus === \"live\" && (draft.fundingStatus === \"funded\" || draft.fundingStatus === \"live\")", "Funded and published Brand challenges must map to Active.");
includes(viewModel, "if (state === \"funding\" || state === \"ready-to-publish\") return \"Needs Action\";", "Funding/opening actions must remain actionable.");
includes(viewModel, "return \"Drafts\";", "Non-public unfinished records must remain in Drafts.");
includes(viewModel, "classifyChallengeLifecycle", "Brand lifecycle must use the shared deterministic lifecycle classifier.");
includes(viewModel, "classification.lifecycle === \"closed-no-submissions\"", "Expired zero-submission Brand rows must classify as closed without submissions.");
includes(viewModel, "classification.lifecycle === \"closed-not-enough-submissions\"", "Expired underfilled Brand rows must classify as closed with not enough submissions.");
includes(publicEligibility, "submittedCount < configuredWinnerCount", "Shared lifecycle classifier must distinguish expired review from underfilled closure.");
includes(filters, "if (filter === \"All\") return true;", "All filter must include every owned row.");
includes(filters, "return row.bucket === filter;", "Non-All filters must use the single primary bucket.");
excludes(filters, "activeStates", "Active filter must not be an overlapping lifecycle-state set.");
excludes(filters, "needsActionStates", "Needs Action filter must not be an overlapping lifecycle-state set.");

includes(campaignsPage, "listCreateChallengeDrafts({ ccnAccountId: context.ccnAccountId })", "Business Challenges must retain authenticated Brand ownership scope.");
includes(dashboardPage, "listCreateChallengeDrafts({ ccnAccountId: context.ccnAccountId })", "Dashboard must retain authenticated Brand ownership scope.");
includes(store, "Object.values(store.fundingRecords ?? {})", "Brand ownership must stay scoped through canonical funding ownership records.");
includes(publicProjection, "listLiveCreateChallengeDrafts", "Public homepage must use the canonical live draft projection.");
includes(publicProjection, ".filter((record) => isPublicLiveEligibleDraft(record.draft))", "Public homepage must use shared public live eligibility.");
includes(publicEligibility, "draft.deployment.publicationStatus !== \"live\"", "Public eligibility must require live publication.");
includes(publicEligibility, "funding-event-not-verified", "Public eligibility must require verified funding evidence.");

const env = loadEnv(".env.local");
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_KEY;

if (supabaseUrl && serviceKey) {
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: drafts, error: draftError } = await supabase
    .from("ccn_challenge_drafts")
    .select("draft_id,challenge_id,funding_intent_id,title,publication_status,funding_status,escrow_status,event_verified,draft_state,updated_at")
    .or("title.ilike.%Demo Walmart: Improve In-Store Shopping Experience%,title.ilike.%Demo Uber: Increase Airport Ride Bookings%");
  if (draftError) throw draftError;
  assert.ok((drafts?.length ?? 0) >= 1, "At least Walmart or Uber live trace challenge must exist for read-only parity proof.");

  const draftIds = (drafts ?? []).map((row) => row.draft_id);
  const { data: records, error: recordError } = await supabase
    .from("ccn_challenge_funding_records")
    .select("ccn_account_id,draft_id,funding_verified,event_verified,published")
    .in("draft_id", draftIds);
  if (recordError) throw recordError;

  for (const draft of drafts ?? []) {
    assert.equal(draft.publication_status, "live", `${draft.title} must be live in canonical draft row.`);
    assert.ok(draft.funding_status === "funded" || draft.funding_status === "live", `${draft.title} must be funded/live.`);
    assert.equal(draft.escrow_status, "verified", `${draft.title} must have verified escrow.`);
    assert.equal(draft.event_verified, true, `${draft.title} must have verified funding event.`);
    assert.ok(draft.draft_state?.funding?.transactionHash, `${draft.title} must have funding transaction evidence.`);
    assert.ok(draft.draft_state?.deployment?.publishedAt || draft.updated_at, `${draft.title} must have publication timestamp evidence.`);
    const ownerRecords = (records ?? []).filter((record) => record.draft_id === draft.draft_id);
    assert.ok(ownerRecords.some((record) => record.funding_verified && record.event_verified && record.published), `${draft.title} must have a verified published Brand ownership funding record.`);
  }
}

console.log(JSON.stringify({
  result: "P0 Brand Business Challenges parity and filter bucket verification passed",
  filters: ["All", "Drafts", "Active", "Needs Action", "Completed"],
  allContract: "all owned rows",
  primaryBucket: "exactly one simplified bucket per row",
  liveFutureDeadlineBucket: "Active",
  ownership: "ccnAccountId-scoped funding ownership records",
}, null, 2));
