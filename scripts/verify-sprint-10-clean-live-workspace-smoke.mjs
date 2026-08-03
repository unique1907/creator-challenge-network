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

function loadLocalEnv() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

function assertIncludes(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

function assertNoSecrets(label, source) {
  assert.ok(!source.match(/SUPABASE_SERVICE_ROLE_KEY=\S+/), `${label} must not contain a Supabase service-role value`);
  assert.ok(!source.match(/CIRCLE_API_KEY=\S+/), `${label} must not contain a Circle API key value`);
  assert.ok(!source.match(/postgres(ql)?:\/\/[^ \n]+/i), `${label} must not contain a database URL`);
  assert.ok(!source.match(/\b(userToken|encryptionKey|mnemonic|PRIVATE_KEY|PIN|JWT|cookie)\s*[:=]\s*\S+/i), `${label} must not contain token or signing material values`);
}

async function jsonRpc(method, params = []) {
  const response = await fetch("https://rpc.testnet.arc.network", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await response.json();
  if (body.error) throw new Error(`${method} failed: ${body.error.message ?? body.error.code}`);
  return body.result;
}

async function runReadOnlyLive() {
  const env = { ...loadLocalEnv(), ...process.env };
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CCN_LIFECYCLE_PERSISTENCE",
    "CIRCLE_API_KEY",
    "NEXT_PUBLIC_CIRCLE_APP_ID",
    "CCN_ESCROW_CONTRACT_ADDRESS",
    "CCN_PAYOUT_TREASURY_ADDRESS",
    "CCN_PAYOUT_WALLET_ADDRESS",
  ];
  const missing = required.filter((name) => !env[name]);
  assert.deepEqual(missing, [], `read-only verification missing required env names: ${missing.join(", ")}`);
  assert.equal(env.CCN_LIFECYCLE_PERSISTENCE, "supabase", "live smoke requires Supabase persistence");

  const supabaseHeaders = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
  const accountsResponse = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/accounts?select=account_id,is_brand,is_creator,status&limit=1000`, {
    headers: supabaseHeaders,
  });
  assert.ok(accountsResponse.ok, `accounts read failed with HTTP ${accountsResponse.status}`);
  const accounts = await accountsResponse.json();
  const brandCount = accounts.filter((account) => account.is_brand === true && account.status === "ACTIVE").length;
  const creatorCount = accounts.filter((account) => account.is_creator === true && account.status === "ACTIVE").length;

  const mappingsResponse = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/ccn_wallet_mappings?select=role,purpose,wallet_address,blockchain,account_type,wallet_state&limit=1000`, {
    headers: supabaseHeaders,
  });
  assert.ok(mappingsResponse.ok, `wallet mappings read failed with HTTP ${mappingsResponse.status}`);
  const mappings = await mappingsResponse.json();
  const paymentMappings = mappings.filter((mapping) => mapping.role === "BRAND" && mapping.purpose === "PAYMENT");
  const payoutMappings = mappings.filter((mapping) => mapping.purpose === "PAYOUT");

  const circleResponse = await fetch("https://api.circle.com/v1/w3s/config/entity/publicKey", {
    headers: { authorization: `Bearer ${env.CIRCLE_API_KEY}` },
  });
  assert.ok(circleResponse.ok, `Circle public key preflight failed with HTTP ${circleResponse.status}`);

  const chainIdHex = await jsonRpc("eth_chainId");
  const chainId = Number.parseInt(chainIdHex, 16);
  assert.equal(chainId, 5_042_002, "Arc RPC must be Arc Testnet");
  const code = await jsonRpc("eth_getCode", [env.CCN_ESCROW_CONTRACT_ADDRESS, "latest"]);
  assert.notEqual(code, "0x", "configured escrow must have bytecode");

  return {
    mode: "read-only-live",
    accountCounts: { total: accounts.length, brand: brandCount, creator: creatorCount },
    walletMappings: { payment: paymentMappings.length, payout: payoutMappings.length },
    circlePublicKeyEndpoint: "ok",
    arc: {
      chainId,
      escrowBytecode: "present",
    },
  };
}

for (const file of [
  "SPRINT_10_CLEAN_LIVE_WORKSPACE_SMOKE_REPORT.md",
  "SPRINT_10_LIVE_OPERATION_CHECKLIST.md",
  "SPRINT_10_SMOKE_EVIDENCE_INDEX.md",
  "SPRINT_10_OPERATOR_RUNBOOK.md",
]) {
  assert.ok(exists(file), `${file} must exist`);
  assertNoSecrets(file, read(file));
}

const packageJson = JSON.parse(read("package.json"));
assert.equal(
  packageJson.scripts["test:sprint-10-clean-live-workspace-smoke"],
  "node scripts/verify-sprint-10-clean-live-workspace-smoke.mjs",
  "package script must expose Sprint 10 verifier",
);

const report = read("SPRINT_10_CLEAN_LIVE_WORKSPACE_SMOKE_REPORT.md");
const checklist = read("SPRINT_10_LIVE_OPERATION_CHECKLIST.md");
const runbook = read("SPRINT_10_OPERATOR_RUNBOOK.md");

for (const token of [
  "Clean Live Workspace Smoke",
  "Supabase Auth",
  "Brand Workspace",
  "Creator Workspace",
  "Circle Hosted Wallets",
  "Arc Testnet",
  "CCNEscrow",
  "No UI Redesign",
  "No Contract/Role/Deployment Change",
]) {
  assertIncludes(report + checklist + runbook, token, `Sprint 10 docs must cover ${token}`);
}

for (const forbidden of ["/api/internal/submissions", "CCN_AUTH_TEST_MODE=true", "CCN_INCLUDE_STATIC_CHALLENGE_MOCKS=true"]) {
  assert.ok(!report.includes(forbidden), `Sprint 10 report must not recommend forbidden path ${forbidden}`);
}

let live = null;
if (process.env.CCN_SPRINT10_READ_ONLY_VERIFY === "true") {
  live = await runReadOnlyLive();
}

console.log(JSON.stringify({
  result: "Sprint 10 clean live workspace smoke verifier passed",
  defaultMode: "static-read-only",
  liveMode: live ?? "not requested",
  sideEffects: "none",
}, null, 2));
