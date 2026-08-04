import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RETAINED_DRAFT_ID = "7897dca3-8299-4770-a013-e2595b92f5fe";
const RETAINED_CHALLENGE_ID = "0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4";
const ROOT = process.cwd();

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

function readJson(filePath, fallback) {
  if (!existsSync(filePath)) return structuredClone(fallback);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function selectAll(supabase, table) {
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw new Error(`${table} select failed: ${error.message}`);
  return data ?? [];
}

async function main() {
  const localStore = readJson(join(ROOT, ".local", "create-challenge-flow.json"), { drafts: {} });
  const localSubmissions = readJson(join(ROOT, ".local", "internal-submissions-spike.json"), { submissions: [], finalizeKeys: {} });
  const localDraftIds = Object.keys(localStore.drafts ?? {});
  assert(localDraftIds.length === 0 || (localDraftIds.length === 1 && localDraftIds[0] === RETAINED_DRAFT_ID), "local draft store must contain only the retained draft or be empty when inactive");
  for (const draft of Object.values(localStore.drafts ?? {})) {
    assert(draft?.challenge?.id === RETAINED_DRAFT_ID, "local draft record must match retained draft id");
    assert(draft?.challenge?.challengeId === RETAINED_CHALLENGE_ID, "local draft record must match retained challenge id");
  }
  for (const submission of localSubmissions.submissions ?? []) {
    assert(submission.challengeId === RETAINED_CHALLENGE_ID, "local submission store must not contain removed challenge submissions");
  }
  for (const key of Object.keys(localSubmissions.finalizeKeys ?? {})) {
    assert(key.includes(RETAINED_CHALLENGE_ID), "local finalize keys must not reference removed challenge ids");
  }

  const env = loadEnv(join(ROOT, ".env.local"));
  assert(env.CCN_LIFECYCLE_PERSISTENCE === "supabase", ".env.local must keep Supabase lifecycle persistence for the active demo");
  assert(env.CCN_INCLUDE_STATIC_CHALLENGE_MOCKS !== "true", "static challenge mocks must not be explicitly enabled");
  assert(env.CCN_SMOKE_TEST_MODE !== "true", "smoke test mode must not re-enable static challenge mocks for the cleaned demo");
  assert(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY, "Supabase env values are required for verification");
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const tables = {
    drafts: "ccn_challenge_drafts",
    fundingRecords: "ccn_challenge_funding_records",
    approvalAttempts: "ccn_wallet_approval_attempts",
    fundingAttempts: "ccn_funding_attempts",
    submissions: "ccn_creator_submissions",
    reviewScores: "ccn_review_scores",
    winners: "ccn_winner_finalization_attempts",
    verifications: "ccn_onchain_verifications",
    slugs: "ccn_public_slug_reservations",
    lifecycle: "ccn_lifecycle_events",
  };
  const rows = {};
  for (const [name, table] of Object.entries(tables)) rows[name] = await selectAll(supabase, table);

  assert(rows.drafts.length === 1, `expected exactly one Supabase draft, found ${rows.drafts.length}`);
  assert(rows.drafts[0].draft_id === RETAINED_DRAFT_ID, "remaining Supabase draft must be retained draft");
  assert(rows.drafts[0].challenge_id === RETAINED_CHALLENGE_ID, "remaining Supabase challenge must be retained challenge");
  assert(rows.drafts[0].draft_state?.challenge?.id === RETAINED_DRAFT_ID, "retained draft_state challenge.id must remain intact");
  assert(rows.drafts[0].draft_state?.challenge?.challengeId === RETAINED_CHALLENGE_ID, "retained draft_state challengeId must remain intact");
  assert(rows.drafts[0].draft_state?.deployment?.publicationStatus === "live", "retained challenge must remain live");
  assert(rows.drafts[0].draft_state?.funding?.transactionHash, "retained funding transaction reference must remain intact");

  for (const [name, tableRows] of Object.entries(rows)) {
    if (name === "drafts") continue;
    for (const row of tableRows) {
      if ("draft_id" in row && row.draft_id !== null) assert(row.draft_id === RETAINED_DRAFT_ID, `${name} contains non-retained draft_id`);
      if ("challenge_id" in row && row.challenge_id !== null) assert(row.challenge_id === RETAINED_CHALLENGE_ID, `${name} contains non-retained challenge_id`);
    }
  }

  assert(rows.submissions.length === 1, "retained challenge must keep exactly one creator submission");
  assert(rows.reviewScores.length >= 1, "retained challenge must keep evaluation score records");
  assert(rows.winners.length === 1, "retained challenge must keep winner finalization attempt");
  assert(rows.winners[0].state === "PAYOUT_CONFIRMED", "retained challenge must keep payout confirmation state");
  assert(rows.verifications.some((row) => row.event_type === "ChallengeFunded"), "retained funding verification must remain");
  assert(rows.verifications.some((row) => row.event_type === "ChallengePayout"), "retained payout verification must remain");
  assert(rows.slugs.length === 1 && rows.slugs[0].draft_id === RETAINED_DRAFT_ID, "only retained slug reservation may remain");

  console.log(JSON.stringify({
    result: "P0 demo challenge cleanup verification passed",
    retainedDraftId: RETAINED_DRAFT_ID,
    retainedChallengeId: RETAINED_CHALLENGE_ID,
    counts: Object.fromEntries(Object.entries(rows).map(([name, tableRows]) => [name, tableRows.length])),
    localDraftIds,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
