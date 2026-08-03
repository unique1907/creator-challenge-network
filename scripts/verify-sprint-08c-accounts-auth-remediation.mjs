import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const migrationPath = "supabase/migrations/20260728165000_accounts_schema_auth_remediation.sql";
const migration = read(migrationPath);

assert.ok(migration.includes("create table if not exists public.accounts"), "accounts remediation migration must create public.accounts idempotently");
assert.ok(migration.includes("supabase_user_id uuid not null unique references auth.users(id)"), "accounts must bind uniquely to Supabase Auth user ID");
assert.ok(migration.includes("account_id uuid primary key default gen_random_uuid()"), "accounts must use stable generated application account IDs");
assert.ok(migration.includes("is_brand boolean not null default false"), "Brand access must default to false");
assert.ok(migration.includes("is_creator boolean not null default false"), "Creator access must default to false");
assert.ok(migration.includes("status public.account_status not null default 'ACTIVE'"), "account status must default to ACTIVE");
assert.ok(migration.includes("alter table public.accounts enable row level security"), "accounts must enable RLS");
assert.ok(migration.includes("revoke all on public.accounts from anon, authenticated"), "accounts must revoke broad client access");
assert.ok(migration.includes("grant select on public.accounts to authenticated"), "authenticated users may only read through RLS");
assert.ok(migration.includes("accounts_select_own"), "own-account read policy must exist");
assert.ok(!migration.match(/grant\s+update\s+on\s+public\.accounts\s+to\s+authenticated/i), "authenticated users must not update account roles/status");
assert.ok(!migration.match(/grant\s+insert\s+on\s+public\.accounts\s+to\s+authenticated/i), "authenticated users must not create accounts directly");
assert.ok(!migration.match(/grant\s+delete\s+on\s+public\.accounts\s+to\s+authenticated/i), "authenticated users must not delete accounts");

const foundation = read("src/services/creator-foundation/creator-foundation.server.ts");
assert.ok(foundation.includes("createSupabaseAdminClient"), "account resolver must use server-side service-role client");
assert.ok(foundation.includes(".eq(\"supabase_user_id\", supabaseUserId)"), "account lookup must bind by Supabase user ID");
assert.ok(foundation.includes(".upsert("), "account creation must be conflict-safe");
assert.ok(foundation.includes("onConflict: \"supabase_user_id\""), "account upsert must use Supabase user ID uniqueness");
assert.ok(!foundation.includes("is_brand: true,") || foundation.includes("completeBrandOnboarding"), "account resolver must not grant Brand by default");
assert.ok(!foundation.includes("is_creator: true,") || foundation.includes("startCreatorOnboarding"), "account resolver must not grant Creator by default");
assert.ok(foundation.includes("assertVerifiedAuthUser"), "resolver must require verified Supabase user");
assert.ok(!foundation.includes("local JSON"), "account resolver must not fall back to local files");

const auth = read("src/services/auth/ccn-auth.server.ts");
assert.ok(auth.includes("primaryRoleForAccount(input.account)"), "Workspace access must be server-derived from the canonical account role flags");
assert.ok(auth.includes('brandAccess: primaryRole === "brand"'), "Brand workspace access must require Brand-only primary role");
assert.ok(auth.includes('creatorAccess: primaryRole === "creator"'), "Creator workspace access must require Creator-only primary role");
assert.ok(auth.includes("DUAL_ROLE_ACCOUNT_NOT_ALLOWED"), "Dual-role accounts must be rejected server-side");
assert.ok(auth.includes("input.account.status !== \"ACTIVE\""), "inactive accounts must be rejected");
assert.ok(auth.includes("input.account.deleted_at"), "soft-deleted accounts must be rejected");

const browser = read("src/services/supabase/browser.ts");
assert.ok(!browser.includes("SUPABASE_SERVICE_ROLE_KEY"), "browser client must not contain service-role key access");

console.log(JSON.stringify({
  result: "Sprint 8C accounts schema/auth remediation static verification passed",
  migration: migrationPath,
  accountDefaults: { isBrand: false, isCreator: false, status: "ACTIVE" },
  authBinding: "supabase_user_id",
  rls: "own read only; no client role escalation grants",
}, null, 2));
