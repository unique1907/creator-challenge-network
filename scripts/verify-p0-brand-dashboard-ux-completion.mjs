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
includes(dashboard, "AiTemplatesBetaButton", "AI Templates entry must remain present.");
includes(dashboard, "CCNLogo", "Canonical CCN logo component must remain in use.");

includes(dashboard, "Welcome back", "Dashboard header must keep the operational greeting.");
includes(dashboard, "viewModel.primaryMessage", "Dashboard header must keep the operational supporting line.");
excludes(dashboard, "Discover the World&apos;s Best Ideas.", "Dashboard must remove repeated marketing line.");
excludes(dashboard, "Turn business problems into winning solutions.", "Dashboard must remove repeated marketing subline.");

includes(dashboard, "Active Business Challenge", "Active card must use active business challenge hierarchy.");
includes(dashboard, "New Solution Received", "Active attention language must be solution-oriented.");
excludes(dashboard, "New submission received", "Submission must not be Brand-visible in active action language.");
excludes(dashboard, "Business Challenge Identity", "Active card must not render dense identity/debug table.");
includes(dashboard, "Business Problem", "Active card must show Business Problem label.");
includes(dashboard, "Required Action", "Active card must show Required Action label.");
includes(dashboard, "campaign.requiredActionDescription", "Required Action must be a descriptive next action, not the lifecycle label.");
includes(dashboard, "Brief incomplete", "Missing brief fields must be grouped.");
includes(dashboard, "Add problem summary, goal, expected outcome and deadline.", "Grouped missing-field notice must name the missing brief fields.");
excludes(dashboard, "Goal not set yet", "Missing goal must not be rendered as a repeated row.");
excludes(dashboard, "Expected outcome not set yet", "Missing outcome must not be rendered as a repeated row.");
excludes(dashboard, "Deadline not set", "Missing deadline must not be rendered as a repeated row.");
excludes(dashboard, "Problem summary unavailable", "Long problem fallback must not repeat across compact states.");
excludes(dashboard, "Reward unavailable", "Long reward fallback must not repeat across compact states.");
excludes(dashboard, "Deadline unavailable", "Long deadline fallback must not repeat across compact states.");
excludes(viewModel, "Reward unavailable", "Long reward fallback must not be used.");
excludes(viewModel, "Deadline unavailable", "Long deadline fallback must not be used.");

includes(viewModel, "return \"—\";", "Compact missing values must use restrained dash presentation.");
excludes(viewModel, "return draft.title.trim();", "Business problem fallback must never repeat the challenge title.");
includes(viewModel, "requiredActionDescription", "View model must expose descriptive required action copy.");
includes(viewModel, "goalLabel", "Active challenge must support Goal when semantically available.");
includes(viewModel, "expectedOutcomeLabel", "Active challenge must support Expected Outcome when semantically available.");
includes(dashboard, "campaign.hasGoal", "Active card must avoid layout breakage when Goal is unavailable.");
includes(dashboard, "campaign.hasExpectedOutcome", "Active card must avoid layout breakage when Expected Outcome is unavailable.");
includes(dashboard, "MetricCard", "Reward, funding, deadline and solutions must be grouped as compact metrics.");
includes(viewModel, "solutionCountsByDraft", "Solution counts must derive from real submission notifications.");
includes(viewModel, "waiting for evaluation", "Priorities must be action summaries.");
includes(viewModel, "pluralize(solutionTotal", "Priorities must derive counts, not hardcode examples.");
includes(viewModel, "new solution", "Recent activity must support grouped solution activity.");
excludes(viewModel, "Submissions awaiting review", "Brand-facing notifications must use solution language.");

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

for (const column of ["Challenge", "Problem", "Reward", "Solutions", "Deadline", "Status"]) {
  includes(dashboard, `>${column}<`, `Business Challenge table missing column: ${column}`);
}
excludes(dashboard, "row.progressPercent", "Business Challenge rows must not render dominant lifecycle progress bars.");
excludes(dashboard, "row.progressLabel", "Business Challenge rows must not render lifecycle progress labels.");
includes(dashboard, "row.rewardLabel", "Challenge list must show reward state.");
includes(dashboard, "row.solutionsLabel", "Challenge list must show solutions count.");
includes(dashboard, "row.deadlineLabel", "Challenge list must show deadline state.");
includes(campaignsPage, "filterSlug(filter)", "Business challenge filters must handle URL-safe labels.");
includes(campaignsPage, 'filter === "Open for Solutions"', "Business challenge index must filter Open for Solutions.");
includes(campaignsPage, 'filter === "Evaluation"', "Business challenge index must filter Evaluation.");

includes(dashboard, "Today&apos;s Priorities", "Right rail must include today's priorities.");
includes(dashboard, "item.ctaLabel", "Priority rows must have concise CTAs.");
includes(dashboard, "Recent Activity", "Right rail recent activity must remain.");
includes(dashboard, "Wallet Quick Actions", "Wallet quick actions must remain functional.");
includes(viewModel, '{ label: "Transactions", detail: "Payment evidence", available: true, href: "/dashboard/payments" }', "Transactions wallet action must remain functional.");
includes(viewModel, '{ label: "Payment Account", detail: "Brand wallet", available: true, href: "/dashboard/wallet" }', "Payment account wallet action must remain functional.");

includes(types, '| "basics"', "Lifecycle/setup ids must not be renamed.");
includes(types, 'publicationStatus: "draft" | "ready-to-publish" | "live"', "Publication enum must not be renamed.");

const changed = execFileSync("git", ["diff", "--name-only"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  .split(/\r?\n/)
  .filter(Boolean);
const restricted = changed.filter((file) =>
  /(^|\/)(contracts|supabase\/migrations|supabase\/operator|public\/.*logo|public\/.*brand)/.test(file) ||
  /src\/services\/(circle|create-challenge\/.*fund|create-challenge\/brand-payment|circle\/.*wallet|.*payout)/.test(file) ||
  /src\/app\/api\/(internal\/circle|create-challenge\/(fund|approve|reconcile|verify|winner-finalization)|dashboard\/finalize-review)/.test(file) ||
  /src\/features\/creator|src\/app\/dashboard\/creator/.test(file)
);
assert.deepEqual(restricted, [], "Restricted logo, Creator, financial, wallet, payout, Circle/Arc, schema or migration paths must be untouched.");

const changedText = changed
  .filter((changedFile) => changedFile !== "scripts/verify-p0-brand-dashboard-ux-completion.mjs")
  .map((file) => read(file))
  .join("\n");
for (const fakeMetric of ["12 / 20", "14 qualified", "18 days remaining", "5,000 USDC", "hardcoded production metrics"]) {
  assert.ok(!changedText.includes(fakeMetric), `Verifier detected fake production metric: ${fakeMetric}`);
}

console.log(JSON.stringify({
  result: "P0 Brand dashboard visual acceptance correction verification passed",
  cleanHeader: true,
  activeCard: "balanced operational layout",
  businessProblemFallback: "-",
  missingData: "grouped brief notice",
  challengeList: ["Challenge", "Problem", "Reward", "Solutions", "Deadline", "Status"],
  rowProgressBarsRemoved: true,
  restrictedPathsTouched: false
}, null, 2));
