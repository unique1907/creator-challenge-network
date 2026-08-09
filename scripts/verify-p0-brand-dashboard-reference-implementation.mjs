import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const dashboardPath = "src/features/dashboard/components/brand-dashboard.tsx";
const challengeListPath = "src/features/dashboard/components/brand-dashboard-challenges.tsx";
const walletQuickActionsPath = "src/features/dashboard/components/brand-wallet-quick-actions.tsx";
const navigationPath = "src/features/dashboard/components/brand-workspace-navigation.tsx";
const workspacePath = "src/features/dashboard/components/campaign-workspace.tsx";

const dashboard = readFileSync(dashboardPath, "utf8");
const challengeList = readFileSync(challengeListPath, "utf8");
const walletQuickActions = readFileSync(walletQuickActionsPath, "utf8");
const navigation = readFileSync(navigationPath, "utf8");
const workspace = readFileSync(workspacePath, "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function indexOfRequired(source, token) {
  const index = source.indexOf(token);
  assert(index >= 0, `Missing required token: ${token}`);
  return index;
}

assert(!dashboard.startsWith('"use client";'), "Dashboard shell must stay server-rendered so server-only data stays out of the client bundle.");
assert(challengeList.startsWith('"use client";'), "Only the filterable challenge list should be an interactive client component.");
assert(challengeList.includes("useState<BrandDashboardFilter>(\"All\")"), "Dashboard filter must initialize deterministically to All.");
assert(challengeList.includes("brandDashboardFilters.map"), "Lifecycle filters must be rendered from the approved filter inventory.");
assert(challengeList.includes("onClick={() => setActiveFilter(filter)}"), "Lifecycle filters must be interactive controls.");
assert(dashboard.includes("w-[224px]"), "Sidebar must use the compact approved desktop width.");
assert(!dashboard.includes("Search business challenges"), "Dashboard header must not show a non-functional search control.");
assert(!dashboard.includes(">Brand Workspace<"), "Dashboard must not use Brand Workspace as the main operational heading.");
assert(!dashboard.includes("Brand account"), "Sidebar account/workspace footer card must be removed from the dashboard.");
assert(walletQuickActions.includes("Wallet Balance"), "Wallet Quick Actions must include the compact balance row.");
assert(!dashboard.includes("on Arc Testnet"), "Header must not move wallet testnet metadata into a replacement wallet card.");
assert(!dashboard.includes("walletChip?.balanceLabel"), "Header must not render wallet balance text.");
assert(dashboard.includes("BrandAccountControls") && navigation.includes("<BrandNotifications notifications={notifications}"), "Header must render the real Brand notification control.");
assert(navigation.includes('variant="topbar"') && navigation.includes("h-8 w-8"), "Header must render the compact Brand profile control.");
assert(dashboard.includes("<AiTemplatesBetaButton variant=\"compact\" />"), "Sidebar must restore the existing AI Templates placeholder control.");
assert(dashboard.includes('label: "Analytics", href: null'), "Sidebar Analytics must be present without broken navigation.");
assert(dashboard.includes('aria-disabled="true"'), "Missing Analytics route must use disabled placeholder behavior.");
assert(dashboard.includes("How to send your first draft"), "Sidebar tutorial card must use the exact required title.");
assert(dashboard.includes("Learn how to create and submit your first draft step by step."), "Sidebar tutorial card must use the exact required supporting copy.");
assert(dashboard.includes("Watch Tutorial"), "Sidebar tutorial card must use the exact required CTA.");
assert(dashboard.includes("https://www.youtube.com/watch?v=BG0sHuTqGRc"), "Sidebar tutorial card must use the exact required YouTube URL.");
assert(dashboard.includes('target="_blank"'), "Sidebar tutorial card must open in a new tab.");
assert(dashboard.includes('rel="noopener noreferrer"'), "Sidebar tutorial card must use safe external-link rel attributes.");

assert(navigation.includes("h-9 w-9"), "Brand notification button must use compact Creator-style sizing.");
assert(navigation.includes("h-8 w-8"), "Brand profile avatar must use compact circular sizing.");
assert(navigation.includes("realBrandName || safeName"), "Profile dropdown must prefer real Brand name and fall back to authenticated account identity.");
assert(!navigation.includes("Brand name not set"), "Profile dropdown must not fabricate a missing company name.");
assert(!navigation.includes("CCN Creator Challenge Network"), "Profile dropdown must not use the product name as Brand identity.");
assert(!navigation.includes('href="/dashboard/wallet"'), "Profile dropdown must not duplicate Wallet because Wallet remains in the sidebar.");

