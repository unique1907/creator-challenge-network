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

const report = read("P0_PUBLIC_HOMEPAGE_LIVE_CHALLENGES_ZERO_RESULTS_DIAGNOSTIC.md");
const projection = read("src/services/create-challenge/published-challenge.server.ts");
const page = read("src/app/page.tsx");
const card = read("src/features/landing/components/landing-challenge-card.tsx");
const packageJson = read("package.json");

for (const title of [
  "Increase Customer Traffic to Our First Coffee Shop",
  "Deneme 1",
  "Deneme 2",
  "Deneme 3",
  "Deneme 4",
  "Deneme 5",
]) {
  includes(report, title, `Diagnostic report must include current record: ${title}`);
}

for (const required of [
  "canonical lifecycle `completed` is not `open`",
  "canonical lifecycle `reviewing` is not `open`",
  "submission deadline expired",
  "editorially excluded internal/test title",
  "No projection/filter bug was found",
  "NO ELIGIBLE LIVE RECORD EXISTS — PRODUCT STATE ACTION REQUIRED",
]) {
  includes(report, required, `Diagnostic report must include concrete reason: ${required}`);
}

includes(report, "| Challenge | Lifecycle | Funded | Escrow Verified | Public | Deadline | Accepting Submissions | Editorially Allowed | Final Eligible | Exclusion Reason |", "Diagnostic report must include the required table.");
includes(report, "listLiveHomepageChallenges()", "Diagnostic report must identify the homepage live-grid source.");
includes(report, "listFeaturedHomepageChallenges()", "Diagnostic report must identify the separate featured source.");
includes(report, "No challenge records were mutated", "Diagnostic must confirm no record mutation.");
includes(report, "No funding, publishing, payout, Circle, or Arc state-changing action was executed", "Diagnostic must confirm no state-changing action.");

includes(projection, "challenge.status === \"open\"", "Live grid must still require canonical open lifecycle.");
includes(projection, "!challenge.submissionClosed", "Live grid must still exclude expired/closed records.");
includes(projection, "!isInternalTestTitle(challenge.title)", "Editorial title filtering must remain separate from lifecycle eligibility.");
includes(projection, "HOMEPAGE_LIVE_CHALLENGE_LIMIT = 12", "Live grid must define the locked 12-card public cap.");
includes(projection, ".slice(0, HOMEPAGE_LIVE_CHALLENGE_LIMIT)", "Live grid must cap public cards through the named homepage limit.");
includes(projection, "draft.deployment.publicationStatus === \"live\"", "Public projection must still require live publication.");
includes(projection, "draft.funding.escrowStatus === \"verified\"", "Public projection must still require verified escrow.");
excludes(projection, "status: \"live\"", "No canonical LIVE lifecycle value may be introduced.");

includes(page, "listLiveHomepageChallenges()", "Homepage must still use live-grid projection.");
includes(page, "Promise.allSettled", "Homepage must distinguish query failure from successful zero live records.");
excludes(page, "listLiveHomepageChallenges().catch(() => [])", "Homepage must not silently convert live-grid projection failures into empty data.");
includes(card, "LIVE", "Card must keep LIVE as presentation label only.");
includes(card, "View Challenge", "Card must keep safe public CTA.");
excludes(card, "Sample brand", "No fake card may be introduced.");

includes(packageJson, "test:p0-public-homepage-live-challenges-zero-results-diagnostic", "Zero-results diagnostic verifier must be registered.");

console.log("P0 public homepage live challenges zero-results diagnostic verifier passed.");
