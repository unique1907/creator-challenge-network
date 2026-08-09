import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const guide = read("src/app/dashboard/creator/guide/page.tsx");
const workspace = read("src/features/creator-workspace/components/creator-workspace.tsx");
const layout = read("src/app/dashboard/creator/layout.tsx");
const nav = read("src/features/creator-workspace/components/creator-workspace-nav.tsx");

function includes(source, text, message) {
  assert.ok(source.includes(text), message);
}

function excludes(source, text, message) {
  assert.ok(!source.includes(text), message);
}

includes(layout, "getCreatorSession()", "Creator Guide must stay under the authenticated Creator workspace layout.");
includes(layout, "CreatorAuthGate", "Creator Guide must use the existing Creator auth gate.");
includes(guide, "Creator Guide", "Creator Guide page must exist with the correct title.");
includes(guide, "discover Business Challenges, submit Solution Proposals, follow reviews, and receive rewards", "Creator Guide header must explain the Creator journey.");
includes(guide, "Discover Business Challenges", "Creator Guide must explain discovery.");
includes(guide, "Submit A Solution Proposal", "Creator Guide must explain submission.");
includes(guide, "Blind Review", "Creator Guide must explain Blind Review.");
includes(guide, "Track Your Submissions", "Creator Guide must explain submission tracking.");
includes(guide, "Win And Receive USDC", "Creator Guide must explain rewards.");
includes(guide, "Trust And Verification", "Creator Guide must explain trust and verification.");
includes(guide, 'href: "/dashboard/creator/discover"', "Creator Guide must link to Discover Challenges.");
includes(guide, 'href: "/dashboard/creator/submissions"', "Creator Guide must link to My Submissions.");
includes(guide, 'href: "/dashboard/creator/wallet"', "Creator Guide must link to Creator Wallet.");
includes(guide, "Submitted, Under Review, and Reward Paid", "Creator Guide must use supported submission states only.");
includes(guide, "Wallet Balance is not the same as Total Earnings", "Creator Guide must clarify wallet balance versus earnings.");
includes(guide, "when evidence is available", "Creator Guide must not overclaim transaction evidence.");

includes(workspace, 'href="/dashboard/creator/guide"', "Creator help card must route to the Creator Guide.");
includes(workspace, "Review the Creator Guide and learn how submissions, reviews, and rewards work on CCN.", "Creator help-card copy must remain intact.");
excludes(nav, "/dashboard/creator/guide", "Creator Guide must not be added as a permanent sidebar navigation item.");
excludes(guide, "Walmart", "Creator Guide should not introduce demo company examples.");
excludes(guide, "creative campaign", "Creator Guide should not use legacy creative campaign positioning.");

console.log("P0 Creator Guide verification passed.");
