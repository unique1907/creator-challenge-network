import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return readFileSync(path, "utf8").split(/\r?\n/).reduce((env, line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) return env;
    env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
    return env;
  }, {});
}

const env = { ...readEnvFile(".env.local"), ...process.env };
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;

assert.ok(supabaseUrl, "Supabase URL is required for real runtime ownership verification.");
assert.ok(serviceKey, "Supabase service key is required for read-only runtime ownership verification.");

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const targetTitles = [
  "Demo Walmart: Improve In-Store Shopping Experience",
  "Demo Uber: Increase Airport Ride Bookings",
];

const { data: brandAccounts, error: accountError } = await supabase
  .from("accounts")
  .select("account_id,supabase_user_id,primary_email,display_name,brand_name,is_brand,is_creator,status")
  .eq("is_brand", true)
  .eq("status", "ACTIVE");
assert.ifError(accountError);
assert.ok(brandAccounts?.length, "At least one active Brand account must exist.");

const currentBrand = brandAccounts.find((account) => account.primary_email === "unique120884@gmail.com") ?? brandAccounts[0];
assert.ok(currentBrand?.account_id, "Current Brand account projection must expose account_id.");

const [draftsResult, fundingResult] = await Promise.all([
  supabase.from("ccn_challenge_drafts").select("draft_id,challenge_id,title,brand_name,publication_status,funding_status,escrow_status,event_verified,draft_state,created_at,updated_at"),
  supabase.from("ccn_challenge_funding_records").select("record_key,ccn_account_id,draft_id,challenge_id,funding_verified,event_verified,published,record_state"),
]);
assert.ifError(draftsResult.error);
assert.ifError(fundingResult.error);

const drafts = draftsResult.data ?? [];
const fundingRecords = fundingResult.data ?? [];
const allowedDraftIds = new Set(
  fundingRecords
    .map((row) => row.record_state)
    .filter((record) => record?.ccnAccountId === currentBrand.account_id)
    .map((record) => record.draftId),
);

const brandSourceRows = drafts
  .map((row) => ({
    rowDraftId: row.draft_id,
    objectDraftId: row.draft_state?.challenge?.id,
    challengeId: row.challenge_id,
    title: row.title,
    publishedAt: row.draft_state?.deployment?.publishedAt ?? null,
    publicationStatus: row.publication_status,
    fundingStatus: row.funding_status,
    escrowStatus: row.escrow_status,
    eventVerified: row.event_verified,
    submissionDeadline: row.draft_state?.reviewRules?.submissionDeadline ?? null,
  }))
  .filter((row) => allowedDraftIds.has(row.objectDraftId || ""));

const targetRows = targetTitles.map((title) => {
  const row = brandSourceRows.find((candidate) => candidate.title === title);
  assert.ok(row, `${title} must be present in the Brand source rows before bucket mapping.`);
  assert.equal(row.publicationStatus, "live", `${title} must be public/live.`);
  assert.equal(row.fundingStatus, "live", `${title} must be funded/live.`);
  assert.equal(row.escrowStatus, "verified", `${title} must be escrow verified.`);
  assert.equal(row.eventVerified, true, `${title} must be event verified.`);
  return row;
});

const otherBrandAllowedDraftIds = new Set(
  fundingRecords
    .map((row) => row.record_state)
    .filter((record) => record?.ccnAccountId === "not-the-current-brand-account")
    .map((record) => record.draftId),
);
const otherBrandRows = drafts.filter((row) => otherBrandAllowedDraftIds.has(row.draft_state?.challenge?.id || ""));
assert.equal(otherBrandRows.length, 0, "Unrelated Brand account must not see current Brand rows.");

console.log(JSON.stringify({
  result: "P0 real runtime Brand ownership/query verification passed",
  brandAccountId: currentBrand.account_id,
  sourceRowsBeforeBuckets: brandSourceRows.length,
  targets: targetRows.map((row) => ({
    title: row.title,
    draftId: row.rowDraftId,
    challengeId: row.challengeId,
    publicationStatus: row.publicationStatus,
    fundingStatus: row.fundingStatus,
  })),
}, null, 2));
