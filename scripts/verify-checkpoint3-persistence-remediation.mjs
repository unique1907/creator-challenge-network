import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function includes(file, text, message) {
  assert.ok(read(file).includes(text), message);
}

const createStore = "src/services/create-challenge/create-challenge-store.server.ts";
const submissionStore = "src/services/submissions/submission-store.server.ts";
const walletStore = "src/services/circle/wallet-spike-store.server.ts";
const migration = "supabase/migrations/20260727143000_checkpoint3_lifecycle_persistence.sql";

includes(createStore, "CCN_LIFECYCLE_PERSISTENCE", "create challenge lifecycle store must select a configured persistence adapter");
includes(createStore, "VERCEL_ENV === \"production\"", "Vercel production create challenge store must default to Supabase");
includes(createStore, "CCN_DEPLOYMENT_ENV === \"production\"", "explicit production create challenge store must default to Supabase");
includes(createStore, "Production lifecycle persistence must use Supabase/Postgres", "production create challenge store must fail closed without Supabase");
includes(createStore, "readSupabaseStore", "create challenge store must implement a Supabase read adapter");
includes(createStore, "writeSupabaseStore", "create challenge store must implement a Supabase write adapter");
includes(createStore, "ccn_challenge_drafts", "create challenge store must persist drafts to the lifecycle schema");
includes(createStore, "ccn_winner_finalization_attempts", "winner finalization attempts must persist to the lifecycle schema");
includes(createStore, "ccn_onchain_verifications", "on-chain verification records must persist to the lifecycle schema");

includes(submissionStore, "CCN_LIFECYCLE_PERSISTENCE", "submission store must share the lifecycle persistence adapter setting");
includes(submissionStore, "VERCEL_ENV === \"production\"", "Vercel production submission store must default to Supabase");
includes(submissionStore, "Production submission persistence must use Supabase/Postgres", "production submission store must fail closed without Supabase");
includes(submissionStore, "readSupabaseStore", "submission store must implement a Supabase read adapter");
includes(submissionStore, "writeSupabaseStore", "submission store must implement a Supabase write adapter");
includes(submissionStore, "Submitted entries are immutable", "immutable submitted state guard must remain");
includes(submissionStore, "unique", "submission store verification must not remove DB uniqueness expectations");

includes(walletStore, "CCN_LIFECYCLE_PERSISTENCE", "wallet mapping store must share the lifecycle persistence adapter setting");
includes(walletStore, "Production wallet mapping persistence must use Supabase/Postgres", "production wallet mapping store must fail closed without Supabase");
includes(walletStore, "ccn_wallet_mappings", "scoped wallet mappings must persist to Supabase in production");

for (const table of [
  "ccn_challenge_drafts",
  "ccn_challenge_funding_records",
  "ccn_wallet_approval_attempts",
  "ccn_funding_attempts",
  "ccn_creator_submissions",
  "ccn_submission_finalize_keys",
  "ccn_review_scores",
  "ccn_winner_finalization_attempts",
  "ccn_onchain_verifications",
  "ccn_lifecycle_events",
  "ccn_wallet_mappings",
  "ccn_legacy_wallet_records",
]) {
  includes(migration, `public.${table}`, `${table} must be present in lifecycle migration`);
}

includes(migration, "unique (challenge_id, creator_account_id)", "database must prevent duplicate creator submissions");
includes(migration, "unique (idempotency_key)", "database must enforce idempotency uniqueness");
includes(migration, "ccn_payout_intent_once_per_challenge_idx", "database must prevent duplicate payout intents per challenge");
includes(migration, "check (creator_wallet_address ~ '^0x[0-9a-fA-F]{40}$')", "database must constrain wallet address shape");
includes(".env.example", "CCN_LIFECYCLE_PERSISTENCE=supabase", ".env.example must document Supabase lifecycle persistence");

console.log(JSON.stringify({
  result: "Checkpoint 3 persistence remediation static verification passed",
  adapter: "filesystem for explicit local/test, Supabase for production",
  migration,
  productionFallbackToLocalJson: false,
}, null, 2));
