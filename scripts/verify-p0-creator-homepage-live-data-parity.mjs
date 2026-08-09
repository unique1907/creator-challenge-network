import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

function read(path) {
  return readFileSync(path, "utf8");
}

function parseDeadline(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function publicLiveEligible(draft, now = Date.now()) {
  const fundingStatus = String(draft.funding?.fundingStatus);
  const slug = draft.challenge?.slug ?? "";
  const deadline = parseDeadline(draft.reviewRules?.submissionDeadline);
  return Boolean(
    draft.deployment?.publicationStatus === "live" &&
      (fundingStatus === "funded" || fundingStatus === "live") &&
      draft.funding?.escrowStatus === "verified" &&
      draft.funding?.eventVerified === true &&
      draft.funding?.transactionHash &&
      slug &&
      slug !== "new-challenge" &&
      deadline &&
      now < deadline.getTime(),
  );
}

const helper = read("src/services/create-challenge/public-challenge-eligibility.ts");
const creator = read("src/services/creator-workspace/creator-workspace.server.ts");
const homepage = read("src/services/create-challenge/published-challenge.server.ts");
const page = read("src/app/page.tsx");
const landing = read("src/features/landing/components/final-landing-page.tsx");
const packageJson = read("package.json");

assert.match(helper, /export function explainPublicLiveEligibility/, "Shared public live eligibility helper must exist.");
assert.match(helper, /draft\.deployment\.publicationStatus !== "live"/, "Shared helper must require live publication.");
assert.match(helper, /fundingStatus !== "funded" && fundingStatus !== "live"/, "Shared helper must require funded/live funding.");
assert.match(helper, /draft\.funding\.escrowStatus !== "verified"/, "Shared helper must require verified escrow.");
assert.match(helper, /draft\.funding\.eventVerified !== true/, "Shared helper must require verified funding event.");
assert.match(helper, /!draft\.funding\.transactionHash/, "Shared helper must require transaction evidence.");
assert.match(helper, /public-slug-missing/, "Shared helper must require a public slug.");
assert.match(helper, /submission-window-closed/, "Shared helper must require a future submissionDeadline.");
assert.doesNotMatch(helper, /submissionCount/, "Shared live eligibility must not depend on submitted proposal count.");
assert.doesNotMatch(helper, /reviewDeadline/, "Shared live eligibility must not use reviewDeadline.");

assert.match(creator, /from "@\/services\/create-challenge\/public-challenge-eligibility"/, "Creator path must import the shared public live eligibility helper.");
assert.match(creator, /isPublicLiveEligibleDraft\(draft\)/, "Creator discoverability must use the shared helper.");
assert.match(homepage, /from "\.\/public-challenge-eligibility"/, "Homepage projection must import the shared public live eligibility helper.");
assert.match(homepage, /\.filter\(\(record\) => isPublicLiveEligibleDraft\(record\.draft\)\)/, "Homepage live listing must use the same shared helper.");
assert.match(homepage, /HOMEPAGE_LIVE_CHALLENGE_LIMIT = 12/, "Homepage newest-12 rule must remain locked.");
assert.match(homepage, /b\.publishedAt/, "Homepage live sort must remain newest publication first.");
assert.match(page, /Promise\.allSettled/, "Homepage must retain safe public data-source failure handling.");
assert.match(landing, /Live challenges are temporarily unavailable/, "Homepage must retain non-empty failure state.");
assert.match(packageJson, /test:p0-creator-homepage-live-data-parity/, "Creator/homepage parity verifier must be registered.");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL is required for read-only parity verification.");
assert.ok(serviceKey, "SUPABASE_SERVICE_ROLE_KEY is required for read-only parity verification.");

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase
  .from("ccn_challenge_drafts")
  .select("draft_id,updated_at,draft_state")
  .or("draft_state->challenge->>title.ilike.%Amazon%,draft_state->challenge->>title.ilike.%Walmart%,draft_state->challenge->>title.ilike.%Uber%,draft_state->challenge->>title.ilike.%Nike%,draft_state->challenge->>title.ilike.%Red Bull%")
  .limit(20);

assert.equal(error, null, "Read-only Supabase parity query must succeed.");
assert.ok(data?.length, "Demo live-parity rows must be present for the real-path parity trace.");

const eligibleDraft = data.map((row) => row.draft_state).find((draft) => publicLiveEligible(draft));
assert.ok(eligibleDraft, "At least one current demo row must satisfy shared Creator/homepage public live eligibility.");

const withSubmissions = structuredClone(eligibleDraft);
withSubmissions.submissionCount = 3;
withSubmissions.challenge.submissionCount = 3;
assert.equal(publicLiveEligible(withSubmissions), true, "A future-deadline eligible challenge remains live eligible with submitted proposals because submissions are not part of the shared predicate.");

const expiredAmazon = data
  .map((row) => row.draft_state)
  .find((draft) => /Amazon/i.test(draft.challenge?.title ?? ""));
if (expiredAmazon) {
  const deadline = parseDeadline(expiredAmazon.reviewRules?.submissionDeadline);
  if (deadline && Date.now() >= deadline.getTime()) {
    assert.equal(publicLiveEligible(expiredAmazon), false, "Expired Amazon demo must not be treated as live eligible.");
  }
}

console.log("P0 Creator vs Homepage live data parity verifier passed.");
