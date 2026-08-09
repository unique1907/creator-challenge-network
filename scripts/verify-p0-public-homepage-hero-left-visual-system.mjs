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

const landing = read("src/features/landing/components/final-landing-page.tsx");
const featured = read("src/features/landing/components/featured-challenge-card.tsx");
const processStrip = read("src/features/landing/components/process-strip.tsx");
const landingData = read("src/features/landing/data/landing-page.ts");
const packageJson = read("package.json");

const heroStart = landing.indexOf("<section className=\"bg-[#030a1f]");
const heroEnd = landing.indexOf("<LandingMetrics />");
assert.ok(heroStart >= 0 && heroEnd > heroStart, "Hero section must be identifiable.");
const hero = landing.slice(heroStart, heroEnd);

excludes(hero, "Creator Challenge Network</p>", "CREATOR CHALLENGE NETWORK must no longer be the hero eyebrow.");
includes(hero, "Funded. Fair. On-chain.", "Hero eyebrow must be exactly Funded. Fair. On-chain.");
includes(hero, "Discover the World&apos;s Best Ideas.", "Hero headline must remain exactly locked.");
includes(hero, "Turn business problems into winning solutions.", "Emphasized product line must remain exactly locked.");
includes(hero, "text-cyan-200 sm:text-[28px]", "Emphasized product line must use approved purple/blue visual treatment.");
includes(hero, "<svg className=\"pointer-events-none absolute -bottom-1 left-0 h-3 w-full text-violet-400\"", "Hero product line must have a single restrained curved underline.");
includes(hero, "<path d=\"M4 12C78 4 150 7 214 10.5C284 14.5 350 13 416 5\"", "Underline must be a single organic curved stroke.");
includes(hero, "Launch a business challenge, receive solutions from a global network of AI-augmented creators, and reward the best outcome.", "Supporting copy must remain unchanged.");
includes(landing, "{ href: \"/challenges\", label: \"Explore Live Challenges\", variant: \"primary\" }", "Primary CTA label and /challenges target must remain unchanged.");
includes(landing, "label: \"Start a Business Challenge\", variant: \"secondary\"", "Secondary CTA label and route behavior must remain unchanged.");
includes(landing, "label: \"Join as a Creator\", variant: \"text\"", "Tertiary creator CTA must remain configured as text.");
includes(landing, "return \"mt-4 inline-flex rounded-md text-[13px] font-bold text-cyan-200", "Join as a Creator must remain a compact tertiary text link.");
includes(landing, "items-start", "Hero grid must align the left content and Featured Challenge card at the top.");
includes(landing, "lg:grid-cols-[1fr_1fr]", "Hero must keep a balanced two-column desktop grid.");
includes(hero, "<FeaturedChallengeCard challenge={heroChallenge} />", "Featured Challenge integration must remain unchanged.");
excludes(hero, "<TrustIndicators />", "Inline hero infrastructure items must be removed from the left column.");
excludes(landing, "import { TrustIndicators }", "Hero must not import duplicate inline infrastructure items.");
includes(processStrip, "From Business Problem to Verified Settlement", "Dedicated proof/process strip below the hero must remain present.");
includes(landingData, "Arc", "Homepage infrastructure/proof data must remain present outside the hero.");
includes(landingData, "Circle Wallets", "Circle Wallets proof data must remain present outside the hero.");
includes(landingData, "USDC", "USDC proof data must remain present outside the hero.");
includes(landingData, "Blind Review", "Blind Review proof data must remain present outside the hero.");
includes(packageJson, "test:p0-public-homepage-hero-left-visual-system", "Focused hero-left verifier must be registered.");

includes(featured, "const stats = [", "Featured Challenge compact-preview internals must remain present.");
includes(featured, "Prize Pool Funded", "Featured Challenge evidence pills must remain unchanged.");
includes(featured, "href={`/challenges/${featured.slug}`}", "Featured Challenge public CTA must remain unchanged.");

console.log("P0 public homepage hero-left visual-system verifier passed.");
