import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const RETAINED_DRAFT_ID = "7897dca3-8299-4770-a013-e2595b92f5fe";
const RETAINED_CHALLENGE_ID = "0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4";
const RETAINED_FUNDING_INTENT_ID = "426c90be-1c21-4798-923f-04c3145cbf73";

const ROOT = process.cwd();
const LOCAL_STORE_PATH = join(ROOT, ".local", "create-challenge-flow.json");
const LOCAL_SUBMISSION_STORE_PATH = join(ROOT, ".local", "internal-submissions-spike.json");
const ENV_LOCAL_PATH = join(ROOT, ".env.local");
const BACKUP_ROOT = join(ROOT, ".local", "backups");
const TABLES = {
  drafts: ["ccn_challenge_drafts", "*"],
  fundingRecords: ["ccn_challenge_funding_records", "*"],
  approvalAttempts: ["ccn_wallet_approval_attempts", "*"],
  fundingAttempts: ["ccn_funding_attempts", "*"],
  submissions: ["ccn_creator_submissions", "*"],
  finalizeKeys: ["ccn_submission_finalize_keys", "*"],
  reviewScores: ["ccn_review_scores", "*"],
  winners: ["ccn_winner_finalization_attempts", "*"],
  verifications: ["ccn_onchain_verifications", "*"],
  slugs: ["ccn_public_slug_reservations", "*"],
  lifecycle: ["ccn_lifecycle_events", "*"],
};

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
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

