import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(path, expected, message) {
  const source = read(path);
  assert(source.includes(expected), `${message}: missing ${expected}`);
}

const dashboardPath = "src/features/dashboard/components/brand-dashboard.tsx";
const viewModelPath = "src/features/dashboard/brand-dashboard-view-model.ts";
const pagePath = "src/app/dashboard/page.tsx";
const packagePath = "package.json";

const dashboard = read(dashboardPath);
const page = read(pagePath);

includes(viewModelPath, "export type BrandDashboardViewModel", "Dashboard view-model contract must exist");
includes(viewModelPath, "workspace", "ViewModel must expose workspace");
includes(viewModelPath, "primaryAction", "ViewModel must expose primaryAction");
includes(viewModelPath, "primaryMessage", "ViewModel must expose primaryMessage");
includes(viewModelPath, "primaryTitle", "ViewModel must expose primaryTitle");
includes(viewModelPath, "campaignHealth", "ViewModel must expose campaignHealth");
includes(viewModelPath, "primaryCampaign", "ViewModel must expose primaryCampaign");
includes(viewModelPath, "journeySteps", "ViewModel must expose journeySteps");
includes(viewModelPath, "campaignRows", "ViewModel must expose campaignRows");
includes(viewModelPath, "recentActivity", "ViewModel must expose recentActivity");
includes(viewModelPath, "notifications", "ViewModel must expose actionable notifications");
includes(viewModelPath, "walletQuickActions", "ViewModel must expose walletQuickActions");
includes(viewModelPath, "sponsorVisible", "ViewModel must expose sponsorVisible");

[
  "Create your first challenge",
  "Continue Draft",
  "Complete Funding",
  "Publish Campaign",
  "Open Blind Review",
  "Select Winner",
  "Complete Payout",
  "View Report",
].forEach((label) => includes(viewModelPath, label, `Lifecycle priority must include ${label}`));

includes(pagePath, "buildBrandDashboardViewModel(drafts", "Server page must build the dashboard ViewModel");
includes(pagePath, "viewModel={viewModel}", "BrandDashboard must receive the server-derived ViewModel");
assert(!page.includes("fundChallenge"), "Dashboard page must not invoke funding behavior");
assert(!page.includes("createWinnerPayoutApproval"), "Dashboard page must not invoke settlement behavior");

includes(dashboardPath, "resolveBrandDashboardGreetingName", "Greeting must use sanitized brand/display fallback");
includes(dashboardPath, "Welcome back.", "Greeting must support neutral fallback");
includes(dashboardPath, "Needs Attention", "Hero must render the operational decision headline");
includes(dashboardPath, "Complete your campaign before publishing.", "Hero must explain the required next decision");
includes(dashboardPath, "New submission received", "Hero must support new-submission operational priority");
includes(dashboardPath, "Primary issue", "Hero must focus the current blocker");
includes(dashboardPath, "Estimated time: 2 min.", "Hero must include concise supporting effort information");
includes(dashboardPath, "viewModel.primaryAction.label", "Hero primary CTA must use the current lifecycle action label");
includes(dashboardPath, "Campaign Identity", "Hero must include a structured campaign identity panel");
includes(dashboardPath, "viewModel.primaryAction.href", "Primary CTA must come from ViewModel");
includes(dashboardPath, "viewModel.journeySteps", "Campaign journey must come from ViewModel");
includes(dashboardPath, "viewModel.campaignRows", "Campaign rows must come from ViewModel");
includes(dashboardPath, "viewModel.recentActivity", "Recent activity must come from ViewModel");
includes(dashboardPath, "viewModel.walletQuickActions", "Wallet quick actions must come from ViewModel");
includes(dashboardPath, "viewModel.notifications", "Notifications must come from ViewModel");
includes(dashboardPath, "Create challenge -&gt; Fund -&gt; Publish -&gt; Review -&gt; Select Winner -&gt; Settle -&gt; Completed.", "Empty state must explain lifecycle");
includes(dashboardPath, "Arc", "Dashboard must present Arc as ecosystem context");
assert(!dashboard.includes("Good afternoon, Firat"), "Hardcoded greeting must be removed");
assert(!dashboard.includes("unique120884"), "Technical generated usernames must not be displayed");
assert(!dashboard.includes("status === \"live\" ? 42"), "Placeholder live submission count must be removed");
assert(!dashboard.includes("status === \"review\" ? 156"), "Placeholder review submission count must be removed");
assert(!dashboard.includes("index === 0 ? \"2m ago\""), "Presentation-only activity timestamps must be removed");

includes(packagePath, "\"test:ux-02a-brand-dashboard\"", "Package script must expose focused UX-02A verification");

console.log("UX-02A Brand Dashboard verification passed.");
