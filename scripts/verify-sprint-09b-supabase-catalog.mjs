import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function listFiles(dir, suffix = "") {
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) return [];
  const out = [];
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(rel, suffix));
    if (entry.isFile() && (!suffix || entry.name.endsWith(suffix))) out.push(rel.replaceAll("\\", "/"));
  }
  return out;
}

function assertIncludes(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

function assertReadOnlySql(sql) {
  const withoutComments = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const forbidden = /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|call|do|copy|vacuum|analyze|set\s+role|security\s+definer)\b/i;
  assert.ok(!forbidden.test(withoutComments), "catalog proof SQL must remain read-only");
}

const expectedTables = [
  "accounts",
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
];

const proofPath = "supabase/operator/sprint-09b-catalog-proof.sql";
assert.ok(exists(proofPath), "operator catalog proof SQL must exist");
const proofSql = read(proofPath);
assertReadOnlySql(proofSql);

for (const table of expectedTables) {
  assertIncludes(proofSql, table, `catalog proof SQL must cover ${table}`);
}

for (const token of [
  "information_schema.tables",
  "information_schema.columns",
  "pg_constraint",
  "pg_index",
  "pg_policies",
  "relrowsecurity",
  "role_table_grants",
  "storage.buckets",
  "storage.objects",
  "ccn-media authenticated reads",
  "auth.users",
  "orphan_account_count",
  "duplicate_group_count",
  "supabase_user_id",
]) {
  assertIncludes(proofSql, token, `catalog proof SQL must include ${token}`);
}

assertIncludes(proofSql, "constraint_row.contype = 'f'", "foreign-key proof must use pg_constraint");
assertIncludes(proofSql, "target_namespace.nspname", "foreign-key proof must include target schema");
assertIncludes(proofSql, "target_table.relname", "foreign-key proof must include target table");
assertIncludes(proofSql, "target_column.attname", "foreign-key proof must include target column");
assertIncludes(proofSql, "ccn_submission_finalize_keys.finalize_key", "submission finalization duplicate proof must use the real finalize_key column");
assert.ok(!proofSql.includes("ccn_submission_finalize_keys.idempotency_key"), "submission finalization proof must not reference nonexistent idempotency_key column");
assertIncludes(proofSql, "ccn_onchain_verifications.challenge_id+event_type+tx_hash", "on-chain verification duplicate proof must use real challenge_id/event_type/tx_hash columns");
assert.ok(!proofSql.includes("ccn_onchain_verifications.tx_hash+purpose"), "on-chain verification proof must not reference nonexistent purpose column");

const migrationFiles = listFiles("supabase/migrations", ".sql").sort();
assert.deepEqual(migrationFiles, [
  "supabase/migrations/20260722133000_creator_foundation_phase1.sql",
  "supabase/migrations/20260727143000_checkpoint3_lifecycle_persistence.sql",
  "supabase/migrations/20260728165000_accounts_schema_auth_remediation.sql",
  "supabase/migrations/20260729120000_accounts_auth_users_fk_guard.sql",
  "supabase/migrations/20260730143000_brand_onboarding_profile.sql",
  "supabase/migrations/20260730190000_brand_identity_campaign_media.sql",
  "supabase/migrations/20260731110000_public_slug_reservations.sql",
  "supabase/migrations/20260801100000_account_role_isolation_preflight.sql",
  "supabase/migrations/20260801120000_accounts_single_primary_role_constraint.sql",
  "supabase/migrations/20260802170000_creator_profile_avatar_persistence.sql",
  "supabase/migrations/manual/20260730190000_brand_identity_campaign_media_recovery.sql",
], "migration order must be explicit and stable for Sprint 09B");

const foundation = read("supabase/migrations/20260722133000_creator_foundation_phase1.sql");
const authRemediation = read("supabase/migrations/20260728165000_accounts_schema_auth_remediation.sql");
const fkGuard = read("supabase/migrations/20260729120000_accounts_auth_users_fk_guard.sql");
const mediaMigration = read("supabase/migrations/20260730190000_brand_identity_campaign_media.sql");
const creatorProfileMigration = read("supabase/migrations/20260802170000_creator_profile_avatar_persistence.sql");

