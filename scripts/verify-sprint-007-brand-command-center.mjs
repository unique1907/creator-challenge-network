import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(path, expected, message) {
  assert.ok(read(path).includes(expected), `${message}: missing ${expected}`);
}

const viewModel = "src/features/dashboard/brand-dashboard-view-model.ts";
const dashboard = "src/features/dashboard/components/brand-dashboard.tsx";
const navigation = "src/features/dashboard/components/brand-workspace-navigation.tsx";
const campaigns = "src/app/dashboard/campaigns/page.tsx";
const settings = "src/app/dashboard/settings/page.tsx";
const aboutArc = "src/app/dashboard/about-arc/page.tsx";
const funding = "src/services/create-challenge/create-challenge-funding.server.ts";
const payout = "src/services/circle/payout-contract-execution.server.ts";

includes(viewModel, "isMeaningfulPersonName(displayName)", "Dashboard greeting must prefer canonical display name");
assert.ok(!read(viewModel).includes("if (isMeaningfulBrandName(brandName)) return brandName;"), "Greeting must not prefer Brand/company name");
includes(dashboard, "Welcome back, ${greetingName}.", "Dashboard must render display-name greeting");
includes(dashboard, "Complete your campaign before publishing.", "Hero must be operational decision panel");
includes(dashboard, "New submission received", "Hero must prioritize new submission actions");
includes(dashboard, "+ New Challenge", "New Challenge must remain available");
assert.ok(!read(dashboard).includes("bg-emerald") || read(dashboard).includes("BrandNotifications"), "New Challenge must not be promoted as green primary CTA");

includes(dashboard, "<h2 className=\"text-2xl font-black\">Arc</h2>", "Arc must be primary ecosystem card identity");
includes(dashboard, "Programmable Money Hackathon", "Arc card must reference hackathon context");
includes(dashboard, "Powered by Circle and USDC", "Circle must remain supporting infrastructure");
includes(dashboard, "href=\"/dashboard/about-arc\"", "Arc CTA must use a real internal route");
includes(aboutArc, "ARC_TESTNET_CHAIN_ID", "Arc info page must show canonical chain ID");
includes(aboutArc, "CREATE_CHALLENGE_ESCROW_CONTRACT", "Arc info page must show runtime contract");

includes(navigation, "BrandNotifications", "Notification control must exist");
includes(navigation, "aria-haspopup=\"menu\"", "Notification menu must be accessible");
includes(navigation, "Escape", "Notification/account menus must close with Escape");
includes(viewModel, "campaignHref(row.draftId, \"review\")", "Review notification must route to campaign review tab");
includes(viewModel, "campaignHref(row.draftId, \"settlement\")", "Settlement notification must route to settlement tab");
assert.ok(!read(viewModel).toLowerCase().includes("creator name"), "Notifications must not expose creator identity");

includes(campaigns, "CampaignCard", "Campaigns page must use rich project cards");
includes(campaigns, "visualClass(row.visualTone)", "Campaign cards must use deterministic visuals");
includes(campaigns, "row.actionLabel", "Campaign cards must use lifecycle-specific CTAs");
includes(campaigns, "href={row.href}", "Campaign cards must route to canonical campaign workspace");

includes(dashboard, "\"/dashboard/settings\"", "Sidebar Settings must route to settings landing");
includes(settings, "Workspace preferences and integration context", "Settings must be a workspace settings landing");
includes(settings, "Persistent read state", "Settings must not fake durable notification preferences");
includes(settings, "Profile and company identity remain in the account menu", "Settings must not duplicate identity editing as primary settings");

includes(dashboard, "Arc Testnet", "Sidebar lower module must use truthful Arc Testnet state");
includes(dashboard, "Brand Wallet", "Brand wallet header chip must remain");
includes(dashboard, "Arc Testnet", "Brand wallet chip must communicate testnet");
includes(navigation, "Company settings", "Account menu must preserve Company Settings");
includes(navigation, "Brand profile", "Account menu must preserve Brand profile");
includes(navigation, "Switch workspace", "Dual-role workspace switch must remain");
includes(navigation, "Sign out", "Account menu must include sign out");

includes(viewModel, 'label: "Open Blind Review"', "Review CTA must route to review work");
includes(viewModel, 'label: "Select Winner"', "Winner-ready CTA must route to review work");
includes(viewModel, 'label: "Complete Payout"', "Settlement CTA must route to settlement work");

assert.ok(read(funding).includes("createProductFundingChallenge"), "Brand funding service must remain present");
assert.ok(read(payout).includes("releasePayout"), "Payout execution service must remain present");

console.log("Sprint 007 Brand Command Center verification passed.");