for (const label of [
  "Dashboard",
  "Business Challenges",
  "Wallet",
  "Payments",
  "Analytics",
  "Settings",
  "YOUR NEXT ACTION",
  "Challenge Progress",
  "Wallet Quick Actions",
  "Recent Activity",
  "Today's Priorities",
]) {
  const present = dashboard.includes(label) || navigation.includes(label);
  assert(present, `Dashboard is missing required visible label: ${label}`);
}

const sidebarOrder = [
  'label: "Dashboard"',
  'label: "Business Challenges"',
  'label: "Wallet"',
  'label: "Payments"',
  'label: "Analytics"',
  'label: "Settings"',
].map((token) => indexOfRequired(dashboard, token));
assert(
  sidebarOrder.every((index, position) => position === 0 || sidebarOrder[position - 1] < index),
  "Sidebar nav item declarations must preserve Dashboard, Business Challenges, Wallet, Payments, Analytics, Settings.",
);
assert(
  dashboard.includes('navItems.map((item) => (\n          <SidebarNavRow key={item.label} item={item} />\n        ))}\n        <AiTemplatesBetaButton variant="compact" />\n        {secondaryNavItems.map((item) => ('),
  "Sidebar render order must place AI Templates between Payments and Analytics.",
);

for (const forbidden of ["Templates", "Team", "Archived"]) {
  const inDashboard = dashboard.includes(`"${forbidden}"`) || dashboard.includes(`>${forbidden}<`);
  const inChallengeList = challengeList.includes(`"${forbidden}"`) || challengeList.includes(`>${forbidden}<`);
  assert(!inDashboard && !inChallengeList, `Dashboard includes forbidden navigation/filter item: ${forbidden}`);
}

for (const cta of ["Continue Draft", "Complete Funding", "Review Solutions", "Finalize Selection", "Approve Payout", "View Outcome"]) {
  assert(dashboard.includes(cta) || challengeList.includes(cta), `Dashboard is missing lifecycle-specific CTA: ${cta}`);
}

assert(!dashboard.includes(">Open<") && !challengeList.includes(">Open<"), "Dashboard rows must not use detached generic Open actions.");
assert(!dashboard.includes("Business Problem -> Business Challenge"), "Dashboard must not preserve the old process-copy section.");

const walletIndex = indexOfRequired(dashboard, "function WalletQuickActions");
const activityIndex = indexOfRequired(dashboard, "function RecentActivity");
const prioritiesIndex = indexOfRequired(dashboard, "function TodaysPriorities");
const arcIndex = indexOfRequired(dashboard, "function ArcCircleCard");
assert(walletIndex < activityIndex, "Right rail order must place Wallet Quick Actions before Recent Activity.");
assert(activityIndex < prioritiesIndex, "Today's Priorities must remain directly below Recent Activity.");
assert(prioritiesIndex < arcIndex, "Optional Arc/Circle card must remain after Today's Priorities.");

const rowFunctionStart = indexOfRequired(challengeList, "function ChallengeRow");
const thumbStart = indexOfRequired(challengeList, "function ChallengeThumb");
const rowSource = challengeList.slice(rowFunctionStart, thumbStart);
assert(!rowSource.includes("absolute"), "Challenge row actions must not use absolute positioning.");
assert(rowSource.includes("grid") && rowSource.includes("md:grid-cols"), "Challenge rows must use dense aligned row layout.");

for (const route of ["/dashboard/campaigns", "/dashboard/wallet", "/dashboard/payments", "/dashboard/settings"]) {
  assert(dashboard.includes(route), `Dashboard navigation is missing route: ${route}`);
}

assert(workspace.includes("Problem Draft"), "Full Challenge Progress must remain available in Challenge Detail.");
assert(workspace.includes("Open for Solutions"), "Challenge Detail lifecycle must remain intact.");
assert(workspace.includes("Settlement"), "Challenge Detail settlement lifecycle must remain intact.");

const changedFiles = execFileSync("git", ["diff", "--name-only"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);
const forbiddenRuntimePrefixes = [
  "contracts/",
  "supabase/",
  "src/app/api/internal/circle/",
  "src/app/api/create-challenge/fund/",
  "src/app/api/create-challenge/approve/",
  "src/app/api/create-challenge/reconcile/",
  "src/app/api/create-challenge/verify/",
  "src/app/api/create-challenge/winner-finalization/",
  "src/app/api/dashboard/finalize-review/",
  "src/services/circle/",
  "src/services/payout/",
  "src/features/creator/",
];
for (const file of changedFiles) {
  assert(
    !forbiddenRuntimePrefixes.some((prefix) => file.startsWith(prefix)),
    `Forbidden frozen-system file changed: ${file}`,
  );
}

console.log("P0 Brand Dashboard reference implementation verifier passed.");
