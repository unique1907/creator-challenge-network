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
includes(dashboardPath, "<CCNLogo size=\"lg\" priority />", "Brand Dashboard must use the canonical CCNLogo component");
assert(!dashboard.includes("/brand/ccn-logo.png"), "Brand Dashboard must not use the old rectangular PNG logo");
assert(!logoComponent.includes("object-cover"), "Canonical logo component must not crop logo artwork");

includes(dashboardPath, "Needs Attention", "Approved operational hero must render");
includes(dashboardPath, "Campaign Identity", "Hero must contain a structured campaign identity panel");
includes(dashboardPath, "Operational snapshot", "Identity panel must feel operational rather than decorative");
includes(dashboardPath, "Current Phase", "Identity panel must show current campaign phase");
includes(dashboardPath, "Required Action", "Identity panel must show the current action need");
includes(dashboardPath, "viewModel.primaryAction.href", "Primary CTA must be sourced from ViewModel");
assert(!dashboard.includes("HeroIdentityVisual"), "Hero must not include a decorative identity illustration");
includes(dashboardPath, "Campaign Journey", "Campaign journey section must exist");
includes(dashboardPath, "md:grid-cols-6", "Campaign journey must render six desktop stages");
includes(viewModelPath, '["draft", "funding", "published", "review", "winner", "settlement"]', "Journey must include six approved stages");
includes(dashboardPath, "CampaignRows", "Campaign list must use compact row component");
includes(dashboardPath, "md:grid-cols-[minmax(300px,1.35fr)_minmax(180px,0.65fr)_auto]", "Campaign rows must use project-first operational columns");
includes(dashboardPath, "Wallet Quick Actions", "Right column wallet utility section must exist");
includes(dashboardPath, "Recent Activity", "Right column activity section must exist");
includes(dashboardPath, "<h2 className=\"text-2xl font-black\">Arc</h2>", "Arc must be primary ecosystem context");
includes(dashboardPath, "Powered by Circle and USDC", "Circle must stay visible as supporting infrastructure");
includes(viewModelPath, "Fund a campaign prize pool", "Wallet quick actions must avoid fake standalone wallet behavior");
includes(viewModelPath, "Open campaign payment evidence", "Transaction action must navigate to existing campaign evidence");
includes(viewModelPath, "Untitled draft", "Unnamed campaigns must use the approved draft fallback");
includes(viewModelPath, "Complete campaign details to name and publish it.", "Unnamed primary campaign must explain the next setup need");
includes(viewModelPath, "slice(0, 3)", "Recent Activity must be capped at three presentation events");
includes(viewModelPath, "resolveBrandDashboardGreetingName", "Greeting fallback resolver must exist");
includes(viewModelPath, "unique", "Generated username filtering must be represented in the resolver");

assert(!dashboard.includes("Upgrade to Pro"), "Upgrade to Pro must not be prominent in the approved command center");
assert(!dashboard.includes("Untitled challenge"), "Brand Dashboard must not show the old unnamed title fallback");
assert(!dashboard.includes("status === \"live\" ? 42"), "Fake live submission count must not exist");
assert(!dashboard.includes("status === \"review\" ? 156"), "Fake review submission count must not exist");
assert(!dashboard.includes("2m ago"), "Fake activity timestamp must not exist");
assert(!dashboard.includes("14m ago"), "Fake activity timestamp must not exist");
assert(!dashboard.includes("Prize Pool") || !dashboard.includes("Secured"), "Fake prize values must not be shown as runtime data");

assert(campaignWorkspace.includes("<CCNLogo size=\"md\" priority />"), "Campaign Workspace must use the canonical CCNLogo component");
assert(auth.includes("NEXT_PUBLIC_AUTH_EMAIL_OTP_ENABLED"), "Auth fallback flag must remain untouched");
assert(!dashboard.includes("fundChallenge"), "Brand Dashboard must not invoke funding logic");
assert(!dashboard.includes("createWinnerPayoutApproval"), "Brand Dashboard must not invoke settlement logic");
includes(packagePath, "\"test:ux-02a2-brand-dashboard-approved-reference\"", "Package script must expose UX-02A.2 verification");

console.log("UX-02A.2 Brand Dashboard approved reference verification passed.");
