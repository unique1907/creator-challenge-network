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
const card = read("src/features/landing/components/landing-challenge-card.tsx");
const countdown = read("src/features/landing/components/deadline-countdown.tsx");
const countdownUtil = read("src/features/landing/lib/deadline-countdown.ts");
const projection = read("src/services/create-challenge/published-challenge.server.ts");
const packageJson = read("package.json");

includes(page, "listLiveHomepageChallenges()", "Homepage must load the live grid from the real public live challenge source.");
includes(page, "Promise.allSettled", "Homepage must preserve data-source failure state instead of converting failures into empty live data.");
excludes(page, "listLiveHomepageChallenges().catch(() => [])", "Live challenge projection failures must not be treated as a normal empty list.");
includes(page, "liveHomepageChallenges={liveHomepageChallenges}", "Homepage must pass the live grid separately from the Featured Challenge list.");
includes(page, "liveHomepageStatus={liveHomepageStatus}", "Homepage must pass live data-source status separately from challenge records.");
includes(landing, "liveHomepageChallenges?: Challenge[]", "Landing component must accept a dedicated live challenge grid list.");
includes(landing, "liveHomepageStatus?: \"ready\" | \"error\"", "Landing component must distinguish a query failure from a successful empty result.");
includes(landing, "const featuredList = featuredChallenges ?? []", "Featured Challenge selection must remain separate.");
includes(landing, "const liveChallenges = liveHomepageChallenges ?? []", "Live grid must use the dedicated live challenge list.");
includes(landing, "xl:grid-cols-4", "Desktop grid must support exactly four columns.");
includes(landing, "sm:grid-cols-2", "Tablet grid must support two columns.");
includes(landing, "liveChallenges.map", "Grid must render real live challenge records only.");
excludes(landing, "Have a business problem to solve?", "Promotional CTA card must be absent from the challenge grid.");
excludes(landing, "Start a Challenge</", "Promotional Start a Challenge card must not be inside the challenge grid.");
includes(landing, "Live challenges are temporarily unavailable", "Data-source failures must render a compact safe unavailable state.");
includes(landing, "No live Business Challenges yet", "Successful zero-result queries must keep the truthful empty state.");

includes(projection, "export async function listLiveHomepageChallenges()", "A dedicated public live homepage source must exist.");
includes(projection, "listPublishedCreateChallenges()", "Live homepage source must reuse the canonical public projection.");
includes(projection, "challenge.status === \"open\"", "Live homepage source must exclude Evaluation, Selection, Settlement, and Completed records.");
includes(projection, "!challenge.submissionClosed", "Live homepage source must exclude expired/closed submissions.");
includes(projection, "!isInternalTestTitle(challenge.title)", "Live homepage source must exclude internal test titles.");
includes(projection, "HOMEPAGE_LIVE_CHALLENGE_LIMIT = 12", "Homepage live grid limit must be named and set to 12.");
includes(projection, "b.publishedAt", "Live homepage source must sort newest publication first.");
includes(projection, "return b.slug.localeCompare(a.slug)", "Live homepage source must use a deterministic secondary sort.");
includes(projection, ".slice(0, HOMEPAGE_LIVE_CHALLENGE_LIMIT)", "Homepage live grid must render a maximum of 12 records.");
excludes(projection, ".slice(0, 8)", "Homepage live grid must not keep the old 8-record limit.");
excludes(projection, "a.deadline.localeCompare(b.deadline)", "Live homepage source must not sort primarily by deadline.");
includes(projection, "draft.deployment.publicationStatus === \"live\"", "Public eligibility must require live publication.");
includes(projection, "fundingStatus === \"funded\" || fundingStatus === \"live\"", "Public eligibility must require funded state.");
includes(projection, "draft.funding.escrowStatus === \"verified\"", "Public eligibility must require verified escrow.");
includes(projection, "draft.funding.eventVerified", "Public eligibility must require verified funding event.");
includes(projection, "draft.funding.transactionHash", "Public eligibility must require real funding transaction evidence.");
includes(projection, "publishedAt: draft.deployment.publishedAt ?? draft.updatedAt", "Public projection must preserve canonical publication timestamp.");
excludes(projection, "status: \"live\"", "LIVE must not be introduced as a canonical lifecycle value.");

includes(card, "LIVE", "Every rendered live grid card must visibly use the LIVE presentation label.");
excludes(card, "challenge.publicStatusLabel", "Live grid cards must not display mixed lifecycle labels.");
excludes(card, "Open for Solutions", "Live grid cards must not display Open for Solutions.");
excludes(card, "Evaluation", "Live grid cards must not display Evaluation.");
excludes(card, "Selection", "Live grid cards must not display Selection.");
excludes(card, "Completed", "Live grid cards must not display Completed.");
includes(card, "formatUsdc(challenge.rewardUsdc)", "Reward metadata must use real challenge reward data.");
includes(card, "solutionLabel(challenge.submissions)", "Solution metadata must use real submitted count.");
includes(card, '<DeadlineCountdown deadline={challenge.deadline} initialNowIso={currentTimeIso} />', "Remaining time must derive from the real deadline.");
includes(countdown, "remainingDeadlineDurationLabel(deadline, nowIso)", "Countdown component must use the shared real-deadline formatter.");
includes(countdownUtil, "Date.parse(deadline)", "Countdown utility must parse the canonical deadline directly.");
excludes(card, "formatDeadline", "Live grid cards must not use long full-date metadata.");
includes(card, "href={`/challenges/${challenge.slug}`}", "CTA must use the safe public challenge route.");
includes(card, "View Challenge", "CTA label must be exactly View Challenge.");
excludes(card, "/dashboard/challenges", "CTA must not expose private Brand workspace routes.");
excludes(card, "#review", "CTA must not expose private review tabs.");
excludes(card, "#settlement", "CTA must not expose private payout controls.");
includes(card, "max-h-[120px]", "Cover image height must use compact sizing.");
includes(card, "aspect-[16/7]", "Cover image must use a compact landscape aspect ratio.");
includes(card, "p-3.5", "Card body padding must be compact.");
includes(card, "text-[14px] font-semibold", "Card title must use compact typography.");
includes(card, "text-[11px]", "Card metadata/domain must use compact typography.");
excludes(card, "text-xl", "Card must not keep oversized title typography.");
excludes(card, "grid grid-cols-2 gap-3 border-y", "Card must not use nested stat boxes.");
excludes(card, "View Settlement", "Live grid card must not expose settlement CTA.");

includes(packageJson, "test:p0-public-homepage-live-challenges-compact-grid", "Focused live challenges verifier must be registered.");

console.log("P0 public homepage Live Business Challenges compact-grid verifier passed.");
