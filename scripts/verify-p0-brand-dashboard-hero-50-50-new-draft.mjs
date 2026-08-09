import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, expected, message) {
  assert.ok(source.includes(expected), `${message}: missing ${expected}`);
}

function excludes(source, forbidden, message) {
  assert.ok(!source.includes(forbidden), `${message}: found ${forbidden}`);
}

function sliceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.ok(start >= 0, `Missing start token: ${startToken}`);
  const end = source.indexOf(endToken, start);
  assert.ok(end > start, `Missing end token: ${endToken}`);
  return source.slice(start, end);
}

const dashboard = read("src/features/dashboard/components/brand-dashboard.tsx");
const viewModel = read("src/features/dashboard/brand-dashboard-view-model.ts");
const dashboardPage = read("src/app/dashboard/page.tsx");
const challengeList = read("src/features/dashboard/components/brand-dashboard-challenges.tsx");

const hero = sliceBetween(dashboard, "function NextActionHero", "function DashboardJourney");

includes(hero, "md:grid md:min-h-[280px] md:grid-cols-2", "Hero must use equal 50/50 desktop columns");
excludes(hero, "w-[48%]", "Hero must not use the previous approximate right-side image width");
excludes(hero, "absolute inset-y-0 right-0", "Hero must not position the right image as an approximate overlay");
includes(hero, "flex min-h-[260px] flex-col justify-center p-5 md:min-h-[280px] md:p-6", "Hero left half must remain the operational panel");
includes(hero, "relative min-h-[190px] overflow-hidden md:min-h-full", "Hero right half must fill the image column height");
includes(hero, "row?.media.imageUrl", "Hero right cover must use selected challenge media data");
includes(hero, "<img src={row.media.imageUrl}", "Hero must render the real selected challenge cover image");
includes(hero, "absolute inset-0 h-full w-full origin-center scale-[1.15] object-cover object-center", "Hero image must fill the right viewport with centered object-cover scaling");
excludes(hero, "object-contain", "Hero image must not shrink into a contained poster");
excludes(hero, "blur-xl", "Hero image must not use a blurred duplicate background");
excludes(hero, "drop-shadow-[0_18px_44px_rgba(0,0,0,0.42)]", "Hero image must not render a floating foreground poster");
excludes(hero, "<ChallengeThumb", "Hero left side must not render the redundant challenge thumbnail");
includes(hero, "linear-gradient(90deg,#0b1020_0%,rgba(11,16,32,0.72)_12%,rgba(11,16,32,0.18)_30%,rgba(11,16,32,0)_54%)", "Hero must keep a controlled center gradient transition");
includes(hero, "YOUR NEXT ACTION", "Hero eyebrow must use locked copy");

for (const title of [
  "Complete your Business Challenge draft",
  "Fund your Business Challenge",
  "Open your business challenge for solutions",
  "Review incoming solution proposals",
  "Choose the winning solution",
  "Approve creator payout",
]) {
  includes(dashboard, title, `Hero lifecycle title mapping must include ${title}`);
}

for (const cta of ["Continue Draft", "Complete Funding", "Review Solutions", "Finalize Selection", "Approve Payout"]) {
  includes(dashboard, cta, `Hero lifecycle CTA mapping must include ${cta}`);
}

includes(hero, "href={NEW_DRAFT_HREF}", "New Draft shortcut must use the existing create flow route constant");
includes(dashboard, 'const NEW_DRAFT_HREF = "/create-challenge?new=1";', "New Draft route must reuse the existing create flow");
includes(hero, "New Draft", "New Draft button must be visible");
includes(hero, "flex w-full max-w-[188px] flex-col gap-2", "Primary and New Draft buttons must be stacked with compact spacing");
includes(dashboard, 'if (!row) return { label: "New Draft"', "Caught-up state must use New Draft as its only CTA");
includes(hero, "No Business Challenges currently require your attention.", "Caught-up supporting text must be locked");
excludes(hero, "New Business Challenge", "Hero must not label the shortcut New Business Challenge");
excludes(hero, "/api/create-challenge/draft?new=1", "Rendering New Draft must not call the draft API");
excludes(hero, "createNewCreateChallengeDraft", "Hero rendering must not create a draft");
excludes(hero, "ChatGPT Image", "Hero must not use generated image assets");
excludes(hero, "Nike Motion Campaign", "Hero must not hardcode challenge data");

includes(viewModel, "function isHeroActionable", "Hero actionability helper must remain in the view model");
includes(viewModel, 'return row.status !== "completed";', "Completed challenges must remain excluded from hero selection");
includes(viewModel, ".filter(isHeroActionable).sort(compareRowsByPriority", "Hero focus must filter completed rows before priority sorting");

includes(dashboardPage, "buildBrandDashboardViewModel(drafts", "Dashboard must keep using the existing canonical view model source");
includes(challengeList, "BrandDashboardChallengeList", "Business Challenges list component must remain separate");

const rightRailOrder = [
  "function WalletQuickActions",
  "function RecentActivity",
  "function TodaysPriorities",
  "function ArcCircleCard",
].map((token) => {
  const index = dashboard.indexOf(token);
  assert.ok(index >= 0, `Missing right rail token: ${token}`);
  return index;
});
assert.ok(rightRailOrder.every((index, position) => position === 0 || rightRailOrder[position - 1] < index), "Right rail structure must remain unchanged.");

console.log("P0 Brand Dashboard hero 50/50 New Draft verifier passed.");
