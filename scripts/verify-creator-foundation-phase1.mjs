import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const pkg = JSON.parse(read("package.json"));
assert.ok(pkg.dependencies["@supabase/supabase-js"], "Supabase JS dependency is required");
assert.ok(pkg.dependencies["@supabase/ssr"], "Supabase SSR dependency is required");

const env = read(".env.example");
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CIRCLE_API_KEY",
  "NEXT_PUBLIC_CIRCLE_APP_ID",
]) {
  assert.ok(env.includes(name), `${name} must be documented`);
}

const migration = read("supabase/migrations/20260722133000_creator_foundation_phase1.sql");
for (const table of ["accounts", "circle_users", "wallets", "creator_profiles", "auth_audit_events"]) {
  assert.ok(migration.includes(`public.${table}`), `${table} table must exist`);
  assert.ok(migration.includes(`alter table public.${table} enable row level security`), `${table} must enable RLS`);
}
assert.ok(migration.includes("create type public.wallet_scope"), "wallet scope enum must exist");
assert.ok(migration.includes("'BRAND_PAYMENT'") && migration.includes("'CREATOR_PAYOUT'"), "allowed wallet scopes must be fixed");
assert.ok(migration.includes("unique (account_id, scope)"), "wallet scope must be unique per account");
assert.ok(migration.includes("wallets_blockchain_wallet_address_unique"), "wallet address uniqueness must be partial");
assert.ok(migration.includes("on delete restrict"), "Circle users and wallets must not cascade delete");
assert.ok(migration.includes("accounts_select_own"), "accounts own-read policy must exist");
assert.ok(migration.includes("get_my_wallets()"), "safe wallet RPC must exist");
assert.ok(migration.includes("set search_path = pg_catalog, public"), "security sensitive functions must pin search_path");
assert.ok(migration.includes("public.wallets.wallet_address"), "security definer wallet RPC must schema-qualify wallet references");
assert.ok(!migration.includes("grant select on public.wallets to authenticated"), "wallets table must not be directly selectable by clients");
assert.ok(!migration.includes("grant select on public.circle_users to authenticated"), "circle_users must not be client-readable");
assert.ok(migration.includes("prevent_auth_audit_event_mutation"), "audit events must be append-only");
assert.ok(migration.includes("prevent_creator_profile_protected_field_update"), "creator profile protected fields must be trigger-protected");
assert.ok(migration.includes("grant update (display_name, username, country) on public.creator_profiles to authenticated"), "creator profile update grant must be column allowlisted");
assert.ok(!migration.includes("grant insert on public.auth_audit_events to authenticated"), "clients must not insert audit events");
assert.ok(!migration.includes("grant update on public.auth_audit_events to authenticated"), "clients must not update audit events");
assert.ok(!migration.includes("grant delete on public.auth_audit_events to authenticated"), "clients must not delete audit events");

const service = read("src/services/creator-foundation/creator-foundation.server.ts");
for (const fn of [
  "resolveOrCreateCcnAccount",
  "resolveOrCreateCircleUser",
  "resolveOrCreateScopedWallet",
  "startCreatorOnboarding",
]) {
  assert.ok(service.includes(`function ${fn}`) || service.includes(`function ${fn}`) || service.includes(`async function ${fn}`) || service.includes(`export async function ${fn}`), `${fn} must exist`);
}
assert.ok(service.includes("assertVerifiedAuthUser"), "account resolver must require a verified auth user");
assert.ok(service.includes("circleUserIdForAccount"), "Circle user ID must be derived server-side");
assert.ok(service.includes("idempotencyKey"), "wallet creation must use a deterministic idempotency key");
assert.ok(service.includes("status: \"PENDING\""), "wallet row must be inserted PENDING before Circle initialize");
assert.ok(service.includes("WALLET_CREATE_RECOVERY"), "wallet recovery audit must exist");
assert.ok(service.includes("circleWalletMatchesScope"), "wallet recovery must match trusted Circle metadata/refId before linking");
assert.ok(service.includes("NO_TRUSTED_MATCH"), "wallet recovery must not guess when Circle lookup lacks trusted scope metadata");
assert.ok(service.indexOf(".insert({") < service.indexOf("endpoint: \"/v1/w3s/user/initialize\""), "PENDING wallet insert must happen before Circle network call");
assert.ok(service.indexOf("endpoint: \"/v1/w3s/user/initialize\"") < service.indexOf(".update({ status: \"FAILED\" })"), "Circle call must occur outside the initial PENDING insert boundary");
assert.ok(service.includes("CREATOR_ROLE_ENABLED"), "creator role audit must exist");
assert.ok(!service.includes("local JSON"), "creator foundation service must not use local JSON persistence");

const currentRoute = read("src/app/api/account/current/route.ts");
assert.ok(currentRoute.includes("supabase.auth.getUser()"), "current account route must use Supabase Auth user");
assert.ok(currentRoute.includes("getSafeCurrentAccount"), "current account route must return safe account DTO");

const onboardingRoute = read("src/app/api/creator/onboarding/route.ts");
assert.ok(onboardingRoute.includes("startCreatorOnboarding"), "creator onboarding route must use canonical onboarding");
assert.ok(!onboardingRoute.includes("creator-submission"), "onboarding must not implement submissions");

const browser = read("src/services/supabase/browser.ts");
assert.ok(!browser.includes("SUPABASE_SERVICE_ROLE_KEY"), "service role key must not appear in browser client");

const docs = read("docs/architecture/creator-foundation.md");
for (const phrase of [
  "public_live_challenges",
  "allowlist projection",
  "canonical status",
  "one-way sync",
  "created_at",
  "challenge_id",
  "cache invalidation",
  "Phase 3",
]) {
  assert.ok(docs.includes(phrase), `architecture doc must include ${phrase}`);
}

console.log("creator foundation phase 1 static regression: ok");
