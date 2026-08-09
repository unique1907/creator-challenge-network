import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const guide = read("src/app/dashboard/guide/page.tsx");
const dashboard = read("src/features/dashboard/components/brand-dashboard.tsx");

function includes(source, text, message) {
  assert.ok(source.includes(text), message);
}

function excludes(source, text, message) {
  assert.ok(!source.includes(text), message);
}

includes(guide, "Brand Guide", "Brand Guide page must exist with the correct title.");
includes(guide, "getAuthenticatedCcnContext({ workspace: \"brand\", allowTestContext: true })", "Brand Guide must use existing Brand workspace auth context.");
includes(guide, "if (!context) redirect(\"/auth/sign-in\")", "Brand Guide must require authentication.");
includes(guide, "if (!context.brandAccess) redirect(\"/dashboard/creator\")", "Brand Guide must preserve role isolation.");
includes(guide, "if (!context.brandOnboardingComplete) redirect(\"/auth/onboarding/brand\")", "Brand Guide must preserve Brand onboarding.");
includes(guide, "Define The Business Problem", "Brand Guide must explain business problem definition.");
includes(guide, "Fund The Prize Pool", "Brand Guide must explain prize funding.");
includes(guide, "Publish", "Brand Guide must explain publishing.");
includes(guide, "Review Solutions", "Brand Guide must explain review.");
includes(guide, "Select The Winner", "Brand Guide must explain winner selection.");
includes(guide, "Settle The Reward", "Brand Guide must explain settlement.");
includes(guide, "Blind Review hides creator identity during evaluation", "Brand Guide must use truthful Blind Review wording.");
includes(guide, "Circle Wallets participate in the current approval flow", "Brand Guide must mention Circle Wallets truthfully.");
includes(guide, "Arc Testnet", "Brand Guide must mention Arc Testnet.");
includes(guide, "test USDC", "Brand Guide must mention current MVP test USDC.");
includes(guide, 'href: "/create-challenge?new=1"', "Brand Guide must link to New Business Challenge.");
includes(guide, 'href: "/dashboard/campaigns"', "Brand Guide must link to Business Challenges.");

includes(dashboard, "function BrandGuideCard()", "Brand dashboard must include the compact Brand Guide card.");
includes(dashboard, "Learn how to create, fund, review, and settle Business Challenges on CCN.", "Brand Guide card must use required help copy.");
includes(dashboard, 'href="/dashboard/guide"', "Brand Guide card must route to Brand Guide.");
includes(dashboard, "Brand Guide", "Brand Guide card must expose the CTA label.");
includes(dashboard, "<WalletQuickActions walletChip={walletChip} />\n      <RecentActivity items={viewModel.recentActivity} />\n      <TodaysPriorities priority={priority} />", "Brand Guide card must not displace critical right-rail ordering.");

excludes(dashboard, 'label: "Guide"', "Brand Guide must not be added as a permanent sidebar navigation item.");
excludes(guide, "creative campaign", "Brand Guide should not use legacy creative campaign positioning.");
excludes(guide, "Walmart", "Brand Guide should not introduce demo company examples.");

console.log("P0 Brand Guide verification passed.");
