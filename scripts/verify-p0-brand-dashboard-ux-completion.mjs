import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => assert.ok(fs.existsSync(path.join(root, relativePath)), `${relativePath} must exist`);
const includes = (file, text, message) => assert.ok(read(file).includes(text), message);
const excludes = (file, text, message) => assert.ok(!read(file).includes(text), message);

const dashboard = "src/features/dashboard/components/brand-dashboard.tsx";
const viewModel = "src/features/dashboard/brand-dashboard-view-model.ts";
const workspace = "src/features/dashboard/components/campaign-workspace.tsx";
const campaignsPage = "src/app/dashboard/campaigns/page.tsx";
const navigation = "src/features/dashboard/components/brand-workspace-navigation.tsx";
const logo = "src/components/ui/ccn-logo.tsx";
const types = "src/types/create-challenge.ts";

for (const file of [dashboard, viewModel, workspace, campaignsPage, navigation, logo, types]) exists(file);

includes(dashboard, "Business Challenges", "Brand-visible nav/list copy must say Business Challenges.");
excludes(dashboard, '["Campaigns", "/dashboard/campaigns"', "Brand dashboard nav must not expose Campaigns label.");
includes(dashboard, "CCNLogo", "Canonical CCN logo component must remain in use.");
includes(dashboard, "<AiTemplatesBetaButton variant=\"compact\" />", "Dashboard sidebar must keep the locked AI Templates placeholder control.");

includes(dashboard, "TopBar", "Dashboard must use a compact top bar.");
includes(dashboard, "Brand Workspace", "Dashboard page title must be work-oriented.");
includes(dashboard, "Welcome back", "Dashboard header must keep the greeting as secondary context.");
includes(dashboard, "<BrandAccountControls", "Dashboard top bar must render profile controls.");
includes(navigation, "variant=\"topbar\"", "Profile menu must support top bar mode.");
includes(dashboard, "w-[224px]", "Sidebar must use the final compact width.");
includes(dashboard, 'label: "Dashboard", href: "/dashboard"', "Sidebar must keep Dashboard.");
includes(dashboard, 'label: "Business Challenges", href: "/dashboard/campaigns"', "Sidebar must keep Business Challenges.");
includes(dashboard, 'label: "Wallet", href: "/dashboard/wallet"', "Sidebar must keep Wallet.");
includes(dashboard, 'label: "Payments", href: "/dashboard/payments"', "Sidebar must keep Payments.");
includes(dashboard, 'label: "Settings", href: "/dashboard/settings"', "Sidebar must keep Settings.");

excludes(dashboard, "ActiveBusinessChallenge", "Rejected giant active challenge card must be removed.");
includes(dashboard, "function DashboardJourney", "Dashboard must use a compact journey summary instead of the full challenge-detail lifecycle block.");
excludes(dashboard, "MetricCard", "Rejected metric-card summary layout must be removed.");
excludes(dashboard, "BrandNotifications", "Rejected giant notification control must be removed from dashboard.");
excludes(dashboard, "Discover the World&apos;s Best Ideas.", "Dashboard must not repeat landing-page hero positioning.");
excludes(dashboard, "Turn business problems into winning solutions.", "Dashboard must not repeat landing-page subheadline.");

includes(dashboard, "const priority = viewModel.priorities[0] ?? null;", "Today's priorities must derive from real priority data.");
includes(dashboard, "No urgent actions right now", "Today's priorities must use a truthful empty state when no real priority exists.");
includes(dashboard, "Challenge Progress", "Dashboard must keep the compact Challenge Progress summary.");
includes(dashboard, "<BrandDashboardChallengeList", "Dashboard must render the shared compact Business Challenge list.");
includes("src/features/dashboard/components/brand-dashboard-challenges.tsx", "md:min-h-[50px]", "Business Challenge rows must be dense work-queue rows.");
includes("src/features/dashboard/components/brand-dashboard-challenges.tsx", "row.solutionsLabel", "Challenge rows must show real solution counts.");
includes("src/features/dashboard/components/brand-dashboard-challenges.tsx", "row.requiredActionDescription", "Challenge rows must show the next action context.");
includes("src/features/dashboard/components/brand-dashboard-challenges.tsx", "inline-flex h-7 items-center justify-center", "Challenge rows must have one compact CTA.");
excludes(dashboard, "overflow-x-auto", "Brand dashboard must not force horizontal scrolling.");
excludes(dashboard, "min-w-[1120px]", "Brand dashboard must not require a wide fixed table.");

