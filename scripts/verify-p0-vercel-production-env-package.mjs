import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.production.vercel");

const requiredKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "CIRCLE_API_KEY",
  "NEXT_PUBLIC_CIRCLE_APP_ID",
  "CCN_PAYOUT_ACCOUNT_ID",
  "CCN_PAYOUT_WALLET_ID",
  "CCN_PAYOUT_WALLET_ADDRESS",
  "CCN_PAYOUT_TREASURY_ADDRESS",
  "CCN_ESCROW_CONTRACT_ADDRESS",
  "CCN_DEPLOYMENT_ENV",
  "CCN_LIFECYCLE_PERSISTENCE",
  "CCN_SMOKE_TEST_MODE",
  "CCN_ENABLE_SHORT_SMOKE_WINDOWS",
  "CCN_AUTH_TEST_MODE",
  "CCN_INCLUDE_STATIC_CHALLENGE_MOCKS",
  "NEXT_PUBLIC_AUTH_GOOGLE_ENABLED",
  "NEXT_PUBLIC_AUTH_GITHUB_ENABLED",
  "NEXT_PUBLIC_AUTH_EMAIL_OTP_ENABLED",
  "CCN_CREATOR_PROFILE_DIAGNOSTICS",
  "CCN_CREATOR_ELIGIBILITY_DIAGNOSTICS",
];

const falseKeys = [
  "CCN_SMOKE_TEST_MODE",
  "CCN_ENABLE_SHORT_SMOKE_WINDOWS",
  "CCN_AUTH_TEST_MODE",
  "CCN_INCLUDE_STATIC_CHALLENGE_MOCKS",
  "NEXT_PUBLIC_AUTH_GOOGLE_ENABLED",
  "NEXT_PUBLIC_AUTH_GITHUB_ENABLED",
  "NEXT_PUBLIC_AUTH_EMAIL_OTP_ENABLED",
  "CCN_CREATOR_PROFILE_DIAGNOSTICS",
  "CCN_CREATOR_ELIGIBILITY_DIAGNOSTICS",
];

const secretKeys = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CIRCLE_API_KEY",
];

function parseEnvFile(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const entries = [];
  for (const [index, line] of lines.entries()) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    assert.ok(line.includes("="), `line ${index + 1} must be KEY=value`);
    assert.ok(!line.startsWith("export "), `line ${index + 1} must not use export syntax`);
    const [key, ...rest] = line.split("=");
    const value = rest.join("=");
    assert.match(key, /^[A-Z0-9_]+$/, `line ${index + 1} key must be uppercase env syntax`);
    entries.push({ key, value });
  }
  return entries;
}

function trackedFiles() {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
}

assert.ok(fs.existsSync(envPath), ".env.production.vercel must exist");

const entries = parseEnvFile(envPath);
const keys = entries.map((entry) => entry.key);
const values = new Map(entries.map((entry) => [entry.key, entry.value]));
const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
assert.deepEqual([...new Set(duplicates)], [], "env file must not contain duplicate keys");

for (const key of requiredKeys) {
  assert.ok(values.has(key), `${key} must exist`);
  assert.ok(values.get(key)?.trim(), `${key} must not be blank`);
}

for (const key of falseKeys) {
  assert.equal(values.get(key), "false", `${key} must be false`);
}

assert.equal(values.get("CCN_DEPLOYMENT_ENV"), "production", "deployment env must be production");
assert.equal(values.get("CCN_LIFECYCLE_PERSISTENCE"), "supabase", "persistence must be supabase");
assert.equal(values.get("NEXT_PUBLIC_SITE_URL"), "https://creator-challenge-network.vercel.app", "site URL must be the approved HTTPS Vercel URL");

const serialized = fs.readFileSync(envPath, "utf8");
assert.ok(!/localhost|127\.0\.0\.1/i.test(serialized), "env package must not include localhost or 127.0.0.1");
assert.ok(!/\.local(\/|\\|$)/i.test(serialized), "env package must not include .local paths");
assert.ok(!/\b(CHANGEME|TODO|REPLACE_ME|PLACEHOLDER)\b/i.test(serialized), "env package must not include placeholder values");
assert.ok(!/MAINNET/i.test(serialized), "env package must not claim mainnet configuration");
assert.ok(serialized.includes("CCN_DEPLOYMENT_ENV=production"), "production deployment contract must be explicit");

const ignored = execFileSync("git", ["check-ignore", ".env.production.vercel"], {
  cwd: root,
  encoding: "utf8",
}).trim();
assert.equal(ignored, ".env.production.vercel", ".env.production.vercel must be gitignored");

const files = trackedFiles()
  .filter((file) => !file.endsWith(".lock"))
  .filter((file) => !file.endsWith("package-lock.json"));
for (const key of secretKeys) {
  const value = values.get(key);
  assert.ok(value, `${key} must be present for secret exposure scan`);
  const exposedIn = [];
  for (const file of files) {
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute) || fs.statSync(absolute).isDirectory()) continue;
    const content = fs.readFileSync(absolute, "utf8");
    if (content.includes(value)) exposedIn.push(file);
  }
  assert.deepEqual(exposedIn, [], `${key} value must not appear in tracked files`);
}

const status = Object.fromEntries(requiredKeys.map((key) => [key, "present"]));
console.log(JSON.stringify({
  result: "P0 Vercel production env package verification passed",
  file: ".env.production.vercel",
  gitignored: true,
  requiredKeyStatus: status,
  disabledFlags: Object.fromEntries(falseKeys.map((key) => [key, "false"])),
  arcRuntime: "ARC-TESTNET",
}, null, 2));
