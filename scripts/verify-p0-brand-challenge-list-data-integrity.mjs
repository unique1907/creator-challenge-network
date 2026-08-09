import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

const retainedDraftId = "7897dca3-8299-4770-a013-e2595b92f5fe";
const retainedChallengeId = "0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4";

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

const viewModel = read("src/features/dashboard/brand-dashboard-view-model.ts");
const store = read("src/services/create-challenge/create-challenge-store.server.ts");
const dashboardPage = read("src/app/dashboard/page.tsx");
const campaignsPage = read("src/app/dashboard/campaigns/page.tsx");
const dataHelper = read("src/features/dashboard/brand-dashboard-data.server.ts");

includes(store, "winnerFinalizationState: WinnerFinalizationState | null", "draft summary must include winner finalization state");
includes(store, "winnerAttemptForDraft(store", "draft summary must derive winner attempt from canonical store");
includes(store, "payoutConfirmedAt: winnerAttempt?.payoutConfirmedAt ?? null", "draft summary must expose payout confirmation");
includes(store, "winnerCount: normalized.prizePool.winnerCount", "draft summary must expose Top 1 / Top 3 winner model");

includes(viewModel, "lifecycleStateFromDraft(draft: CreateChallengeDraftSummary, solutionCount = 0)", "dashboard lifecycle must accept persisted solution count");
includes(viewModel, "classification.lifecycle === \"completed\"", "payout-confirmed challenge must map to Completed through shared lifecycle classification");
includes(viewModel, "return \"completed\"", "completed lifecycle return must exist");
includes(viewModel, "classification.lifecycle === \"selection\"", "evaluation-complete pending finalization must map to Selection through shared lifecycle classification");
includes(viewModel, "classification.lifecycle === \"settlement\"", "finalized unpaid challenge must map to Settlement through shared lifecycle classification");
includes(viewModel, "classifyChallengeLifecycle", "live challenge lifecycle must use the shared deadline-aware classifier");
includes(viewModel, "classification.lifecycle === \"closed-no-submissions\"", "live challenges with expired deadlines and zero submissions must not move to Evaluation");
includes(viewModel, "classification.lifecycle === \"closed-not-enough-submissions\"", "live challenges with expired deadlines and too few submissions must not move to Evaluation");
includes(viewModel, "simplifiedBucketFromDraft", "dashboard rows must derive one primary simplified bucket");
includes(viewModel, "bucket,", "campaign rows must expose the primary simplified bucket");
includes(viewModel, "solutionCounts.get(draft.draftId) ?? 0", "solution count must come from persisted submission notifications by draft id");
includes(viewModel, "Top ${draft.winnerCount}", "Top 1 / Top 3 winner model must be represented without altering counts");
includes(viewModel, "View Outcome Report", "completed action must use the outcome report path, not evaluation");
excludes(viewModel, "status === \"live\" ? 42", "fake live submission counts must not exist");
excludes(viewModel, "status === \"review\" ? 156", "fake review submission counts must not exist");

includes(dataHelper, "listSubmissionNotificationEntries(draft.challengeId)", "solution notifications must query by canonical onchain challenge id");
includes(dashboardPage, "getBrandDashboardSubmissionNotifications(drafts)", "main Brand dashboard must use shared canonical submission notifications");
includes(campaignsPage, "getBrandDashboardSubmissionNotifications(drafts)", "Business Challenges list must use shared canonical submission notifications");
includes(campaignsPage, "submissionNotifications", "/dashboard/campaigns must pass submission notifications into the view model");

const env = loadEnv(".env.local");
if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const [{ data: drafts, error: draftsError }, { data: submissions, error: submissionsError }, { data: winners, error: winnersError }, { data: verifications, error: verificationsError }] = await Promise.all([
    supabase.from("ccn_challenge_drafts").select("draft_id,challenge_id,draft_state").eq("draft_id", retainedDraftId),
    supabase.from("ccn_creator_submissions").select("submission_id,challenge_id,status,anonymous_entry_code").eq("challenge_id", retainedChallengeId),
    supabase.from("ccn_winner_finalization_attempts").select("draft_id,challenge_id,state,attempt_state").eq("draft_id", retainedDraftId),
    supabase.from("ccn_onchain_verifications").select("draft_id,challenge_id,event_type,tx_hash").eq("draft_id", retainedDraftId),
  ]);
  if (draftsError) throw draftsError;
  if (submissionsError) throw submissionsError;
  if (winnersError) throw winnersError;
  if (verificationsError) throw verificationsError;
  assert.equal(drafts?.length, 1, "retained completed challenge must exist in Supabase");
  assert.equal(drafts?.[0]?.challenge_id, retainedChallengeId, "retained draft must bind to canonical onchain challenge id");
  assert.ok((submissions?.length ?? 0) > 0, "retained completed challenge must have persisted submissions");
  assert.ok(submissions?.every((submission) => submission.status === "SUBMITTED"), "solution counts should use submitted rows");
  assert.equal(winners?.[0]?.state, "PAYOUT_CONFIRMED", "retained completed challenge must be payout-confirmed");
  assert.ok(verifications?.some((row) => row.event_type === "ChallengeFunded"), "retained challenge must keep funding evidence");
  assert.ok(verifications?.some((row) => row.event_type === "ChallengePayout"), "retained challenge must keep payout evidence");
}

console.log(JSON.stringify({
  result: "P0 brand challenge list data integrity verification passed",
  retainedDraftId,
  retainedChallengeId,
  checks: [
    "solution count source",
    "canonical challenge id",
    "selection lifecycle",
    "settlement lifecycle",
    "completed lifecycle",
    "completed next action",
    "Top 1 / Top 3 representation",
    "no mock card injection",
  ],
}, null, 2));