includes(dashboard, "RailCard title=\"Wallet Quick Actions\"", "Right rail must include compact Wallet Quick Actions.");
includes(dashboard, "title=\"Recent Activity\"", "Right rail must include compact Recent Activity.");
includes(dashboard, "RailCard title=\"Today's Priorities\"", "Right rail must include compact Today's Priorities.");
includes(viewModel, "solutionCountsByDraft", "Solution counts must derive from real submission notifications.");
includes(viewModel, "waiting for evaluation", "Priorities must be action summaries.");
includes(viewModel, "pluralize(solutionTotal", "Priorities must derive counts, not hardcode examples.");
includes(viewModel, "new solution", "Recent activity must support grouped solution activity.");
excludes(viewModel, "Submissions awaiting review", "Brand-facing notifications must use solution language.");

includes(campaignsPage, "lg:grid-cols-2 2xl:grid-cols-3", "Business challenge index must support dense desktop cards.");
includes(campaignsPage, "aspect-[16/5] max-h-[120px]", "Business challenge cards must be compact.");
includes(campaignsPage, "row.solutionsLabel", "Business challenge cards must show solutions count.");
includes(campaignsPage, "row.rewardLabel", "Business challenge cards must show Top1/Top3 configuration.");
includes(campaignsPage, "brandDashboardFilters.map", "Business challenge index must render locked simplified filters.");
includes(campaignsPage, "brandDashboardFilterMatches(row, filter)", "Business challenge index must use the shared simplified filter matcher.");

includes(navigation, "variant?: \"sidebar\" | \"topbar\"", "Account menu must support compact topbar mode.");
includes(navigation, "Profile", "Account menu must include Profile.");
includes(navigation, "Settings", "Account menu must include Settings.");
includes(navigation, "Company Settings", "Account menu must include Company Settings.");
includes(navigation, "Sign out", "Account menu must include Sign out.");

for (const label of [
  'draft: "Problem Draft"',
  'published: "Open for Solutions"',
  'review: "Evaluation"',
  'winner: "Selection"',
  'settlement: "Settlement"',
]) {
  includes(viewModel, label, `Journey label missing: ${label}`);
}
includes(workspace, '{ id: "published", label: "Open for Solutions" }', "Workspace lifecycle must match Open for Solutions.");
includes(workspace, '{ id: "winner", label: "Selection" }', "Workspace lifecycle must match Selection.");

includes(types, '| "basics"', "Lifecycle/setup ids must not be renamed.");
includes(types, 'publicationStatus: "draft" | "ready-to-publish" | "live"', "Publication enum must not be renamed.");

const changed = execFileSync("git", ["diff", "--name-only"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  .split(/\r?\n/)
  .filter(Boolean);
const restricted = changed.filter((file) =>
  /(^|\/)(contracts|supabase\/migrations|supabase\/operator|public\/.*logo|public\/.*brand)/.test(file) ||
  /src\/services\/(circle|create-challenge\/brand-payment|circle\/.*wallet|.*payout)/.test(file) ||
  /src\/app\/api\/(internal\/circle|create-challenge\/(fund|approve|reconcile|verify|winner-finalization)|dashboard\/finalize-review)/.test(file)
);
assert.deepEqual(restricted, [], "Restricted logo, Creator, financial, wallet, payout, Circle/Arc, schema or migration paths must be untouched.");

const changedText = changed
  .filter((changedFile) => !changedFile.startsWith("scripts/verify-"))
  .map((file) => read(file))
  .join("\n");
for (const fakeMetric of ["12 / 20", "14 qualified", "18 days remaining", "5,000 USDC", "hardcoded production metrics", "Nike", "Coca-Cola", "Adidas", "Red Bull"]) {
  assert.ok(!changedText.includes(fakeMetric), `Verifier detected fake production content: ${fakeMetric}`);
}

console.log(JSON.stringify({
  result: "P0 Brand dashboard UX completion verification passed",
  structure: "work queue",
  topbar: true,
  denseChallengeRows: true,
  giantSummaryRemoved: true,
  restrictedPathsTouched: false
}, null, 2));
