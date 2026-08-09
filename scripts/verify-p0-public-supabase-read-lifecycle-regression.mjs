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

const page = read("src/app/page.tsx");
const landing = read("src/features/landing/components/final-landing-page.tsx");
const projection = read("src/services/create-challenge/published-challenge.server.ts");
const packageJson = read("package.json");

includes(page, "Promise.allSettled", "Public homepage must keep data-source failures distinct from successful empty results.");
includes(page, "liveHomepageStatus", "Public homepage must compute a live challenge load status.");
includes(page, "liveHomepageChallengesResult.status === \"fulfilled\" ? liveHomepageChallengesResult.value : []", "Successful query results may render their actual rows, including zero eligible rows.");
includes(page, "liveHomepageChallengesResult.status === \"fulfilled\" ? \"ready\" : \"error\"", "Thrown live query failures must become an error status, not a normal empty dataset.");
excludes(page, "listLiveHomepageChallenges().catch(() => [])", "Live challenge query failures must not be swallowed as empty data.");
includes(page, "console.error(\"[ccn-public-homepage] Live challenge projection failed.\"", "Server-side diagnostic logging must exist for public live projection failures.");

includes(landing, "liveHomepageStatus?: \"ready\" | \"error\"", "Landing page must accept the live data-source status.");
includes(landing, "liveHomepageStatus === \"error\"", "Landing page must branch on data-source failure.");
includes(landing, "Live challenges are temporarily unavailable", "Data-source failure must render a compact safe fallback.");
includes(landing, "No live Business Challenges yet", "Successful zero eligible rows must keep the truthful empty state.");

includes(projection, "countSubmittedEntriesForChallenge(challengeId)", "Public projection must preserve real submitted solution counts.");
excludes(projection, "submissionCount > 0", "Submitted solution count must not move before-deadline challenges into reviewing.");
includes(projection, "Date.now() >= deadline.unix * 1000", "Canonical submissionDeadline must control closure into reviewing.");
includes(projection, "challenge.status === \"open\"", "Homepage live eligibility must still require accepting-proposals/open status.");
includes(projection, "!challenge.submissionClosed", "Homepage live eligibility must still exclude expired submissions.");
excludes(projection, "reviewDeadline", "reviewDeadline must not rescue an expired submissionDeadline.");
includes(projection, ".filter((challenge) =>", "Homepage live eligibility must filter before sorting and limiting.");
includes(projection, ".sort((a, b) =>", "Homepage live records must sort after eligibility filtering.");
includes(projection, ".slice(0, HOMEPAGE_LIVE_CHALLENGE_LIMIT)", "Homepage live records must limit after filtering/sorting.");
assert.ok(
  projection.indexOf(".filter((challenge) =>") < projection.indexOf(".sort((a, b) =>") &&
    projection.indexOf(".sort((a, b) =>") < projection.indexOf(".slice(0, HOMEPAGE_LIVE_CHALLENGE_LIMIT)"),
  "Eligibility filtering must occur before newest-12 limiting.",
);
includes(projection, "HOMEPAGE_LIVE_CHALLENGE_LIMIT = 12", "Newest-12 public homepage maximum must remain locked.");
includes(projection, "b.publishedAt", "Newest-12 ordering must remain publication timestamp based.");

includes(packageJson, "test:p0-public-supabase-read-lifecycle-regression", "Focused P0 regression verifier must be registered.");

console.log("P0 public Supabase read and lifecycle regression verifier passed.");
