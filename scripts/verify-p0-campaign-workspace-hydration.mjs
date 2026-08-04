import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const tabsPath = "src/features/dashboard/components/campaign-workspace-tabs.tsx";
const workspacePath = "src/features/dashboard/components/campaign-workspace.tsx";
const pagePath = "src/app/dashboard/challenges/[draftId]/page.tsx";
const packagePath = "package.json";

const tabs = read(tabsPath);
const workspace = read(workspacePath);
const page = read(pagePath);
const packageJson = read(packagePath);

function includes(source, text, message) {
  assert.ok(source.includes(text), message);
}

function excludes(source, text, message) {
  assert.ok(!source.includes(text), message);
}

includes(packageJson, '"test:p0-campaign-workspace-hydration"', "package script must expose the hydration verifier.");

includes(tabs, 'const DEFAULT_WORKSPACE_TAB: WorkspaceTab = "overview";', "workspace tabs must declare a deterministic SSR/client default tab.");
includes(tabs, "useState<WorkspaceTab>(DEFAULT_WORKSPACE_TAB)", "active tab state must initialize deterministically.");
excludes(tabs, "useState<WorkspaceTab>(initialTab", "active tab state must not read hash/window during initialization.");
excludes(tabs, "function initialTab()", "legacy render-time initialTab helper must be removed.");

includes(tabs, "function tabFromHash(hash: string, options: { settlementUnlocked: boolean }): WorkspaceTab", "hash parsing must be pure and serializable.");
includes(tabs, "function browserTabFromHash(options: { settlementUnlocked: boolean }): WorkspaceTab", "browser hash reads must be isolated behind an explicit browser-only helper.");
includes(tabs, "return tabFromHash(window.location.hash, options);", "window.location.hash may only be read from the browser-only helper.");
includes(tabs, "useEffect(() => {", "persisted/hash tab restoration must happen after mount.");
includes(tabs, "syncHashTab(setActiveTab, { settlementUnlocked });", "hash tab restoration must run from the mounted effect.");
includes(tabs, "}, [settlementUnlocked]);", "hash restoration must account for settlement tab availability.");
includes(tabs, 'if (value === "settlement" && !options.settlementUnlocked) return DEFAULT_WORKSPACE_TAB;', "locked settlement hashes must not render an empty initial tab.");

const activeTabInitializer = tabs.match(/const \[activeTab, setActiveTab\] = useState<WorkspaceTab>\(([^)]*)\)/);
assert.ok(activeTabInitializer, "active tab state initializer must be present.");
assert.equal(activeTabInitializer[1], "DEFAULT_WORKSPACE_TAB", "server and client first render must agree on the active tab.");

for (const forbidden of ["localStorage", "sessionStorage", "Date.now", "Math.random", "suppressHydrationWarning"]) {
  excludes(tabs, forbidden, `${forbidden} must not participate in tab rendering or hydration.`);
}

includes(tabs, '{ id: "overview", label: "Business Challenge Overview" }', "overview tab must remain available.");
includes(tabs, '{ id: "review", label: "Evaluation" }', "evaluation tab must remain available.");
includes(tabs, '{ id: "funding", label: "Funding" }', "funding tab must remain available.");
includes(tabs, '{ id: "settlement", label: "Settlement" }', "settlement tab must remain available.");
includes(tabs, '{ id: "blockchain", label: "Blockchain" }', "blockchain tab must remain available.");
includes(tabs, "window.history.replaceState(null, \"\", `#${tab.id}`);", "tab click hash behavior must remain intact.");
includes(tabs, 'value === "finalize-review") return "review"', "finalize-review hash must still open Evaluation after hydration.");
includes(tabs, 'activeTab === "review"', "Evaluation content must remain reachable.");
includes(tabs, 'activeTab === "settlement" && settlementUnlocked', "Settlement content must remain gated and reachable.");

includes(tabs, "const [selectedSubmissionId, setSelectedSubmissionId]", "selected solution state must remain local and intact.");
includes(tabs, "const [reviews, setReviews]", "evaluation state must remain local and intact.");
includes(tabs, "function SettlementTab", "settlement tab component must remain present.");
includes(tabs, 'mode: "create-approval"', "payout approval flow must remain unchanged.");
includes(tabs, 'postWinnerFinalization<SettlementRecord>', "settlement requests must continue through existing finalization endpoint.");
includes(tabs, "Initiate PAYOUT Approval", "Approve payout path must remain available.");

includes(workspace, "<CampaignWorkspaceTabs", "parent workspace must continue rendering CampaignWorkspaceTabs.");
includes(page, "<CampaignWorkspace", "route must continue rendering the parent workspace.");

console.log(JSON.stringify({
  result: "P0 campaign workspace hydration verification passed",
  deterministicInitialTab: "overview",
  browserHashRestore: "useEffect",
  storageDuringRender: false,
  suppressHydrationWarning: false,
  evaluationAccessible: true,
  settlementPayoutFlowChanged: false,
}, null, 2));
