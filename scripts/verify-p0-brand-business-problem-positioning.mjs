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
const dashboardViewModel = "src/features/dashboard/brand-dashboard-view-model.ts";
const workspace = "src/features/dashboard/components/campaign-workspace.tsx";
const workspaceTabs = "src/features/dashboard/components/campaign-workspace-tabs.tsx";
const campaignsPage = "src/app/dashboard/campaigns/page.tsx";
const walletPage = "src/app/dashboard/wallet/page.tsx";
const createPage = "src/app/create-challenge/page.tsx";
const wizard = "src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx";
const stepData = "src/features/create-challenge/data/demo-draft.ts";
const types = "src/types/create-challenge.ts";

for (const file of [dashboard, dashboardViewModel, workspace, workspaceTabs, campaignsPage, walletPage, createPage, wizard, stepData, types]) {
  exists(file);
}

excludes(dashboard, "Discover the World&apos;s Best Ideas.", "Dashboard must not repeat landing-page hero positioning.");
excludes(dashboard, "Turn business problems into winning solutions.", "Dashboard must not repeat landing-page subheadline.");
includes(dashboardViewModel, "Turn your next business problem into a globally sourced solution.", "Brand welcome copy must frame business problems.");
includes(wizard, "Launch a business challenge, receive solutions from a global network of AI-augmented creators, and reward the best outcome.", "Create flow must include locked supporting copy.");

includes(dashboard, "New Business Challenge", "Brand dashboard primary CTA must say New Business Challenge.");
includes(campaignsPage, "+ New Business Challenge", "Campaign list CTA must say New Business Challenge.");
includes(walletPage, "+ New Business Challenge", "Wallet page CTA must say New Business Challenge.");
includes(dashboard, "Business Problem -&gt; Business Challenge -&gt; Solution Proposals -&gt; Evaluation -&gt; Selection -&gt; Settlement", "Dashboard must use the locked lifecycle language.");
includes(dashboard, "priorities.length ? <Priorities", "Dashboard must use real-data priorities instead of a giant hero.");
excludes(dashboard, "ActiveBusinessChallenge", "Dashboard must not preserve the rejected active challenge card.");
excludes(dashboard, "Solution Journey", "Dashboard must not preserve the rejected journey card.");
includes(workspaceTabs, "Business Challenge Overview", "Workspace overview tab must use business challenge terminology.");
includes(dashboard, "Business Challenges", "Dashboard campaign section must be renamed.");
includes(dashboard, "/dashboard/campaigns", "Dashboard all-challenges navigation must remain business-challenge oriented.");

includes(dashboardViewModel, 'draft: "Problem Draft"', "Journey draft display label must become Problem Draft.");
includes(dashboardViewModel, 'published: "Open for Solutions"', "Journey published display label must become Open for Solutions.");
includes(dashboardViewModel, 'review: "Evaluation"', "Journey review display label must become Evaluation.");
includes(dashboardViewModel, 'winner: "Selection"', "Journey winner display label must become Selection.");
includes(dashboardViewModel, 'settlement: "Settlement"', "Journey settlement display label must remain Settlement.");
includes(dashboardViewModel, "Solutions ready for evaluation", "Ready for review copy must become solution evaluation copy.");
includes(dashboardViewModel, "Evaluate Solutions", "Primary review action must become Evaluate Solutions.");
includes(workspace, "Evaluate Solutions", "Workspace review action must become Evaluate Solutions.");
includes(workspaceTabs, "Blind evaluation", "Blind review concept may remain as secondary blind evaluation copy.");

