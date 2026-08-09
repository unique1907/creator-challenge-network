import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const includes = (file, text, message) => assert.ok(read(file).includes(text), message);
const excludes = (file, text, message) => assert.ok(!read(file).includes(text), message);

const dashboard = "src/features/dashboard/components/brand-dashboard.tsx";
const viewModel = "src/features/dashboard/brand-dashboard-view-model.ts";
const navigation = "src/features/dashboard/components/brand-workspace-navigation.tsx";
const campaignsPage = "src/app/dashboard/campaigns/page.tsx";
const walletPage = "src/app/dashboard/wallet/page.tsx";
const paymentsPage = "src/app/dashboard/payments/page.tsx";
const settingsPage = "src/app/dashboard/settings/page.tsx";
const dataHelper = "src/features/dashboard/brand-dashboard-data.server.ts";
const packageJson = "package.json";

for (const file of [dashboard, viewModel, navigation, campaignsPage, walletPage, paymentsPage, settingsPage, dataHelper, packageJson]) {
  assert.ok(fs.existsSync(path.join(root, file)), `${file} must exist`);
}

includes(packageJson, "\"test:p0-brand-final-ux-consolidation\"", "package script must expose final Brand UX verifier");

includes(viewModel, "Turn your next business problem into a globally sourced solution.", "Dashboard must keep locked subheadline positioning");
includes(dashboard, "TopBar", "Dashboard must replace the old hero with a compact top bar");
includes(dashboard, "Brand Workspace", "Dashboard must lead with a work-oriented title");
includes(dashboard, "Business Problem -&gt; Business Challenge -&gt; Solution Proposals -&gt; Evaluation -&gt; Selection -&gt; Settlement", "Dashboard must use locked lifecycle language");
includes(dashboard, "Business Challenges", "Dashboard must use Business Challenges label");
includes(dashboard, "RailCard title=\"Wallet\"", "Right rail must include a small Wallet card");
includes(dashboard, "RailCard title=\"Payments\"", "Right rail must include a small Payments card");
includes(dashboard, "RailCard title=\"Recent activity\"", "Right rail must include a small Recent activity card");
includes(dashboard, "w-[248px]", "Sidebar must use the compact final width");
includes(dashboard, "lg:grid-cols-[minmax(0,0.7fr)_minmax(300px,0.3fr)]", "Dashboard must use the requested 70/30 structure");
includes(dashboard, "md:grid-cols-[44px_minmax(190px,1fr)_120px_72px_90px_86px_minmax(150px,0.9fr)_132px]", "Dashboard challenge rows must avoid forced horizontal scrolling");
excludes(dashboard, "overflow-x-auto", "Brand dashboard must not force horizontal scrolling");
excludes(dashboard, "min-w-[1120px]", "Brand dashboard must not require a wide fixed table");
excludes(dashboard, "New submission received", "Brand-facing copy must use solution language");
excludes(dashboard, "Campaign Journey", "Brand-facing dashboard must not use Campaign Journey");
excludes(dashboard, "ActiveBusinessChallenge", "Rejected giant active challenge card must be removed");
excludes(dashboard, "BrandNotifications", "Rejected giant notification control must be removed");

includes(viewModel, "Solutions ready for evaluation", "View model must use solution language for evaluation state");
includes(viewModel, "No business challenges yet", "Empty health state must use Business Challenge language");
includes(viewModel, "{ label: \"Payments\", detail: \"Funding and settlement\", available: true, href: \"/dashboard/payments\" }", "Quick action must use Brand-readable payments language");
includes(viewModel, "{ label: \"Wallet\", detail: \"Testnet balance\", available: true, href: \"/dashboard/wallet\" }", "Quick action must use Brand-readable wallet language");
includes(viewModel, "label: \"Fund\"", "Funding quick action must be compact");
includes(dataHelper, "Untitled business challenge", "Submission notifications must not fall back to Untitled campaign");

includes(navigation, "Profile", "Account menu must include Profile");
includes(navigation, "Wallet", "Account menu must include Wallet");
includes(navigation, "Settings", "Account menu must include Settings");
includes(navigation, "Sign out", "Account menu must include Sign out");
includes(navigation, "variant?: \"sidebar\" | \"topbar\"", "Account menu must support topbar placement");
includes(navigation, "business challenge briefs", "AI Templates copy must use business challenge language");
excludes(navigation, "campaign briefs", "AI Templates must not use campaign brief language");
excludes(navigation, "Derived from current campaign state", "Action Center must hide technical campaign-state wording");
excludes(navigation, "No campaign actions are waiting.", "Empty notification state must use Business Challenge language");

