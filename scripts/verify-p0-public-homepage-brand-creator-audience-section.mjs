import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const checks = [];

function expect(name, condition) {
  checks.push({ name, condition: Boolean(condition) });
}

const componentPath = "src/features/landing/components/landing-audience-section.tsx";
const landingPath = "src/features/landing/components/final-landing-page.tsx";
const component = read(componentPath);
const landing = read(landingPath);

const referencePaths = [
  "reference-assets/landing/ccn-for-brands-reference.png",
  "reference-assets/landing/ccn-for-creators-reference.png",
  "reference-assets/landing/ccn-bottom-cta-reference.png",
];

for (const referencePath of referencePaths) {
  expect(`reference exists: ${referencePath}`, existsSync(join(root, referencePath)));
}

expect("audience section is mounted on the public homepage", landing.includes("<LandingAudienceSection authState={authState} />"));
expect("audience section is imported by final landing page", landing.includes('import { LandingAudienceSection } from "./landing-audience-section";'));
expect("exactly two audience card render sites exist", (component.match(/data-audience-card=/g) ?? []).length === 2);
expect("one audience card is For Brands", component.includes('data-audience-card="For Brands"') && component.includes('{isBrand ? "Brands" : "Creators"}'));
expect("one audience card is For Creators", component.includes('data-audience-card="For Creators"') && component.includes('{isBrand ? "Brands" : "Creators"}'));

for (const benefit of [
  "Access a global network of AI-augmented creators",
  "Receive targeted solutions to real business problems",
  "Blind review ensures ideas win, not identities",
  "Secure rewards with USDC on Arc",
]) {
  expect(`brand benefit present: ${benefit}`, component.includes(benefit));
}

for (const benefit of [
  "Discover challenges that match your skills and interests",
  "Submit Solution Proposals anonymously",
  "Compete through ideas, not identity",
  "Receive rewards in test USDC through Circle Wallets",
]) {
  expect(`creator benefit present: ${benefit}`, component.includes(benefit));
}

expect("Brand CTA reads exactly Start a Challenge", component.includes("Start a Challenge"));
expect("Creator CTA reads exactly Join as a Creator", component.includes("Join as a Creator"));
expect("bottom banner exists as a separate component", component.includes("function LandingOutcomeCtaBanner()") && component.includes("data-outcome-cta-banner"));
expect("bottom statement is exact", component.includes("Ideas have value. Outcomes drive impact."));
expect("bottom supporting text is exact", component.includes("Turn real business problems into funded challenges and verified outcomes."));
expect("bottom CTA reads exactly Explore Live Challenges", component.includes("Explore Live Challenges"));
expect("cards are side by side on desktop", component.includes("data-audience-card-grid") && component.includes("lg:grid-cols-2"));
expect("cards stack on mobile before desktop breakpoint", component.includes('className="grid gap-4 lg:grid-cols-2"'));
expect("brand device visual is separate from card copy", component.includes('data-device-visual="brand-laptop"'));
expect("creator device visual is separate from card copy", component.includes('data-device-visual="creator-phones"'));
expect("device visuals are CSS/HTML, not distorted image tags", !component.includes("<img") && !component.includes("object-cover") && !component.includes("object-fill"));
expect("Brand route reuses existing create challenge path", component.includes('"/create-challenge?new=1"'));
expect("Brand route preserves onboarding path", component.includes('"/auth/onboarding/brand"'));
expect("Brand anonymous route uses role-aware signup", component.includes('"/auth/sign-up?role=brand"'));
expect("Creator route preserves workspace path", component.includes('"/dashboard/creator"'));
expect("Creator route preserves onboarding path", component.includes('"/auth/onboarding/creator?next=%2Fdashboard%2Fcreator"'));
expect("Creator anonymous route uses role-aware signup", component.includes('"/auth/sign-up?role=creator"'));
expect("bottom CTA opens public challenge listing", component.includes('href="/challenges"'));
expect("reference PNGs are not rendered as flat sections", !component.includes("ccn-for-brands-reference.png") && !component.includes("ccn-for-creators-reference.png") && !component.includes("ccn-bottom-cta-reference.png"));
expect("component has no challenge mutation API call", !component.includes("/api/create-challenge") && !component.includes("fetch("));
expect("component has no Circle or Arc state-changing call", !component.includes("releasePayout") && !component.includes("approve") && !component.includes("executeContract"));
expect("live challenge section remains mounted", landing.includes('id="live-business-challenges"'));
expect("standalone settlement section remains removed", !landing.includes("Verified Settlement on Arc") && !landing.includes("No verified public settlement yet"));

const failed = checks.filter((check) => !check.condition);
for (const check of checks) {
  console.log(`${check.condition ? "PASS" : "FAIL"} ${check.name}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} audience section verification check(s) failed.`);
  process.exit(1);
}

console.log(`\n${checks.length} audience section verification checks passed.`);
