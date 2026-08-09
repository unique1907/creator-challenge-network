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

function excludes(path, rejected, message) {
  const source = read(path);
  assert(!source.includes(rejected), `${message}: found ${rejected}`);
}

const dashboardPath = "src/features/dashboard/components/brand-dashboard.tsx";
const viewModelPath = "src/features/dashboard/brand-dashboard-view-model.ts";
const pagePath = "src/app/dashboard/page.tsx";
const packagePath = "package.json";

const page = read(pagePath);

includes(viewModelPath, "export type BrandDashboardViewModel", "Dashboard view-model contract must exist");
includes(viewModelPath, "workspace", "ViewModel must expose workspace");
includes(viewModelPath, "primaryAction", "ViewModel must expose primaryAction");
includes(viewModelPath, "primaryMessage", "ViewModel must expose primaryMessage");
includes(viewModelPath, "primaryCampaign", "ViewModel must expose primaryCampaign");
includes(viewModelPath, "journeySteps", "ViewModel must expose journeySteps for workspace consistency");
includes(viewModelPath, "campaignRows", "ViewModel must expose challenge rows");
includes(viewModelPath, "recentActivity", "ViewModel must expose recent activity");
includes(viewModelPath, "notifications", "ViewModel must expose actionable notifications for shared menu surfaces");
includes(viewModelPath, "walletQuickActions", "ViewModel must expose wallet quick actions");

[
  "Describe Your Business Problem",
  "Continue Problem Draft",
  "Complete Funding",
  "Open Business Challenge",
  "Evaluate Solutions",
  "Select Solution",
  "Complete Payout",
  "View Outcome Report",
].forEach((label) => includes(viewModelPath, label, `Lifecycle action must include ${label}`));

includes(pagePath, "buildBrandDashboardViewModel(drafts", "Server page must build the dashboard ViewModel");
includes(pagePath, "viewModel={viewModel}", "BrandDashboard must receive the server-derived ViewModel");
assert(!page.includes("fundChallenge"), "Dashboard page must not invoke funding behavior");
assert(!page.includes("createWinnerPayoutApproval"), "Dashboard page must not invoke settlement behavior");

includes(dashboardPath, "TopBar", "Dashboard must use a compact top bar");
includes(dashboardPath, "Brand Workspace", "Dashboard must be work-oriented");
includes(dashboardPath, "Welcome back.", "Greeting must support neutral fallback");
includes(dashboardPath, "priorities.length ? <Priorities", "Dashboard must hide priorities when no real data exists");
includes(dashboardPath, "BusinessChallenges", "Dashboard must render the dense challenge work queue");
includes(dashboardPath, "RightRail", "Dashboard must render the compact right rail");
includes(dashboardPath, "RailCard title=\"Wallet\"", "Dashboard must include small wallet rail card");
includes(dashboardPath, "RailCard title=\"Payments\"", "Dashboard must include small payments rail card");
includes(dashboardPath, "RailCard title=\"Recent activity\"", "Dashboard must include small activity rail card");
includes(dashboardPath, "rows.slice(0, 8)", "Dashboard must target 6-8 visible rows");
includes(dashboardPath, "winnerLabel(row.rewardLabel)", "Dashboard must show compact Top1/Top3");
includes(dashboardPath, "viewModel.walletQuickActions", "Payments rail must use ViewModel quick actions");
includes(dashboardPath, "Arc Testnet", "Dashboard must present Arc Testnet context");
excludes(dashboardPath, "ActiveBusinessChallenge", "Rejected giant active challenge summary must not remain");
excludes(dashboardPath, "Solution Journey", "Rejected challenge-detail lifecycle card must not remain");
excludes(dashboardPath, "Good afternoon, Firat", "Hardcoded greeting must be removed");
excludes(dashboardPath, "unique120884", "Technical generated usernames must not be displayed");
excludes(dashboardPath, "status === \"live\" ? 42", "Placeholder live submission count must be removed");
excludes(dashboardPath, "status === \"review\" ? 156", "Placeholder review submission count must be removed");
excludes(dashboardPath, "index === 0 ? \"2m ago\"", "Presentation-only activity timestamps must be removed");
excludes(dashboardPath, "Select Winner", "Brand dashboard must use selected solution language");
excludes(dashboardPath, "Publish Campaign", "Brand dashboard must use Business Challenge language");

includes(packagePath, "\"test:ux-02a-brand-dashboard\"", "Package script must expose focused UX-02A verification");

console.log("UX-02A Brand Dashboard verification passed.");
