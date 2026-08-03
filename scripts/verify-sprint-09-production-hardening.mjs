import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
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

const proxy = read("src/proxy.ts");
assert.ok(proxy.includes("pathname.startsWith(\"/internal\")"), "proxy must block /internal in production");
assert.ok(proxy.includes("pathname.startsWith(\"/api/internal\")"), "proxy must block /api/internal in production");
assert.ok(proxy.includes("status: 404"), "production internal routes should not be discoverable");

const internalUtils = read("src/app/api/internal/circle/_utils.ts");
assert.ok(internalUtils.includes("requireInternalDevelopmentRoute"), "internal API utility must expose a route-level production guard");
assert.ok(internalUtils.includes("isSpikeAllowedInEnvironment"), "internal API utility must use the environment guard");
assert.ok(internalUtils.includes("new NextResponse(null, { status: 404 })"), "internal API utility must fail closed with 404 outside development");

const internalRouteFiles = listFiles("src/app/api/internal", "route.ts");
assert.ok(internalRouteFiles.length > 0, "internal API inventory must not be empty");
for (const file of internalRouteFiles) {
  const source = read(file);
  const guarded = source.includes("requireSpikeAccess()") || source.includes("requireInternalDevelopmentRoute()") || source.includes("isSpikeAllowedInEnvironment()");
  assert.ok(guarded, `${file} must have a route-level internal production guard`);
}

const fatPage = read("src/app/internal/fat01-payout-approval/page.tsx");
assert.ok(fatPage.includes("isSpikeAllowedInEnvironment"), "FAT-01 internal page must be server-side dev guarded");
assert.ok(fatPage.includes("notFound()"), "FAT-01 internal page must 404 outside development");

const creatorActions = read("src/features/creator-workspace/components/creator-actions.tsx");
assert.ok(creatorActions.includes("/api/creator/submissions/draft"), "Creator product UI must save submissions through product API");
assert.ok(creatorActions.includes("/api/creator/submissions/finalize"), "Creator product UI must finalize submissions through product API");
assert.ok(!creatorActions.includes("/api/internal/submissions"), "Creator product UI must not call internal submission APIs");

const creatorWorkspace = read("src/features/creator-workspace/components/creator-workspace.tsx");
assert.ok(creatorWorkspace.includes("isSpikeAllowedInEnvironment() ? <CreatorSignInAction /> : null"), "Creator demo sign-in control must be hidden outside development");

const creatorWorkspaceFacts = read("src/services/creator-workspace/creator-workspace.server.ts");
assert.ok(creatorWorkspaceFacts.includes("/api/creator/submissions/draft"), "Creator workspace facts must advertise product submission routes");
assert.ok(!creatorWorkspaceFacts.includes('"/api/internal/submissions/draft"'), "Creator workspace facts must not preserve old internal submission route as product write path");

const published = read("src/services/create-challenge/published-challenge.server.ts");
assert.ok(published.includes("includeStaticChallengeMocks"), "public challenge resolver must explicitly gate static mocks");
assert.ok(published.includes("CCN_INCLUDE_STATIC_CHALLENGE_MOCKS"), "static mocks must require explicit env configuration outside production");
assert.ok(published.includes("if (isProductionRuntime()) return false"), "production must exclude static challenge mocks");
assert.ok(published.includes("canonicalSlugs"), "canonical challenges must win slug collisions over mocks");
assert.ok(published.includes('source: "canonical"'), "canonical public challenges must be classifiable");
assert.ok(published.includes('source: "mock"'), "mock public challenges must be classifiable when included");

const challengeDetail = read("src/app/challenges/[slug]/page.tsx");
assert.ok(challengeDetail.includes("if (!includeStaticChallengeMocks()) return []"), "production detail route must not prebuild static mock slugs");
assert.ok(challengeDetail.indexOf("getPublishedCreateChallengeBySlug(slug)") < challengeDetail.indexOf("includeStaticChallengeMocks() ? getChallengeBySlug(slug)"), "challenge detail must prefer canonical published challenges before static mocks");

const ccnTypes = read("src/types/ccn.ts");
assert.ok(ccnTypes.includes('source?: "canonical" | "mock"'), "Challenge type must support mock/canonical classification metadata");

const createStore = read("src/services/create-challenge/create-challenge-store.server.ts");
assert.ok(createStore.includes('return import("node:fs/promises")'), "local filesystem adapter should be lazy-loaded by the create challenge store");
assert.ok(createStore.includes("Production lifecycle persistence must use Supabase/Postgres"), "production challenge store must not silently fall back to filesystem");
assert.ok(!createStore.includes('from "node:fs"'), "create challenge store must not import node:fs at top level");
assert.ok(!createStore.includes('from "node:fs/promises"'), "create challenge store must not import node:fs/promises at top level");

const submissionStore = read("src/services/submissions/submission-store.server.ts");
assert.ok(submissionStore.includes("Production submission persistence must use Supabase/Postgres"), "production submission store must reject filesystem fallback");
const walletStore = read("src/services/circle/wallet-spike-store.server.ts");
assert.ok(walletStore.includes("Production wallet mapping persistence must use Supabase/Postgres"), "production wallet mapping store must reject filesystem fallback");

const envExample = read(".env.example");
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CCN_LIFECYCLE_PERSISTENCE",
  "CCN_SMOKE_TEST_MODE=false",
  "CCN_INCLUDE_STATIC_CHALLENGE_MOCKS=false",
  "NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=false",
  "NEXT_PUBLIC_AUTH_GITHUB_ENABLED=false",
]) {
  assert.ok(envExample.includes(name), `.env.example must document ${name}`);
}
assert.ok(!envExample.match(/SUPABASE_SERVICE_ROLE_KEY=\S+/), ".env.example must not include a service-role value");
assert.ok(!envExample.match(/CIRCLE_API_KEY=\S+/), ".env.example must not include a Circle API key value");

for (const doc of ["PRODUCTION_ENVIRONMENT_CONTRACT.md", "DEPLOYMENT_PREFLIGHT_RUNBOOK.md"]) {
  assert.ok(fs.existsSync(path.join(root, doc)), `${doc} must exist`);
}

const foundationMigration = read("supabase/migrations/20260722133000_creator_foundation_phase1.sql");
const authMigration = read("supabase/migrations/20260728165000_accounts_schema_auth_remediation.sql");
assert.ok(foundationMigration.includes("create table if not exists public.accounts"), "foundation migration must define accounts");
assert.ok(authMigration.includes("to_regclass('public.accounts')"), "auth remediation migration must check existing accounts compatibility");
assert.ok(authMigration.includes("missing required canonical columns"), "auth remediation migration must fail on incompatible existing accounts columns");

const publicEnvNames = [...envExample.matchAll(/^([A-Z0-9_]+)=/gm)].map((match) => match[1]).filter((name) => name.startsWith("NEXT_PUBLIC_"));
assert.ok(!publicEnvNames.some((name) => /SECRET|KEY|TOKEN|PRIVATE|SERVICE_ROLE/.test(name) && name !== "NEXT_PUBLIC_SUPABASE_ANON_KEY"), "public env names must not include server secret names");

console.log(JSON.stringify({
  result: "Sprint 9 production hardening static verification passed",
  internalApiRoutesChecked: internalRouteFiles.length,
  productSubmissionApi: "/api/creator/submissions/*",
  staticMocksProductionDefault: "excluded",
  filesystemFallbackProduction: "rejected",
  environmentContract: true,
  deploymentRunbook: true,
}, null, 2));
