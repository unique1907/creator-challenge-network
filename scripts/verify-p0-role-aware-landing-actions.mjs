import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const checks = [];

function expect(name, condition) {
  checks.push({ name, condition: Boolean(condition) });
}

const page = read("src/app/page.tsx");
const appChrome = read("src/components/layout/app-chrome.tsx");
const header = read("src/components/layout/site-header.tsx");
const authActions = read("src/components/layout/site-auth-actions.tsx");
const landingAuth = read("src/services/landing/landing-auth-state.server.ts");
const landing = read("src/features/landing/components/final-landing-page.tsx");
const featured = read("src/features/landing/components/featured-challenge-card.tsx");

expect("landing page resolves auth state server-side", page.includes("getLandingAuthState()"));
expect("landing page passes same auth state to header", page.includes("<SiteHeader authState={authState}"));
expect("landing page passes same auth state to hero", page.includes("<FinalLandingPage") && page.includes("authState={authState}"));
expect("root chrome does not duplicate server-rendered landing header", appChrome.includes('pathname === "/"'));
expect("site header forwards auth state to nav action", header.includes('variant="nav" initialAuthState={authState}'));
expect("site header forwards auth state to primary action", header.includes("<SiteAuthActions initialAuthState={authState}"));
expect("auth actions support brand workspace label", authActions.includes("Brand Workspace"));
expect("auth actions support creator workspace label", authActions.includes("Creator Workspace"));
expect("auth actions support brand setup continuation", authActions.includes("Continue Brand Setup"));
expect("auth actions support creator setup continuation", authActions.includes("Continue Creator Setup"));
expect("landing auth resolver uses canonical auth helper", landingAuth.includes("getAuthenticatedCcnContext"));
expect("landing auth resolver checks creator payout readiness", landingAuth.includes("getCreatorPayoutWalletStatus"));
expect("anonymous hero primary explores live challenges", landing.includes('label: "Explore Live Challenges", variant: "primary"'));
expect("anonymous hero keeps brand start action", landing.includes('label: "Start a Business Challenge", variant: "secondary"'));
expect("anonymous hero keeps creator entry", landing.includes('label: "Join as a Creator", variant: "text"'));
expect("creator hero keeps creator workspace entry", landing.includes('href: "/dashboard/creator", label: "Join as a Creator"'));
expect("brand hero can launch challenge", landing.includes('href: "/create-challenge?new=1", label: "Start a Business Challenge"'));
expect("hero primary opens public challenge listing", landing.includes('href: "/challenges", label: "Explore Live Challenges"'));
expect("landing does not expose legacy submit route", !landing.includes("/submit/"));
expect("featured card accepts canonical challenge prop", featured.includes("challenge?: Challenge | null"));
expect("featured card has no hardcoded Spotify customer", !featured.includes("Spotify"));
expect("featured card fallback is truthful process evidence", featured.includes("Funded challenges appear after verification") && !featured.includes("Sample brand"));

const failed = checks.filter((check) => !check.condition);
for (const check of checks) {
  console.log(`${check.condition ? "PASS" : "FAIL"} ${check.name}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} role-aware landing verification check(s) failed.`);
  process.exit(1);
}

console.log(`\n${checks.length} role-aware landing verification checks passed.`);
