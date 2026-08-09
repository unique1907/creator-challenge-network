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

const featured = read("src/features/landing/components/featured-challenge-card.tsx");
const landing = read("src/features/landing/components/final-landing-page.tsx");
const projection = read("src/services/create-challenge/published-challenge.server.ts");
const packageJson = read("package.json");

excludes(featured, "sm:grid-cols-2", "Featured Challenge must not use the old six-box workspace grid.");
excludes(featured, "{ label: \"Brand\"", "Brand block must be removed from the Featured Challenge card.");
excludes(featured, "{ label: \"Category\"", "Category must not render as a large stat block.");
excludes(featured, "{ label: \"Status\"", "Status must not render as a large stat block.");
excludes(featured, "{ label: \"Review\"", "Review block must be removed from the Featured Challenge card.");
excludes(featured, "Funded before publish", "Escrow technical detail row must be removed.");
excludes(featured, "Circle Hosted approval", "Wallets technical detail row must be removed.");
excludes(featured, "{ label: \"Network\"", "Network technical detail row must be removed.");
excludes(featured, "featured.evaluation", "Featured card must not expose raw review criteria.");
excludes(featured, "featured.brand", "Featured card must not expose the Brand field.");
excludes(featured, "dashboard/challenges", "Featured card CTA must not expose private Brand workspace routes.");
excludes(featured, "#review", "Featured card CTA must not expose private review tabs.");
excludes(featured, "#settlement", "Featured card CTA must not expose private payout controls.");
excludes(featured, "publicStatusLabel ?? statusLabel", "Featured status must not fall through to raw backend labels.");

includes(featured, "const stats = [", "Featured Challenge must build one compact stats row.");
includes(featured, "{ label: \"Prize Pool\", value: formatReward(featured) }", "Prize Pool stat must use real challenge reward data.");
includes(featured, "{ label: \"Solutions\", value: solutionLabel(featured.submissions) }", "Solutions stat must use real submitted count.");
includes(featured, "{ label: \"Deadline\", value: deadlineLabel(featured) }", "Deadline/result stat must use real challenge lifecycle data.");
includes(featured, "grid grid-cols-3", "Featured stats row must render exactly three compact columns.");
includes(featured, "Prize Pool Funded", "Prize Pool evidence must be retained as a compact pill.");
includes(featured, "Blind Review", "Blind Review evidence must be retained as a compact pill.");
includes(featured, "Arc Testnet", "Arc Testnet evidence must be retained as a compact pill.");
includes(featured, "Payout verified on Arc", "Completed-state payout evidence pill must be supported.");
includes(featured, "Circle Wallets", "Completed-state Circle Wallets evidence pill must be supported.");
includes(featured, ".slice(0, 3)", "Evidence pills must be capped at three.");
includes(featured, "Under Evaluation", "Reviewing state must use human-readable public copy.");
includes(featured, "Selection in Progress", "Selection state must use human-readable public copy.");
includes(featured, "Settlement in Progress", "Settlement state must use human-readable public copy.");
includes(featured, "href={`/challenges/${featured.slug}`}", "Primary CTA must route to the safe public challenge page.");
includes(featured, "ctaLabel(featured)", "Primary CTA must be lifecycle-specific.");
includes(featured, "line-clamp-3", "Challenge title must stay compact.");
includes(featured, "aspect-[16/10]", "Challenge image must use a compact fixed aspect ratio.");
includes(featured, "rounded-xl border border-[#D9DEE7] bg-[#F3F4F6] p-5", "Featured card must use the compact soft-gray sponsor surface without changing shell sizing.");
includes(featured, "text-slate-950", "Featured card title and metric values must use dark light-surface text.");
includes(featured, "border-slate-200 bg-slate-50", "Featured stats row must use a subtle light metrics surface.");
includes(featured, "{featured.category}", "Business Domain must remain as a compact badge near the title.");

includes(landing, "<FeaturedChallengeCard challenge={heroChallenge} />", "Homepage must keep the same Featured Challenge integration point.");
includes(projection, "countSubmittedEntriesForChallenge(challengeId)", "Solution count must remain sourced from canonical submitted entries.");
includes(projection, "draft.prizePool.totalAmount", "Prize Pool must remain sourced from canonical challenge reward data.");
includes(projection, "publicCtaLabel: classification.publicCtaLabel", "Public CTA label must remain lifecycle-derived.");
includes(packageJson, "test:p0-public-homepage-featured-challenge-compact-preview", "Focused compact-preview verifier must be registered.");

console.log("P0 public homepage Featured Challenge compact-preview verifier passed.");
