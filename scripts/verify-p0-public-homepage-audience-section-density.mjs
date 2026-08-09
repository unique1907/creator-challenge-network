import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const component = readFileSync(join(root, "src/features/landing/components/landing-audience-section.tsx"), "utf8");
const landing = readFileSync(join(root, "src/features/landing/components/final-landing-page.tsx"), "utf8");
const checks = [];

function expect(name, condition) {
  checks.push({ name, condition: Boolean(condition) });
}

expect("both audience cards remain present", (component.match(/data-audience-card=/g) ?? []).length === 2);
expect("cards remain equal height by shared class", (component.match(/min-h-\[240px\]/g) ?? []).length === 2 && (component.match(/h-full min-h-\[240px\]/g) ?? []).length === 2);
expect("desktop card height is reduced to final target", !component.includes("min-h-[470px]") && !component.includes("min-h-[410px]") && component.includes("min-h-[240px]"));
expect("card headings are final compact scale and not intentionally split", component.includes("text-[22px]") && !component.includes("sm:text-[28px]") && !component.includes("For <br"));
expect("heading icons use final smaller scale", component.includes("h-9 w-9") && component.includes("className=\"h-5 w-5\""));
expect("benefit text and spacing are final compact scale", component.includes("text-[13px]") && component.includes("leading-[1.35]") && component.includes("space-y-2"));
expect("check icons stay within final compact target", component.includes("h-5 w-5") && component.includes("h-3 w-3"));
expect("laptop visual is scaled down to about 65 percent", component.includes("min-h-[165px]") && component.includes("w-[min(100%,195px)]") && !component.includes("w-[min(100%,300px)]"));
expect("phone visual is scaled down to about 60 percent", component.includes("min-h-[160px]") && component.includes("h-[132px] w-[68px]") && !component.includes("h-[220px] w-[114px]"));
expect("device visuals remain HTML/CSS and not cropped image tags", !component.includes("<img") && !component.includes("object-cover") && !component.includes("object-fill"));
expect("CTA buttons use final compact sizing", (component.match(/inline-flex h-\[38px\]/g) ?? []).length >= 3 && component.includes("text-[13px]"));
expect("bottom banner height is reduced to final target", component.includes('className="relative mt-4 flex min-h-[88px]') && !component.includes("min-h-[128px]"));
expect("bottom trophy is final compact scale", component.includes("h-[50px] w-[50px]") && component.includes("className=\"h-6 w-6\""));
expect("bottom banner typography is final compact scale", component.includes("text-[22px]") && component.includes("text-[13px] leading-5"));
expect("locked Brand copy remains unchanged", component.includes("Access a global network of AI-augmented creators") && component.includes("Receive targeted solutions to real business problems") && component.includes("Blind review ensures ideas win, not identities") && component.includes("Secure rewards with USDC on Arc"));
expect("locked Creator copy remains unchanged", component.includes("Discover challenges that match your skills and interests") && component.includes("Submit Solution Proposals anonymously") && component.includes("Compete through ideas, not identity") && component.includes("Receive rewards in test USDC through Circle Wallets"));
expect("locked CTA copy remains unchanged", component.includes("Start a Challenge") && component.includes("Join as a Creator") && component.includes("Explore Live Challenges"));
expect("desktop remains two columns", component.includes("grid gap-4 lg:grid-cols-2"));
expect("mobile remains responsive without desktop fixed height", component.includes("min-h-[240px]") && component.includes("hidden") && component.includes("md:flex"));
expect("no other homepage section was removed", landing.includes("<LandingMetrics />") && landing.includes("<ProcessStrip />") && landing.includes('id="live-business-challenges"') && landing.includes("<LandingAudienceSection authState={authState} />"));
expect("standalone settlement section remains removed", !landing.includes("Verified Settlement on Arc") && !landing.includes("No verified public settlement yet"));
expect("no product logic calls were added", !component.includes("fetch(") && !component.includes("/api/") && !component.includes("releasePayout") && !component.includes("executeContract"));

const failed = checks.filter((check) => !check.condition);
for (const check of checks) {
  console.log(`${check.condition ? "PASS" : "FAIL"} ${check.name}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} audience density verification check(s) failed.`);
  process.exit(1);
}

console.log(`\n${checks.length} audience density verification checks passed.`);
