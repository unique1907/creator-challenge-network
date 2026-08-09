import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(path, needle, message) {
  assert(read(path).includes(needle), message);
}

function excludes(path, needle, message) {
  assert(!read(path).includes(needle), message);
}

const grid = "src/features/challenges/components/challenge-grid.tsx";
const card = "src/features/challenges/components/challenge-card.tsx";
const page = "src/app/challenges/page.tsx";
const published = "src/services/create-challenge/published-challenge.server.ts";
const packageJson = "package.json";

includes(page, "getAllPublicChallenges(challenges)", "/challenges must keep the canonical public challenge data source.");
includes(grid, "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", "/challenges grid must support four compact desktop columns.");
excludes(grid, "grid gap-5 lg:grid-cols-3", "/challenges grid must not remain capped at the old three-column layout.");

includes(card, "p-3.5", "Challenge cards must use reduced internal padding.");
includes(card, "aspect-[16/7] max-h-[132px]", "Challenge cards must use a shorter consistent image area.");
includes(card, "line-clamp-2 text-base", "Challenge titles must use compact two-line typography.");
includes(card, "line-clamp-2 text-xs leading-5", "Challenge summaries must be compact and height-bounded.");
includes(card, "grid grid-cols-2 gap-2 text-xs", "Reward/deadline metadata must use compact two-column stat boxes.");
includes(card, "grid grid-cols-2 gap-2 text-xs leading-5", "Submissions and escrow must render as a compact metadata row.");
includes(card, "line-clamp-2 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-2 text-[11px]", "Usage rights copy must remain but use a compact callout.");
includes(card, "inline-flex h-9 w-full", "View challenge CTA must be reduced but remain clickable.");

includes(card, "formatUsdc(challenge.rewardUsdc)", "Reward must continue to use real challenge data.");
includes(card, "formatDeadline(challenge.deadline)", "Deadline must continue to use the existing formatter.");
includes(card, "challenge.submissions", "Submissions must continue to use real challenge data.");
includes(card, "challenge.escrowStatus", "Escrow status must continue to render truthfully.");
includes(card, "href={`/challenges/${challenge.slug}`}", "CTA destination must remain the public challenge detail route.");

excludes(card, "slice(", "Card component must not change public eligibility or result limits.");
excludes(published, "PUBLIC_CHALLENGES_4_COLUMN_COMPACT_GRID", "Grid refinement must not alter public projection logic.");
includes(packageJson, "test:p0-public-challenges-4-column-compact-grid", "Focused compact /challenges verifier must be registered.");

console.log("P0 public challenges 4-column compact grid verifier passed.");
