import { existsSync, readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(path, expected, message) {
  assert(read(path).includes(expected), `${message}: missing ${expected}`);
}

function excludes(path, rejected, message) {
  assert(!read(path).includes(rejected), `${message}: found ${rejected}`);
}

const dashboardPath = "src/features/dashboard/components/brand-dashboard.tsx";
const logoComponentPath = "src/components/ui/ccn-logo.tsx";
const viewModelPath = "src/features/dashboard/brand-dashboard-view-model.ts";
const campaignWorkspacePath = "src/features/dashboard/components/campaign-workspace.tsx";
const authPath = "src/features/auth/components/auth-actions.tsx";
const packagePath = "package.json";

const dashboard = read(dashboardPath);
const campaignWorkspace = read(campaignWorkspacePath);
const logoComponent = read(logoComponentPath);
const auth = read(authPath);

assert(existsSync("public/brand/ccn-logo.svg"), "Locked full SVG logo must exist");
assert(existsSync("public/brand/ccn-mark.svg"), "Locked compact SVG mark must exist");
includes(logoComponentPath, "/brand/ccn-logo.svg", "Canonical logo component must use the locked SVG logo");
includes(dashboardPath, "<CCNLogo size=\"md\" priority />", "Brand Dashboard sidebar must use the canonical CCNLogo component");
assert(!dashboard.includes("/brand/ccn-logo.png"), "Brand Dashboard must not use the old rectangular PNG logo");
assert(!logoComponent.includes("object-cover"), "Canonical logo component must not crop logo artwork");

includes(dashboardPath, "TopBar", "Final dashboard must use a compact top bar");
includes(dashboardPath, "Brand Workspace", "Final dashboard must be work-oriented");
includes(dashboardPath, "Search business challenges", "Top bar must include compact search affordance");
includes(dashboardPath, "variant=\"topbar\"", "Account menu must live in the top bar");
includes(dashboardPath, "lg:grid-cols-[minmax(0,0.7fr)_minmax(300px,0.3fr)]", "Dashboard must use the final 70/30 IA");
includes(dashboardPath, "priorities.length ? <Priorities", "Priorities must be real-data backed and hidden when empty");
includes(dashboardPath, "BusinessChallenges", "Dashboard must render the business challenge work queue");
includes(dashboardPath, "RightRail", "Dashboard must render the compact right rail");
includes(dashboardPath, "RailCard title=\"Wallet\"", "Right rail wallet card must exist");
includes(dashboardPath, "RailCard title=\"Payments\"", "Right rail payments card must exist");
includes(dashboardPath, "RailCard title=\"Recent activity\"", "Right rail activity card must exist");
includes(dashboardPath, "rows.slice(0, 8)", "Dashboard must target 6-8 visible rows");
includes(dashboardPath, "md:grid-cols-[44px_minmax(190px,1fr)_120px_72px_90px_86px_minmax(150px,0.9fr)_132px]", "Challenge rows must be dense");
includes(dashboardPath, "winnerLabel(row.rewardLabel)", "Challenge rows must show compact Top1/Top3");
includes(viewModelPath, "Untitled draft", "Unnamed challenges must use the approved draft fallback");
includes(viewModelPath, "resolveBrandDashboardGreetingName", "Greeting fallback resolver must exist");
includes(viewModelPath, "unique", "Generated username filtering must be represented in the resolver");

excludes(dashboardPath, "Needs Attention", "Rejected operational hero must not remain");
excludes(dashboardPath, "Campaign Identity", "Rejected identity hero panel must not remain");
excludes(dashboardPath, "Campaign Journey", "Rejected dashboard journey card must not remain");
excludes(dashboardPath, "ActiveBusinessChallenge", "Rejected giant summary component must not remain");
excludes(dashboardPath, "BrandNotifications", "Rejected giant notification control must not remain");
excludes(dashboardPath, "HeroIdentityVisual", "Dashboard must not include a decorative identity illustration");
excludes(dashboardPath, "Wallet Quick Actions", "Wallet quick actions must be merged into Payments rail");
excludes(dashboardPath, "Upgrade to Pro", "Upgrade to Pro must not be prominent in the approved command center");
excludes(dashboardPath, "Untitled challenge", "Brand Dashboard must not show the old unnamed title fallback");
excludes(dashboardPath, "status === \"live\" ? 42", "Fake live submission count must not exist");
excludes(dashboardPath, "status === \"review\" ? 156", "Fake review submission count must not exist");
excludes(dashboardPath, "2m ago", "Fake activity timestamp must not exist");
excludes(dashboardPath, "14m ago", "Fake activity timestamp must not exist");
assert(!dashboard.includes("Prize Pool") || !dashboard.includes("Secured"), "Fake prize values must not be shown as runtime data");

assert(campaignWorkspace.includes("<CCNLogo size=\"md\" priority />"), "Campaign Workspace must use the canonical CCNLogo component");
assert(auth.includes("NEXT_PUBLIC_AUTH_EMAIL_OTP_ENABLED"), "Auth fallback flag must remain untouched");
assert(!dashboard.includes("fundChallenge"), "Brand Dashboard must not invoke funding logic");
assert(!dashboard.includes("createWinnerPayoutApproval"), "Brand Dashboard must not invoke settlement logic");
includes(packagePath, "\"test:ux-02a2-brand-dashboard-approved-reference\"", "Package script must expose UX-02A.2 verification");

console.log("UX-02A.2 Brand Dashboard final IA verification passed.");
