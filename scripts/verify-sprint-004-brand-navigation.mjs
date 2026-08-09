import { existsSync, readFileSync } from "node:fs";

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

function exists(path, message) {
  assert(existsSync(path), message);
}

const dashboard = "src/features/dashboard/components/brand-dashboard.tsx";
const workspace = "src/features/dashboard/components/campaign-workspace.tsx";
const nav = "src/features/dashboard/components/brand-workspace-navigation.tsx";
const viewModel = "src/features/dashboard/brand-dashboard-view-model.ts";
const pkg = "package.json";

[
  "src/app/dashboard/campaigns/page.tsx",
  "src/app/dashboard/wallet/page.tsx",
  "src/app/dashboard/payments/page.tsx",
  "src/app/dashboard/settings/page.tsx",
  "src/app/dashboard/settings/profile/page.tsx",
  "src/app/dashboard/settings/company/page.tsx",
].forEach((path) => exists(path, `${path} must exist`));

includes(dashboard, 'label: "Dashboard", href: "/dashboard"', "Dashboard sidebar must target dashboard route");
includes(dashboard, 'label: "Business Challenges", href: "/dashboard/campaigns"', "Business Challenges sidebar must target campaigns route");
includes(dashboard, 'label: "Wallet", href: "/dashboard/wallet"', "Wallet sidebar must target wallet route");
includes(dashboard, 'label: "Payments", href: "/dashboard/payments"', "Payments sidebar must target payments route");
includes(dashboard, 'label: "Analytics", href: null', "Analytics sidebar item must be disabled when no route exists");
includes(dashboard, 'label: "Settings", href: "/dashboard/settings"', "Settings must target workspace settings landing");
includes(dashboard, '<AiTemplatesBetaButton variant="compact" />', "Dashboard sidebar must use compact AI Templates Beta button");
includes(dashboard, '<BrandAccountControls', "Dashboard header must use shared compact account controls");
includes(nav, '<BrandAccountMenu', "Shared Brand account controls must include compact account menu");
assert(!read(dashboard).includes("Brand account"), "Dashboard sidebar must not restore bottom-left account card");
assert(!read(dashboard).includes("walletChip?.balanceLabel"), "Dashboard header must not restore wallet balance card");
includes(dashboard, "How to send your first draft", "Dashboard sidebar must include tutorial title");
includes(dashboard, "Watch Tutorial", "Dashboard sidebar must include tutorial CTA");
includes(dashboard, "https://www.youtube.com/watch?v=BG0sHuTqGRc", "Dashboard sidebar must include tutorial URL");
includes(dashboard, 'target="_blank"', "Tutorial link must open in a new tab");
includes(dashboard, 'rel="noopener noreferrer"', "Tutorial link must be safe");
includes(dashboard, 'const NEW_DRAFT_HREF = "/create-challenge?new=1";', "New Challenge must use explicit new-draft entry");
includes(dashboard, "href={NEW_DRAFT_HREF}", "New Challenge shortcut must use the explicit new-draft route constant");
includes(dashboard, 'href="/dashboard/campaigns"', "View all business challenges must use campaigns route");

includes(workspace, 'href: "/dashboard/campaigns"', "Workspace Campaigns nav must target campaigns route");
includes(workspace, 'href: "/dashboard/wallet"', "Workspace Wallet nav must target wallet route");
includes(workspace, 'href: "/dashboard/payments"', "Workspace Payments nav must target payments route");
includes(workspace, '<AiTemplatesBetaButton />', "Workspace must use AI Templates Beta button");
assert(!read(workspace).includes('href={item === "Dashboard" ? "/dashboard" : "#"}'), "Workspace sidebar must not use dead # nav fallback");

includes(nav, 'aria-haspopup="dialog"', "AI Templates trigger must be accessible");
includes(nav, 'AI Templates', "AI Templates label must be visible");
includes(nav, 'Beta', "AI Templates Beta badge must be visible");
includes(nav, "This feature is currently in development.", "AI Templates must truthfully describe beta state");
assert(!read(nav).includes("fetch("), "AI Templates Beta must not call an AI API");
assert(!read(nav).includes("href=\"#\""), "Navigation controls must not use href=\"#\"");
includes(nav, 'href="/dashboard/settings/profile"', "Brand account menu must include profile");
includes(nav, 'href="/dashboard/settings/company"', "Brand account menu must include company settings");
assert(!read(nav).includes('href="/dashboard/creator"'), "Brand account menu must not expose a normal-user Creator workspace switch");
includes(nav, 'href="/dashboard"', "Brand account menu must include Brand Workspace");
includes(nav, 'action="/auth/sign-out"', "Account menu must use existing sign-out route");

includes(viewModel, 'href: "/dashboard/payments"', "Transactions quick action must target payments");
includes(viewModel, 'href: "/dashboard/wallet"', "Payment account quick action must target wallet");
includes(viewModel, "function addFundsAction", "Add funds must use fundable campaign routing");
includes(viewModel, 'campaignHref(fundable[0]!.draftId, "funding")', "Single fundable campaign must open its Funding tab");
includes(viewModel, 'href: "/dashboard/campaigns?filter=funding"', "Multiple fundable campaigns must route to filtered campaign selection");
includes(pkg, '"test:sprint-004-brand-navigation"', "Package must expose Sprint 004 verifier");

console.log("Sprint 004 Brand workspace navigation verification passed.");
