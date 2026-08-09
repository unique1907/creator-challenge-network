import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, expected, message) {
  assert.ok(source.includes(expected), `${message}: missing ${expected}`);
}

function excludes(source, forbidden, message) {
  assert.ok(!source.includes(forbidden), `${message}: found ${forbidden}`);
}

function indexOfRequired(source, token) {
  const index = source.indexOf(token);
  assert.ok(index >= 0, `Missing required token: ${token}`);
  return index;
}

const dashboard = read("src/features/dashboard/components/brand-dashboard.tsx");
const walletQuickActions = read("src/features/dashboard/components/brand-wallet-quick-actions.tsx");
const dashboardPage = read("src/app/dashboard/page.tsx");

includes(walletQuickActions, "min-h-[58px]", "Wallet Quick Action rows must use compact equal height");
excludes(walletQuickActions, "min-h-[72px]", "Wallet Quick Action rows must not use oversized height");
includes(walletQuickActions, "px-3 py-2", "Wallet Quick Action rows must use compact padding");
includes(walletQuickActions, "h-9 w-9", "Wallet Quick Action icon containers must use compact 36px sizing");
includes(walletQuickActions, "rounded-[9px]", "Wallet Quick Action icon containers must use compact radius");
includes(walletQuickActions, "h-[18px] w-[18px]", "Wallet Quick Action icons must stay compact");
includes(walletQuickActions, "text-[13px] font-semibold text-white", "Wallet Quick Action row titles must stay compact");
includes(walletQuickActions, "text-[12px] text-slate-300", "Wallet Quick Action supporting text must stay compact and readable");
includes(walletQuickActions, "text-[11px] font-medium text-slate-300", "Wallet Balance secondary line must use compact medium typography");
includes(walletQuickActions, "{balanceLabel} {\" · \"} Arc Testnet", "Wallet Balance must keep balance and network on one secondary line");
excludes(walletQuickActions, "h-10 w-10", "Wallet Quick Action icon containers must not use 40px boxes");
excludes(walletQuickActions, "->", "Wallet Quick Actions must not use ASCII navigation arrows");

includes(dashboard, "<aside className=\"space-y-3\">", "Right rail must use compact card spacing");
includes(dashboard, "rounded-xl border border-slate-700/75 bg-[#0b1220] p-[14px]", "Right rail cards must use compact 14px padding with refined dark surface hierarchy");
includes(dashboard, "mb-3 flex items-center justify-between gap-3", "Right rail headings must use compact bottom spacing");
includes(dashboard, "text-[15px] font-semibold tracking-[0.01em] text-slate-200", "Right rail headings must use compact typography");
includes(dashboard, "className=\"text-[11px] font-semibold text-violet-200\"", "Recent Activity View all link must use compact typography");
includes(dashboard, "className=\"space-y-2\"", "Recent Activity list must use compact spacing");
includes(dashboard, "grid grid-cols-[34px_1fr] gap-2 py-2", "Recent Activity items must use compact icon tile layout");
includes(dashboard, "h-8 w-8", "Recent Activity icon tile must stay 32px");
includes(dashboard, "text-[11px] text-slate-300", "Recent Activity secondary text must be compact and readable");
includes(dashboard, "text-[10px] text-slate-400", "Recent Activity metadata must be compact and readable");
includes(dashboard, "rounded-lg border p-2.5", "Today's Priorities box must use compact padding");
includes(dashboard, "mt-1 text-[11px] leading-4 text-slate-300", "Today's Priorities supporting text must be compact");
includes(dashboard, "mt-1.5 text-[11px] font-semibold uppercase tracking-[0.04em]", "Today's Priorities CTA must be compact");
includes(dashboard, "rounded-xl border border-blue-400/25 bg-blue-500/[0.08] p-[14px]", "Built on Arc card must use compact padding");
includes(dashboard, "text-[15px] font-semibold text-white", "Built on Arc heading must be compact");
includes(dashboard, "mt-1.5 text-[12px] leading-5 text-slate-300", "Built on Arc body must be compact");
includes(dashboard, "mt-3 inline-flex h-8", "Built on Arc CTA must be compact");
includes(dashboard, "md:text-[26px]", "Dashboard greeting must cap at 26px");
includes(dashboard, "md:text-[28px]", "Hero title must cap at 28px");

const walletIndex = indexOfRequired(dashboard, "function WalletQuickActions");
const activityIndex = indexOfRequired(dashboard, "function RecentActivity");
const prioritiesIndex = indexOfRequired(dashboard, "function TodaysPriorities");
const arcIndex = indexOfRequired(dashboard, "function ArcCircleCard");
assert.ok(walletIndex < activityIndex, "Right rail order must keep Wallet Quick Actions first.");
assert.ok(activityIndex < prioritiesIndex, "Right rail order must keep Recent Activity before Today's Priorities.");
assert.ok(prioritiesIndex < arcIndex, "Right rail order must keep Built on Arc last.");

includes(dashboardPage, "readBrandUsdcBalance(wallet.walletAddress)", "Wallet balance source must remain unchanged");
includes(dashboardPage, "walletAddress: wallet.walletAddress", "Wallet address source must remain unchanged");
includes(walletQuickActions, "https://faucet.circle.com/", "Circle Faucet URL must remain unchanged");
includes(walletQuickActions, "navigator.clipboard?.writeText", "Copy behavior must remain unchanged");
includes(walletQuickActions, 'href={walletHref}', "Open Wallet route source must remain unchanged");
includes(walletQuickActions, 'href="/dashboard/payments"', "View Payments route must remain unchanged");

excludes(dashboard, "min-h-[320px]", "Right rail cards must not use oversized fixed/min heights");
excludes(dashboard, "grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]", "Right rail width must not be changed");

console.log("P0 Brand Dashboard right-rail density verifier passed.");