assertIncludes(foundation, "supabase_user_id uuid not null unique", "foundation migration must show original unique auth binding");
assert.ok(!foundation.match(/supabase_user_id uuid not null unique references auth\.users\(id\)/i), "foundation migration documents the historical no-FK compatibility risk");
assertIncludes(authRemediation, "references auth.users(id) on delete restrict", "Sprint 8C migration must create fresh projects with auth.users FK");
assertIncludes(authRemediation, "create table if not exists public.accounts", "Sprint 8C migration must be additive");
assertIncludes(fkGuard, "add constraint accounts_supabase_user_id_auth_users_fkey", "FK guard migration must use deterministic constraint name");
assertIncludes(fkGuard, "left join auth.users", "FK guard migration must check orphan rows before adding FK");
assertIncludes(fkGuard, "not valid", "FK guard migration must add the FK safely before validation");
assertIncludes(fkGuard, "validate constraint accounts_supabase_user_id_auth_users_fkey", "FK guard migration must validate the FK");
assertIncludes(fkGuard, "on delete restrict", "FK guard migration must not cascade-delete account rows");
assert.ok(!fkGuard.match(/on delete cascade/i), "FK guard migration must not use ON DELETE CASCADE");
assert.ok(!fkGuard.match(/\bdelete\s+from\b|\bupdate\s+public\.accounts\b|\bdrop\s+table\b/i), "FK guard migration must not mutate or drop account rows");
assertIncludes(mediaMigration, "insert into storage.buckets", "media migration must define storage bucket creation");
assertIncludes(mediaMigration, "'ccn-media'", "media migration must define the ccn-media bucket");
assertIncludes(mediaMigration, "ccn-media authenticated reads", "media migration must define storage read policy");
for (const column of ["auth_user_id", "username_normalized", "avatar_image_key", "avatar_image_updated_at"]) {
  assertIncludes(creatorProfileMigration, column, `creator profile migration must include ${column}`);
}

for (const file of [
  "SPRINT_09B_SUPABASE_CATALOG_PROOF_REPORT.md",
  "SPRINT_09B_PRODUCTION_OPERATOR_CHECKLIST.md",
  "SUPABASE_CATALOG_PROOF_RUNBOOK.md",
]) {
  assert.ok(exists(file), `${file} must exist`);
}

const packageJson = JSON.parse(read("package.json"));
assert.equal(
  packageJson.scripts["test:sprint-09b-supabase-catalog-proof"],
  "node scripts/verify-sprint-09b-supabase-catalog.mjs",
  "package script must expose Sprint 09B verifier",
);

const envExample = read(".env.example");
for (const envName of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CCN_LIFECYCLE_PERSISTENCE=supabase",
  "CCN_SMOKE_TEST_MODE=false",
  "CCN_AUTH_TEST_MODE=false",
  "CCN_INCLUDE_STATIC_CHALLENGE_MOCKS=false",
]) {
  assertIncludes(envExample, envName, `.env.example must document ${envName}`);
}

const scanned = [
  proofSql,
  fkGuard,
  read("SPRINT_09B_SUPABASE_CATALOG_PROOF_REPORT.md"),
  read("SPRINT_09B_PRODUCTION_OPERATOR_CHECKLIST.md"),
  read("SUPABASE_CATALOG_PROOF_RUNBOOK.md"),
].join("\n");
assert.ok(!scanned.match(/SUPABASE_SERVICE_ROLE_KEY=\S+/), "Sprint 09B artifacts must not contain a service-role value");
assert.ok(!scanned.match(/CIRCLE_API_KEY=\S+/), "Sprint 09B artifacts must not contain a Circle API key value");
assert.ok(!scanned.match(/postgres(ql)?:\/\/[^ \n]+/i), "Sprint 09B artifacts must not contain database URLs");

if (process.env.CCN_SUPABASE_CATALOG_PROOF === "true") {
  const catalogAccessAvailable =
    Boolean(process.env.SUPABASE_TEST_DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL) &&
    false;
  assert.ok(
    catalogAccessAvailable,
    "Live catalog proof requires a direct PostgreSQL catalog path. None is configured for this verifier; run supabase/operator/sprint-09b-catalog-proof.sql in Supabase SQL Editor and archive safe output.",
  );
}

console.log(JSON.stringify({
  result: "Sprint 09B Supabase catalog proof static verification passed",
  proofSql: proofPath,
  expectedTablesChecked: expectedTables.length,
  remediationMigration: "supabase/migrations/20260729120000_accounts_auth_users_fk_guard.sql",
  liveMode: process.env.CCN_SUPABASE_CATALOG_PROOF === "true" ? "requires SQL Editor catalog proof" : "not requested",
  sideEffects: "none",
}, null, 2));