function readJson(filePath, fallback) {
  if (!existsSync(filePath)) return structuredClone(fallback);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function copyIfExists(filePath, backupDir, label) {
  if (!existsSync(filePath)) return null;
  const target = join(backupDir, label);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(filePath, target);
  return target;
}

function collectLocalInventory(store, submissionsStore) {
  const drafts = Object.values(store.drafts ?? {});
  const draftIds = drafts.map((draft) => draft?.challenge?.id).filter(Boolean);
  const challengeIds = drafts.map((draft) => draft?.challenge?.challengeId).filter(Boolean);
  return {
    draftIds,
    challengeIds,
    activeDraftId: store.activeDraftId ?? null,
    fundingRecordKeys: Object.keys(store.fundingRecords ?? {}),
    approvalAttemptKeys: Object.keys(store.approvalAttempts ?? {}),
    fundingAttemptKeys: Object.keys(store.fundingAttempts ?? {}),
    winnerFinalizationKeys: Object.keys(store.winnerFinalizationAttempts ?? {}),
    onChainVerificationKeys: Object.keys(store.onChainVerificationsByTxHash ?? {}),
    submissionChallengeIds: (submissionsStore.submissions ?? []).map((submission) => submission.challengeId).filter(Boolean),
    submissionFinalizeKeys: Object.keys(submissionsStore.finalizeKeys ?? {}),
  };
}

function filterObjectByRecord(value, keep) {
  const next = {};
  for (const [key, record] of Object.entries(value ?? {})) {
    if (keep(key, record)) next[key] = record;
  }
  return next;
}

function disableLocalStaticMocks(backupDir) {
  if (!existsSync(ENV_LOCAL_PATH)) return { changed: false, reason: ".env.local missing" };
  copyIfExists(ENV_LOCAL_PATH, backupDir, ".env.local");
  const before = readFileSync(ENV_LOCAL_PATH, "utf8");
  const after = before
    .split(/\r?\n/)
    .map((line) => line.startsWith("CCN_SMOKE_TEST_MODE=") ? "CCN_SMOKE_TEST_MODE=false" : line)
    .join("\n");
  if (after !== before) writeFileSync(ENV_LOCAL_PATH, after);
  return { changed: after !== before, disabled: ["CCN_SMOKE_TEST_MODE"] };
}

function cleanupLocalStores(backupDir) {
  const store = readJson(LOCAL_STORE_PATH, { version: 1, revision: 0, drafts: {} });
  const submissionsStore = readJson(LOCAL_SUBMISSION_STORE_PATH, { submissions: [], finalizeKeys: {} });
  const before = collectLocalInventory(store, submissionsStore);

  copyIfExists(LOCAL_STORE_PATH, backupDir, ".local/create-challenge-flow.json");
  copyIfExists(LOCAL_SUBMISSION_STORE_PATH, backupDir, ".local/internal-submissions-spike.json");

  const keptDraft = store.drafts?.[RETAINED_DRAFT_ID];
  const nextStore = {
    ...store,
    revision: Number(store.revision ?? 0) + 1,
    activeDraftId: keptDraft ? RETAINED_DRAFT_ID : undefined,
    drafts: keptDraft ? { [RETAINED_DRAFT_ID]: keptDraft } : {},
    publicSlugReservations: filterObjectByRecord(store.publicSlugReservations, (_key, record) => record?.draftId === RETAINED_DRAFT_ID),
    fundingRecords: filterObjectByRecord(store.fundingRecords, (_key, record) => record?.draftId === RETAINED_DRAFT_ID || record?.challengeId === RETAINED_CHALLENGE_ID),
    approvalAttempts: filterObjectByRecord(store.approvalAttempts, (_key, records) => (records ?? []).some((record) => record?.draftId === RETAINED_DRAFT_ID || record?.challengeId === RETAINED_CHALLENGE_ID)),
    fundingAttempts: filterObjectByRecord(store.fundingAttempts, (_key, records) => (records ?? []).some((record) => record?.draftId === RETAINED_DRAFT_ID || record?.challengeId === RETAINED_CHALLENGE_ID)),
    winnerFinalizationAttempts: filterObjectByRecord(store.winnerFinalizationAttempts, (_key, record) => record?.draftId === RETAINED_DRAFT_ID || record?.challengeId === RETAINED_CHALLENGE_ID),
    onChainVerificationsByTxHash: filterObjectByRecord(store.onChainVerificationsByTxHash, (_key, record) => record?.draftId === RETAINED_DRAFT_ID || record?.challengeId === RETAINED_CHALLENGE_ID),
  };
  if (!nextStore.activeDraftId) delete nextStore.activeDraftId;
  writeJson(LOCAL_STORE_PATH, nextStore);

  const keptSubmissions = (submissionsStore.submissions ?? []).filter((submission) => submission.challengeId === RETAINED_CHALLENGE_ID);
  const keptSubmissionIds = new Set(keptSubmissions.map((submission) => submission.submissionId).filter(Boolean));
  const nextSubmissionsStore = {
    submissions: keptSubmissions,
    finalizeKeys: filterObjectByRecord(submissionsStore.finalizeKeys, (key, record) => {
      if (record?.submissionId) return keptSubmissionIds.has(record.submissionId);
      return key.includes(RETAINED_CHALLENGE_ID);
    }),
  };
  writeJson(LOCAL_SUBMISSION_STORE_PATH, nextSubmissionsStore);

  const after = collectLocalInventory(nextStore, nextSubmissionsStore);
  return { before, after };
}

async function selectAll(supabase, table, columns = "*") {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw new Error(`${table} select failed: ${error.message}`);
  return data ?? [];
}

async function deleteByIn(supabase, table, column, values, select = column) {
  if (!values.length) return [];
  const { data, error } = await supabase.from(table).delete().in(column, values).select(select);
  if (error) throw new Error(`${table} delete failed: ${error.message}`);
  return data ?? [];
}

async function cleanupSupabase(backupDir) {
  const env = loadEnv(join(ROOT, ".env.local"));
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase cleanup requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  }
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const before = {};
  for (const [name, [table, columns]] of Object.entries(TABLES)) {
    before[name] = await selectAll(supabase, table, columns);
  }
  writeJson(join(backupDir, "supabase-before.json"), before);

  const retainedDraft = before.drafts.find((row) => row.draft_id === RETAINED_DRAFT_ID);
  if (!retainedDraft) throw new Error(`Retained draft ${RETAINED_DRAFT_ID} was not found in Supabase.`);
  if (retainedDraft.challenge_id !== RETAINED_CHALLENGE_ID) throw new Error("Retained challenge_id mismatch; refusing cleanup.");
  if (retainedDraft.funding_intent_id !== RETAINED_FUNDING_INTENT_ID) throw new Error("Retained funding_intent_id mismatch; refusing cleanup.");

  const removedDraftIds = before.drafts.map((row) => row.draft_id).filter((id) => id !== RETAINED_DRAFT_ID);
  const removedChallengeIds = before.drafts.map((row) => row.challenge_id).filter((id) => id !== RETAINED_CHALLENGE_ID);
  const removedSubmissionIds = before.submissions
    .filter((row) => row.challenge_id !== RETAINED_CHALLENGE_ID)
    .map((row) => row.submission_id);

  const removed = {};
  removed.finalizeKeys = await deleteByIn(supabase, "ccn_submission_finalize_keys", "submission_id", removedSubmissionIds, "finalize_key,submission_id");
  removed.reviewScores = await deleteByIn(supabase, "ccn_review_scores", "challenge_id", removedChallengeIds, "score_id,challenge_id,submission_id");
  removed.submissions = await deleteByIn(supabase, "ccn_creator_submissions", "challenge_id", removedChallengeIds, "submission_id,challenge_id,anonymous_entry_code");
  removed.lifecycleByChallenge = await deleteByIn(supabase, "ccn_lifecycle_events", "challenge_id", removedChallengeIds, "event_id,draft_id,challenge_id,event_type");
  const orphanLifecycle = (await selectAll(supabase, "ccn_lifecycle_events", "event_id,draft_id,challenge_id,event_type"))
    .filter((row) => row.challenge_id && row.challenge_id !== RETAINED_CHALLENGE_ID)
    .map((row) => row.event_id);
  removed.lifecycleOrphans = await deleteByIn(supabase, "ccn_lifecycle_events", "event_id", orphanLifecycle, "event_id,draft_id,challenge_id,event_type");
  removed.verifications = await deleteByIn(supabase, "ccn_onchain_verifications", "draft_id", removedDraftIds, "tx_hash,draft_id,challenge_id,event_type");
  removed.winners = await deleteByIn(supabase, "ccn_winner_finalization_attempts", "draft_id", removedDraftIds, "scope_key,draft_id,challenge_id,state");
  removed.fundingAttempts = await deleteByIn(supabase, "ccn_funding_attempts", "draft_id", removedDraftIds, "scope_key,circle_challenge_id,draft_id,challenge_id");
  removed.approvalAttempts = await deleteByIn(supabase, "ccn_wallet_approval_attempts", "draft_id", removedDraftIds, "scope_key,circle_challenge_id,draft_id,challenge_id");
  removed.fundingRecords = await deleteByIn(supabase, "ccn_challenge_funding_records", "draft_id", removedDraftIds, "record_key,draft_id,challenge_id");
  removed.slugs = await deleteByIn(supabase, "ccn_public_slug_reservations", "draft_id", removedDraftIds, "slug,draft_id");
  removed.drafts = await deleteByIn(supabase, "ccn_challenge_drafts", "draft_id", removedDraftIds, "draft_id,challenge_id,title");

  const after = {};
  for (const [name, [table, columns]] of Object.entries(TABLES)) {
    after[name] = await selectAll(supabase, table, columns);
  }
  writeJson(join(backupDir, "supabase-after.json"), after);
  writeJson(join(backupDir, "supabase-removed.json"), removed);

  const badDrafts = after.drafts.filter((row) => row.draft_id !== RETAINED_DRAFT_ID);
  const badChallengeRows = [
    ...after.fundingRecords,
    ...after.approvalAttempts,
    ...after.fundingAttempts,
    ...after.submissions,
    ...after.reviewScores,
    ...after.winners,
    ...after.verifications,
    ...after.lifecycle.filter((row) => row.challenge_id),
  ].filter((row) => row.challenge_id !== RETAINED_CHALLENGE_ID);
  const badSlugRows = after.slugs.filter((row) => row.draft_id !== RETAINED_DRAFT_ID);
  if (badDrafts.length || badChallengeRows.length || badSlugRows.length) {
    throw new Error("Post-cleanup Supabase verification found non-retained challenge rows.");
  }

  return {
    before: {
      draftIds: before.drafts.map((row) => row.draft_id),
      challengeIds: before.drafts.map((row) => row.challenge_id),
      counts: Object.fromEntries(Object.entries(before).map(([key, rows]) => [key, rows.length])),
    },
    after: {
      draftIds: after.drafts.map((row) => row.draft_id),
      challengeIds: after.drafts.map((row) => row.challenge_id),
      counts: Object.fromEntries(Object.entries(after).map(([key, rows]) => [key, rows.length])),
    },
    removed: {
      draftIds: removed.drafts.map((row) => row.draft_id),
      challengeIds: removed.drafts.map((row) => row.challenge_id),
      counts: Object.fromEntries(Object.entries(removed).map(([key, rows]) => [key, rows.length])),
    },
    retained: {
      draftId: retainedDraft.draft_id,
      challengeId: retainedDraft.challenge_id,
      fundingIntentId: retainedDraft.funding_intent_id,
      title: retainedDraft.title,
    },
  };
}

async function main() {
  const backupDir = join(BACKUP_ROOT, `p0-demo-challenge-cleanup-${timestamp()}`);
  mkdirSync(backupDir, { recursive: true });

  const env = disableLocalStaticMocks(backupDir);
  const local = cleanupLocalStores(backupDir);
  const supabase = await cleanupSupabase(backupDir);

  const result = {
    verdict: "PASS",
    backupDir,
    retainedDraftId: RETAINED_DRAFT_ID,
    retainedChallengeId: RETAINED_CHALLENGE_ID,
    env,
    local,
    supabase,
    browserStorageKeys: {
      sessionStorage: ["ccn:create-challenge-demo-draft"],
      localStorage: ["ccn:brand-workspace-notifications-read"],
    },
  };
  writeJson(join(backupDir, "cleanup-result.json"), result);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
