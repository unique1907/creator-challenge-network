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
const landingData = read("src/features/landing/data/landing-page.ts");
const landingCard = read("src/features/landing/components/landing-challenge-card.tsx");
const featured = read("src/features/landing/components/featured-challenge-card.tsx");
const projection = read("src/services/create-challenge/published-challenge.server.ts");
const types = read("src/types/ccn.ts");
const header = read("src/components/layout/site-header.tsx");
const dashboard = read("src/features/dashboard/components/brand-dashboard.tsx");
const creatorWorkspace = read("src/features/creator-workspace/components/creator-workspace.tsx");

for (const mock of ["Nike", "Spotify", "Adobe", "Coca-Cola", "Adidas", "Red Bull", "Sample brand", "Sample Creator Challenge"]) {
  excludes(landing, mock, `Homepage must not render mock challenge content: ${mock}`);
  excludes(landingData, mock, `Homepage data must not keep mock challenge content: ${mock}`);
  excludes(featured, mock, `Hero product evidence must not keep mock challenge content: ${mock}`);
}

includes(page, "listFeaturedHomepageChallenges()", "Homepage must load real featured public challenges server-side.");
includes(page, "Promise.allSettled", "Homepage must preserve challenge projection failure state server-side.");
excludes(page, "listLiveHomepageChallenges().catch(() => [])", "Homepage must not turn live challenge data-source failures into truthful empty data.");
includes(page, "featuredChallenges={featuredChallenges}", "Homepage must pass real challenge list to landing component.");
includes(page, "liveHomepageStatus={liveHomepageStatus}", "Homepage must pass live challenge load status.");
includes(projection, "draft.deployment.publicationStatus === \"live\"", "Public eligibility must require live publication.");
includes(projection, "fundingStatus === \"funded\" || fundingStatus === \"live\"", "Public eligibility must require funded state.");
includes(projection, "draft.funding.escrowStatus === \"verified\"", "Public eligibility must require verified escrow.");
includes(projection, "draft.funding.eventVerified", "Public eligibility must require verified funding event.");
includes(projection, "draft.funding.transactionHash", "Public eligibility must require real funding transaction evidence.");
includes(projection, "countSubmittedEntriesForChallenge(challengeId)", "Public projection must preserve real submitted counts.");
includes(projection, "listWinnerFinalizationAttempts", "Public projection must read winner finalization state without changing it.");
includes(projection, "classifyCreateChallengeDraftLifecycle", "Public projection must derive public lifecycle status from the shared classifier.");
includes(projection, "status === \"completed\" && winnerAttempt?.transactionHash", "Completed settlement links must require payout transaction evidence.");
includes(projection, "function isInternalTestTitle", "Homepage featured selection must exclude internal test titles.");
includes(projection, "/^deneme\\s*\\d*$/i", "Deneme records must be excluded from featured homepage cards.");
includes(projection, ".slice(0, 3)", "Homepage featured challenge count must be capped at 3.");
includes(projection, "return published", "Fewer records must not trigger homepage mock fallbacks.");
excludes(projection, "landingChallenges", "Public projection must not merge landing mock challenge cards.");

includes(types, "open\" | \"reviewing\" | \"closed\" | \"selection\" | \"settlement\" | \"completed", "Public status model must cover allowed lifecycle states.");
includes(landing, "Discover the World&apos;s Best Ideas.", "Hero headline must match locked positioning.");
includes(landing, "Turn business problems into winning solutions.", "Hero subheadline must match locked positioning.");
includes(landing, "Launch a business challenge, receive solutions from a global network of AI-augmented creators, and reward the best outcome.", "Hero supporting copy must match locked positioning.");
includes(landing, "Explore Live Challenges", "Primary CTA must use locked label.");
includes(landing, "Start a Business Challenge", "Secondary CTA must use locked label.");
includes(landing, "Join as a Creator", "Creator CTA must remain available.");
includes(landing, "Live Business Challenges", "Challenge section must use locked title.");
includes(landing, "Funded business challenges open for solution proposals and verified outcomes.", "Challenge section supporting copy must match locked text.");
includes(landing, "No live Business Challenges yet", "Empty state title must be truthful.");
includes(landing, "Funded challenges will appear here after the Brand locks the reward and publishes the challenge.", "Empty state copy must be truthful.");
includes(landing, "Live challenges are temporarily unavailable", "Infrastructure failure state must not reuse the normal empty state.");
includes(landing, "We could not load verified public challenge data. Please refresh shortly.", "Infrastructure failure copy must be safe and non-technical.");
excludes(landing, "Verified Settlement on Arc", "Homepage must not render the removed standalone payout proof section.");
excludes(landing, "No verified public settlement yet", "Homepage must not render the removed standalone settlement empty state.");
includes(featured, "Payout verified on Arc", "Featured Challenge must retain completed-state payout evidence.");
includes(featured, "View Settlement", "Featured Challenge must retain settlement transaction action.");
includes(landingCard, "href={`/challenges/${challenge.slug}`}", "Homepage challenge CTAs must use safe public challenge routes.");
excludes(landingCard, "/dashboard/challenges", "Homepage challenge cards must not link to private Brand routes.");
excludes(landingCard, "#review", "Homepage challenge cards must not link to private review tabs.");
excludes(landingCard, "#settlement", "Homepage challenge cards must not link to private payout controls.");
includes(landingCard, "View Challenge", "Live challenge grid card CTA must use locked public label.");
excludes(landingCard, "challenge.publicCtaLabel", "Live challenge grid cards must not show mixed lifecycle CTA labels.");
excludes(landingCard, "View Settlement", "Live challenge grid cards must not expose settlement links.");

includes(landingData, "Challenge funding and creator settlement run on Arc Testnet.", "Arc copy must match implemented behavior.");
includes(landingData, "Brand and Creator payment wallets are powered by Circle Wallets.", "Circle Wallets copy must match implemented behavior.");
includes(landingData, "Rewards are funded in advance and settled in test USDC.", "USDC copy must match implemented behavior.");
includes(landingData, "Brand reviewers evaluate anonymous solution proposals before selection.", "Blind Review copy must match implemented behavior.");
includes(landingData, "Define the Business Problem", "How-it-works flow must use Business Problem language.");
includes(landingData, "Fund the Reward in USDC", "How-it-works flow must include USDC funding.");
includes(landingData, "Receive Solution Proposals", "How-it-works flow must include solution proposals.");
includes(landingData, "Evaluate and Select", "How-it-works flow must include evaluation and selection.");
includes(landingData, "Settle the Reward on Arc", "How-it-works flow must include Arc settlement.");
for (const unsupported of ["autonomous agents", "cross-chain", "swap", "fiat onramp", "mainnet readiness", "sub-second"]) {
  excludes(landingData.toLowerCase(), unsupported, `Homepage evidence copy must not claim unsupported capability: ${unsupported}`);
}

includes(header, 'href: "/challenges", label: "Live Challenges"', "Public header must point to the public challenge listing.");
excludes(landing, "BrandDashboard", "Homepage must not import authenticated Brand dashboard components.");
excludes(landing, "CreatorWorkspace", "Homepage must not import authenticated Creator workspace components.");
includes(dashboard, "BrandDashboard", "Brand Dashboard component remains present.");
includes(creatorWorkspace, "Creator", "Creator Workspace component remains present.");

console.log("P0 public homepage live-data truthfulness verifier passed.");
