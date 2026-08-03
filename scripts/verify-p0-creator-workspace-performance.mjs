import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const includes = (file, text, message) => assert.ok(read(file).includes(text), message);
const excludes = (file, text, message) => assert.ok(!read(file).includes(text), message);

const layout = "src/app/dashboard/creator/layout.tsx";
const loading = "src/app/dashboard/creator/loading.tsx";
const shell = "src/features/creator-workspace/components/creator-workspace.tsx";
const nav = "src/features/creator-workspace/components/creator-workspace-nav.tsx";
const service = "src/services/creator-workspace/creator-workspace.server.ts";
const session = "src/services/creator-session.server.ts";
const discoverRoute = "src/app/dashboard/creator/discover/page.tsx";
const walletRoute = "src/app/dashboard/creator/wallet/page.tsx";
const overviewRoute = "src/app/dashboard/creator/page.tsx";

for (const file of [layout, loading, shell, nav, service, session, discoverRoute, walletRoute, overviewRoute]) {
  assert.ok(fs.existsSync(path.join(root, file)), `${file} must exist`);
}

includes(layout, "CreatorWorkspaceShell", "Creator routes must use a persistent layout shell.");
includes(layout, "{children}", "Persistent shell layout must preserve nested route content.");
includes(layout, "getCreatorSession", "Persistent shell must still resolve Creator auth server-side.");
includes(layout, "measureCreatorPerformance", "Shell session resolution must be timed in development.");
includes(nav, "usePathname", "Creator nav must derive active route client-side while layout persists.");
includes(nav, "prefetch", "Creator nav links should prefetch destination routes.");
includes(nav, 'href: "/dashboard/creator/discover"', "Creator nav must include Discover.");
includes(nav, 'href: "/dashboard/creator/submissions"', "Creator nav must include My Submissions.");
includes(nav, 'href: "/dashboard/creator/wallet"', "Creator nav must include Wallet.");
includes(shell, "<CreatorWorkspaceNav />", "Creator shell must render the route-aware nav.");
excludes(shell, "active=", "Creator pages must not mount separate active shells per route.");
includes(loading, "Preparing Creator overview", "Loading UI must be route-aware and content-shaped.");
includes(loading, 'aria-label="Preparing Creator overview"', "Loading UI must not imply the full workspace disappeared.");
excludes(loading, "min-h-screen bg-[#050916]", "Loading UI must not replace the full workspace shell.");
includes(service, "measureCreatorPerformance", "Creator service must expose safe development timing.");
includes(service, "[creator-performance]", "Timing logs must use the required prefix.");
includes(session, "cache(async function getCreatorSession", "Creator session resolution must be request-cached.");
includes(service, "cache(async function listDrafts", "Draft listing must be request-cached.");
includes(service, "listCreatorEligiblePublicDraftsFromDrafts(drafts)", "Overview must reuse already-loaded drafts instead of listing twice.");
excludes(service, "getPublishedCreateChallengeDraftBySlug", "Creator discovery must avoid repeated per-record public resolution.");
excludes(service, "markers.includes", "Creator eligibility must not depend on title text such as Demo/Test/Deneme.");
excludes(service, "draft.challenge.isSmokeTest === true", "Creator eligibility must not reject smoke challenges by flag when canonical state is valid.");
includes(discoverRoute, "listCreatorDiscoverableChallenges", "Discover route must load only discoverable challenges.");
excludes(discoverRoute, "getCreatorWorkspaceOverview", "Discover route must not load the full overview model.");
includes(walletRoute, "getCreatorWalletSummary", "Wallet route must load only wallet summary.");
excludes(walletRoute, "getCreatorWorkspaceOverview", "Wallet route must not load the full overview model.");
includes(overviewRoute, "getCreatorWorkspaceOverview", "Overview route may load the overview model.");
excludes(shell, "/submit/", "Creator shell must not expose legacy /submit routes.");

console.log("P0 Creator workspace performance verification passed.");
