import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

function excludes(source, needle, message) {
  assert.equal(source.includes(needle), false, message);
}

const projection = read("src/services/create-challenge/published-challenge.server.ts");
const publicEligibility = read("src/services/create-challenge/public-challenge-eligibility.ts");
const store = read("src/services/create-challenge/create-challenge-store.server.ts");
const funding = read("src/services/create-challenge/create-challenge-funding.server.ts");
const types = read("src/types/create-challenge.ts");
const ccnTypes = read("src/types/ccn.ts");
const countdown = read("src/features/landing/lib/deadline-countdown.ts");

includes(projection, "draft.deployment.publicationStatus === \"live\"", "Public eligibility must require canonical live publication.");
includes(projection, "fundingStatus === \"funded\" || fundingStatus === \"live\"", "Funded/live funding states must be eligible only after filtering.");
includes(projection, "draft.funding.escrowStatus === \"verified\"", "Escrow verification must remain required.");
includes(projection, "draft.funding.eventVerified", "Funding event verification must remain required.");
includes(projection, "draft.funding.transactionHash", "Real funding transaction evidence must remain required.");
includes(projection, "const submissionDeadline = parseChallengeDeadline(draft.reviewRules.submissionDeadline)", "Public projection must parse canonical submissionDeadline.");
includes(projection, "deadline: submissionDeadline?.iso ?? draft.reviewRules.submissionDeadline", "Public projection must preserve canonical submissionDeadline.");
includes(publicEligibility, "now >= deadline.unix * 1000", "Lifecycle derivation must close submissions at canonical submissionDeadline.");
includes(projection, "submissionClosed: !classification.acceptsSubmissions || Boolean(submissionDeadline && Date.now() >= submissionDeadline.unix * 1000)", "Public challenge must expose closed state from canonical lifecycle/deadline.");
includes(publicEligibility, "submittedCount < configuredWinnerCount", "Submitted proposals must reach the configured winner count before review after the submission deadline closes.");
includes(projection, "challenge.status === \"open\"", "Homepage live section must exclude evaluation/selection/settlement/completed records.");
includes(projection, "!challenge.submissionClosed", "Homepage live section must exclude expired submission deadlines.");
includes(projection, ".filter((challenge) =>", "Homepage live section must filter before sorting and limiting.");
includes(projection, ".sort((a, b) =>", "Homepage live section must sort after filtering.");
includes(projection, ".slice(0, HOMEPAGE_LIVE_CHALLENGE_LIMIT)", "Homepage live section must limit after filtering and sorting.");
assert.ok(
  projection.indexOf(".filter((challenge) =>") < projection.indexOf(".sort((a, b) =>") &&
    projection.indexOf(".sort((a, b) =>") < projection.indexOf(".slice(0, HOMEPAGE_LIVE_CHALLENGE_LIMIT)"),
  "Homepage live filtering must occur before newest-12 limiting.",
);
includes(projection, "HOMEPAGE_LIVE_CHALLENGE_LIMIT = 12", "Homepage live limit must be 12.");
includes(projection, "b.publishedAt", "Homepage live ordering must use newest publication timestamp first.");
includes(projection, "return b.slug.localeCompare(a.slug)", "Homepage live ordering must use deterministic secondary sort.");
excludes(projection, "reviewDeadline", "Homepage public live eligibility must not be based on reviewDeadline.");
excludes(projection, "status: \"live\"", "LIVE must not be introduced as a canonical lifecycle state.");

includes(types, "publishedAt?: string", "Create Challenge deployment metadata must support canonical publication timestamp.");
includes(ccnTypes, "publishedAt?: string", "Public Challenge projection must preserve publication timestamp.");
includes(store, "draft_id,updated_at,draft_state", "Supabase draft reads must include row updated_at for existing live publication timestamp backfill.");
includes(store, "publishedAt: row.updated_at as string", "Existing live rows must recover publication timestamp from canonical Supabase updated_at.");
includes(funding, "publishedAt = new Date().toISOString()", "Future successful publish must set canonical publication timestamp.");
includes(funding, "publicationStatus: \"live\", publishedAt", "Publish patch must persist publication timestamp with live status.");
includes(countdown, "Date.parse(deadline)", "Countdown must continue to parse the canonical submissionDeadline directly.");

console.log("P0 public manual challenge eligibility verifier passed.");