includes(createPage, "Start a Business Challenge", "Create page title/label must use business challenge framing.");
includes(wizard, "Start a Business Challenge", "Create wizard must show Start a Business Challenge.");
includes(wizard, "What business problem are you trying to solve?", "Create entry must ask the business problem question.");
includes(wizard, "Describe the outcome you need - not just the asset you expect.", "Create entry must explain outcome over asset.");
includes(wizard, "We opened our first coffee shop, but customer traffic is below expectations.", "Create entry must include the coffee shop example.");
includes(wizard, "<FormLabel required>Business Domain</FormLabel>", "Wizard category label must become Business Domain.");
includes(wizard, '"Brand Awareness"', "Business Domain options must include Brand Awareness.");
includes(wizard, '"Customer Growth"', "Business Domain options must include Customer Growth.");
includes(wizard, '"Operations"', "Business Domain options must include Operations.");
includes(wizard, 'label="Expected Outcome" required', "Wizard must include required Expected Outcome field.");
includes(wizard, "Describe the business result you want to achieve.", "Expected Outcome helper text must be present.");
includes(wizard, "Increase weekday customer traffic by 40%.", "Expected Outcome placeholder example must be business-result oriented.");
includes(wizard, "Business Challenge Cover", "Campaign Cover must become Business Challenge Cover.");
includes(wizard, "selected solution receives the reward", "Winning submission copy must become selected solution copy.");
excludes(wizard, 'label="Solution proposal"', "Brands must not define a Solution Proposal field.");
excludes(wizard, "Create a short animated campaign concept", "Wizard placeholders must not reference animated campaigns.");
excludes(wizard, "Motion Design", "Business Domain options must not use creative asset types.");
excludes(wizard, "Graphic Design", "Business Domain options must not use creative asset types.");
excludes(wizard, "Solution proposal with", "Wizard placeholders must not ask Brands for solution proposals.");
includes(stepData, 'id: "basics"', "Create step id must remain basics.");
includes(stepData, 'id: "publish"', "Create step id must remain publish.");

includes(types, '| "basics"', "CreateChallengeStepId contract must not be renamed.");
includes(types, 'publicationStatus: "draft" | "ready-to-publish" | "live"', "Publication status enum must not be renamed.");
includes(types, 'currentStep: CreateChallengeStepId', "Deployment currentStep contract must remain typed.");

const changed = execFileSync("git", ["diff", "--name-only"], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
})
  .split(/\r?\n/)
  .filter(Boolean);
const restricted = changed.filter((file) =>
  /(^|\/)(contracts|supabase\/migrations|supabase\/operator)\//.test(file) ||
  /src\/services\/(circle|create-challenge\/.*fund|create-challenge\/brand-payment|circle\/.*wallet|.*payout)/.test(file) ||
  /src\/app\/api\/(internal\/circle|create-challenge\/(fund|approve|reconcile|verify|winner-finalization)|dashboard\/finalize-review)/.test(file),
);
assert.deepEqual(restricted, [], "Financial, wallet, payout, Arc/Circle, schema and migration files must be untouched.");

const historicalTitle = "Redesign a Next-Generation Mobile Banking Experience";
for (const file of changed.filter((changedFile) => changedFile !== "scripts/verify-p0-brand-business-problem-positioning.mjs")) {
  assert.ok(!read(file).includes(historicalTitle), "Positioning copy change must not rewrite the historical Mobile Banking title.");
}

const unsafeGlobalFiles = changed.filter((file) =>
  ![
    "package.json",
    dashboard,
    dashboardViewModel,
    workspace,
    workspaceTabs,
    campaignsPage,
    walletPage,
    createPage,
    wizard,
    stepData,
    "scripts/verify-p0-brand-business-problem-positioning.mjs",
    "scripts/verify-p0-brand-dashboard-ux-completion.mjs",
    "scripts/verify-p0-brand-final-ux-consolidation.mjs",
    "scripts/verify-role-isolation.mjs",
    "scripts/verify-ux-02a-brand-dashboard.mjs",
    "scripts/verify-form-label-standard.mjs",
    "scripts/verify-fast-brand-publish-pipeline.mjs",
    "scripts/verify-p0-brand-challenge-form-resilience.mjs",
    "scripts/verify-p0-new-challenge-entry.mjs",
    "src/utils/create-challenge-launch-readiness.ts",
    "src/app/dashboard/payments/page.tsx",
    "src/app/dashboard/settings/page.tsx",
    "src/features/dashboard/brand-dashboard-data.server.ts",
    "src/features/dashboard/components/brand-workspace-navigation.tsx",
    "P0_BRAND_FINAL_UX_CONSOLIDATION_REPORT.md",
    "P0_BRAND_WORKSPACE_RESTRUCTURE_REPORT.md",
  ].includes(file),
);
assert.deepEqual(unsafeGlobalFiles, [], "Unexpected files changed, possible unsafe global replacement.");

console.log(JSON.stringify({
  result: "P0 Brand business-problem positioning verification passed",
  lockedPositioning: true,
  primaryCta: "New Business Challenge",
  dashboardPrompt: "What business problem are you trying to solve?",
  lifecycleEnumsRenamed: false,
  restrictedFinancialWalletPathsTouched: false,
  historicalTitlePreserved: true,
}, null, 2));