includes(campaignsPage, "Track each business problem from draft through solution selection and settlement.", "Business Challenges index must explain Brand value clearly");
includes(campaignsPage, "md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4", "Business Challenge index must support dense desktop cards");
includes(campaignsPage, "aspect-[16/5]", "Business Challenge cards must be compact");
excludes(campaignsPage, "absolute right-4 top-4", "Status badges must not overlay cover images");
includes(campaignsPage, "row.solutionsLabel", "Business Challenge cards must show real solution counts");
includes(campaignsPage, "row.rewardLabel", "Business Challenge cards must show real reward/winner configuration");

includes(walletPage, "testnet USDC wallet", "Wallet page must be understandable to a Brand user");
includes(walletPage, "No real funds are shown on this page.", "Wallet page must clearly communicate testnet status");
includes(walletPage, "<details", "Wallet technical details must be secondary");
excludes(walletPage, "BRAND:PAYMENT", "Wallet page must not foreground internal purpose codes");
excludes(walletPage, "Canonical Brand PAYMENT", "Wallet page must not lead with implementation language");

includes(paymentsPage, "listCreateChallengeDraftStates", "Payments must use real challenge state");
includes(paymentsPage, "listWinnerFinalizationAttempts", "Payments must use real winner finalization attempts");
includes(paymentsPage, "Challenge Funding", "Payments must show funding context");
includes(paymentsPage, "Selected Solution Settlement", "Payments must show settlement context");
includes(paymentsPage, "Arc Testnet uses test USDC only.", "Payments must communicate testnet status");
excludes(paymentsPage, "fabricating a wallet ledger", "Payments copy must not describe internal anti-fake implementation notes");
excludes(paymentsPage, "Campaign Workspace", "Payments page must not use obsolete campaign workspace label");

includes(settingsPage, "Brand profile, company identity, account access, and payment context", "Settings must be Brand-account oriented");
includes(settingsPage, "Profile", "Settings must include profile controls");
includes(settingsPage, "Company", "Settings must include company controls");
includes(settingsPage, "Account Access", "Settings must include account access");
includes(settingsPage, "Notifications", "Settings must include notifications");
includes(settingsPage, "Network", "Settings must include network");
includes(settingsPage, "AI Templates (BETA)", "AI Templates beta context must remain available");
excludes(settingsPage, "Derived from campaign state", "Settings must not expose implementation notification details");
excludes(settingsPage, "Provider", "Settings must not foreground auth provider internals");

const changed = execFileSync("git", ["diff", "--name-only"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  .split(/\r?\n/)
  .filter(Boolean);
const restricted = changed.filter((file) =>
  /(^|\/)(contracts|supabase\/migrations|supabase\/operator)/.test(file) ||
  /src\/services\/(circle|create-challenge\/.*fund|create-challenge\/brand-payment|.*payout)/.test(file) ||
  /src\/app\/api\/(internal\/circle|create-challenge\/(fund|approve|reconcile|verify|winner-finalization)|dashboard\/finalize-review)/.test(file) ||
  /src\/features\/creator|src\/app\/dashboard\/creator/.test(file)
);
assert.deepEqual(restricted, [], "Final Brand UX consolidation must not touch restricted Creator, schema, funding, payout, Circle or Arc logic paths.");

const changedText = changed
  .filter((file) => !file.startsWith("scripts/verify-"))
  .map((file) => read(file))
  .join("\n");
for (const fake of ["Nike", "Coca-Cola", "Adidas", "Red Bull", "12 / 20", "5,000 USDC", "hardcoded production metrics"]) {
  assert.ok(!changedText.includes(fake), `No fake demo content may be introduced or retained in changed files: ${fake}`);
}

console.log(JSON.stringify({
  result: "P0 Brand final UX consolidation verification passed",
  functionalLogicChanged: false,
  brandSurfaces: ["dashboard", "business challenges", "wallet", "payments", "settings", "account menu"],
  manualVisualAcceptance: "required before commit"
}, null, 2));
