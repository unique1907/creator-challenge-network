import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

function read(path) {
  return readFileSync(path, "utf8");
}

function credentialType(value) {
  if (typeof value !== "string" || !value) return "missing";
  if (value.startsWith("sb_secret_")) return "sb_secret";
  if (value.split(".").length === 3) return "legacy_jwt";
  return "unknown";
}

const adminHelper = read("src/services/supabase/admin.server.ts");
const page = read("src/app/page.tsx");
const landing = read("src/features/landing/components/final-landing-page.tsx");
const projection = read("src/services/create-challenge/published-challenge.server.ts");

assert.match(adminHelper, /createClient\(supabaseUrl\(\), serviceRoleKey\(\)/, "Admin helper must use official Supabase client construction.");
assert.doesNotMatch(adminHelper, /jwt|decode|atob|split\(["']\\.["']\)|startsWith\(["']sb_/, "Admin helper must not parse, decode, or reject modern sb_secret credentials.");
assert.match(page, /Promise\.allSettled/, "Homepage must distinguish public data-source failure from successful empty results.");
assert.doesNotMatch(page, /listLiveHomepageChallenges\(\)\.catch\(\(\) => \[\]\)/, "Homepage must not treat live projection failures as normal empty data.");
assert.match(landing, /Live challenges are temporarily unavailable/, "Homepage must render a safe compact failure state.");
assert.doesNotMatch(projection, /submissionCount > 0/, "Submitted proposals must not prematurely close public LIVE eligibility.");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL is required for read-only compatibility verification.");
assert.ok(serviceKey, "SUPABASE_SERVICE_ROLE_KEY is required for read-only compatibility verification.");

const type = credentialType(serviceKey);
assert.notEqual(type, "unknown", "SUPABASE_SERVICE_ROLE_KEY must be a recognized legacy_jwt or sb_secret credential.");

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const { data, error } = await supabase
  .from("ccn_challenge_drafts")
  .select("draft_id", { count: "exact" })
  .limit(1);

assert.equal(error, null, `Supabase read path must support ${type} credentials without PostgREST JWT errors.`);
assert.ok(Array.isArray(data), "Supabase read path must return an array result.");

console.log(`P0 Supabase modern secret-key compatibility verifier passed with credential type: ${type}.`);
