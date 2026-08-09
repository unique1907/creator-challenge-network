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

const dashboardPage = read("src/app/dashboard/page.tsx");
const dashboard = read("src/features/dashboard/components/brand-dashboard.tsx");
const quickActions = read("src/features/dashboard/components/brand-wallet-quick-actions.tsx");

includes(dashboardPage, "getScopedStoredWallet", "Dashboard must keep using existing scoped Brand wallet source");
includes(dashboardPage, "role: \"BRAND\"", "Dashboard must use the authenticated Brand wallet scope");
includes(dashboardPage, "purpose: \"PAYMENT\"", "Dashboard must use the Brand PAYMENT wallet purpose");
includes(dashboardPage, "readBrandUsdcBalance(wallet.walletAddress)", "Dashboard must keep using existing wallet balance source");
includes(dashboardPage, "walletAddress: wallet.walletAddress", "Dashboard must pass the real Brand wallet address to the copy action");
excludes(dashboardPage, "0xB1E2700290381396BC2A85bb6C286EaD5e80A5dd", "Dashboard must not hardcode a wallet address");

includes(dashboard, "BrandWalletQuickActions", "Wallet Quick Actions must render the focused client component");
includes(dashboard, "walletAddress={walletChip ? walletChip.walletAddress : null}", "Copy action must receive the real wallet address from server state");
includes(dashboard, "balanceLabel={walletChip ? walletChip.balanceLabel : \"Wallet balance unavailable\"}", "Balance row must receive the existing wallet balance label");

includes(quickActions, '"use client";', "Copy action must be isolated to a client leaf");
includes(quickActions, "navigator.clipboard?.writeText", "Copy action must use clipboard API");
includes(quickActions, "textarea.value = walletAddress", "Copy action must keep a clipboard fallback");
includes(quickActions, "setCopyState(\"copied\")", "Copy action must show compact copied feedback");
includes(quickActions, "Copied", "Copy action must expose the required feedback copy");
includes(quickActions, "Add Test USDC", "Second quick action must be Add Test USDC");
includes(quickActions, "Get free USDC from Circle Faucet", "Faucet supporting copy must remain exact");
includes(quickActions, "https://faucet.circle.com/", "Faucet must use official Circle Faucet URL");
includes(quickActions, 'target="_blank"', "Faucet must open in a new tab");
includes(quickActions, 'rel="noopener noreferrer"', "Faucet must use safe external rel attributes");
includes(quickActions, "Copy Wallet Address", "Copy Wallet Address row must be present");
includes(quickActions, "Copy your Arc Testnet wallet address", "Copy Wallet Address supporting text must be exact");
includes(quickActions, "Wallet Balance", "Wallet Balance row must be present");
includes(quickActions, "Arc Testnet", "Wallet Balance supporting text must preserve testnet wording");
includes(quickActions, "{balanceLabel} {\" · \"} Arc Testnet", "Wallet Balance must combine balance and network on one secondary line");
includes(quickActions, "whitespace-nowrap", "Wallet Balance secondary line must stay on one line");
includes(quickActions, "Open Wallet", "Open Wallet action must remain");
includes(quickActions, "Review balance and wallet status", "Open Wallet supporting copy must remain exact");
includes(quickActions, "View Payments", "View Payments action must remain");
includes(quickActions, "See funding and settlement history", "View Payments supporting copy must remain exact");
includes(quickActions, 'href={walletHref}', "Open Wallet route must continue to come from the existing wallet href");
includes(quickActions, 'href="/dashboard/payments"', "View Payments route must remain unchanged");
excludes(quickActions, "New Business Challenge", "Wallet Quick Actions must not include New Business Challenge");
excludes(quickActions, "Start from a business problem", "Removed challenge quick action copy must not remain");
excludes(quickActions, "href=\"/create-challenge?new=1\"", "Removed challenge quick action route must not remain");
excludes(quickActions, "57.1", "Wallet balance must not be hardcoded");
excludes(quickActions, "Creator", "Wallet Quick Actions must not expose Creator wallet copy");
excludes(quickActions, "->", "Navigation action icons must not use ASCII arrows");
includes(quickActions, "function ArrowUpRightIcon", "Navigation action icons must use a real local SVG icon component");
includes(quickActions, "function CopyIcon", "Copy row must use a real local SVG icon component");
includes(quickActions, "function IconFrame", "Action icons must share one icon frame component");
includes(quickActions, "h-9 w-9", "Icon frame must use compact 36x36 sizing");
includes(quickActions, "rounded-[9px]", "Icon frame must use compact 9px radius");
includes(quickActions, "h-[18px] w-[18px]", "Icons must use the locked 18px visual size");
includes(quickActions, "strokeWidth=\"1.9\"", "Icons must use the locked stroke range");
includes(quickActions, "min-h-[58px]", "Rows must share the compact 58px minimum height");

const order = [
  "Wallet Balance",
  "Add Test USDC",
  "Copy Wallet Address",
  "Open Wallet",
  "View Payments",
].map((token) => indexOfRequired(quickActions, token));
assert.ok(order.every((index, position) => position === 0 || order[position - 1] < index), "Wallet Quick Actions order is incorrect.");

const balanceStart = indexOfRequired(quickActions, "Wallet Balance");
const balanceEnd = indexOfRequired(quickActions, "<QuickAction href=\"https://faucet.circle.com/\"");
const balanceRow = quickActions.slice(balanceStart, balanceEnd);
excludes(balanceRow, "<button", "Wallet Balance row must not be a button");
excludes(balanceRow, "<Link", "Wallet Balance row must not be a link");
excludes(balanceRow, "hover:", "Wallet Balance row must not have a hover state");
excludes(balanceRow, "<IconFrame", "Wallet Balance row must not render an action icon");
assert.equal((balanceRow.match(/Arc Testnet/g) ?? []).length, 1, "Wallet Balance row must include Arc Testnet only on the secondary line.");
excludes(balanceRow, 'text-slate-400">Arc Testnet</span>', "Wallet Balance row must not keep a third standalone network line.");

console.log("P0 Brand Wallet Quick Actions balance/copy verifier passed.");
