import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const creatorWorkspace = read("src/features/creator-workspace/components/creator-workspace.tsx");
const brandDashboard = read("src/features/dashboard/components/brand-dashboard.tsx");
const brandNavigation = read("src/features/dashboard/components/brand-workspace-navigation.tsx");
const campaignWorkspace = read("src/features/dashboard/components/campaign-workspace.tsx");
const dashboardRoute = read("src/app/dashboard/page.tsx");
const creatorDashboardRoute = read("src/app/dashboard/creator/page.tsx");
const campaignRoute = read("src/app/dashboard/challenges/[draftId]/page.tsx");
const auth = read("src/services/auth/ccn-auth.server.ts");

assert.ok(
  !creatorWorkspace.includes("Brand Workspace"),
  "Creator workspace must not expose a normal-user Brand workspace switch.",
);
assert.ok(
  creatorWorkspace.includes('href="/dashboard/creator" className="flex items-center gap-3"'),
  "Creator logo must keep the user inside the Creator workspace.",
);
assert.ok(
  !brandNavigation.includes('href="/dashboard/creator"'),
  "Brand dashboard account menu must not expose a normal-user Creator workspace switch.",
);
assert.ok(
  !campaignWorkspace.includes('href="/dashboard/creator"'),
  "Brand campaign workspace selector must not route normal users to Creator workspace.",
);
assert.ok(
  brandNavigation.includes('href="/dashboard"'),
  "Brand account menu must include Brand Workspace.",
);
assert.ok(
  dashboardRoute.includes('getAuthenticatedCcnContext({ workspace: "brand", allowTestContext: true })'),
  "Brand dashboard must resolve the Brand workspace context server-side.",
);
assert.ok(
  dashboardRoute.includes("context.brandAccess"),
  "Brand dashboard must require Brand access.",
);
assert.ok(
  creatorDashboardRoute.includes("getCreatorSession()"),
  "Creator dashboard must resolve Creator session server-side at the destination.",
);
assert.ok(
  campaignRoute.includes("assertCreateChallengeDraftOwner(draftId, context.ccnAccountId)"),
  "Brand campaign detail must use the current Brand account ownership check.",
);
assert.ok(
  auth.includes('brandAccess: primaryRole === "brand"'),
  "Shared auth context must derive Brand access from the canonical primary role.",
);
assert.ok(
  auth.includes('creatorAccess: primaryRole === "creator"'),
  "Shared auth context must derive Creator access from the canonical primary role.",
);
assert.ok(!creatorWorkspace.includes("window.location"), "Workspace switch must not introduce client-side session mutation.");
assert.ok(!creatorWorkspace.includes("localStorage"), "Workspace switch must not use localStorage.");
assert.ok(!creatorWorkspace.includes("sessionStorage"), "Workspace switch must not use sessionStorage.");
assert.ok(!brandDashboard.includes("localStorage"), "Brand workspace switch must not use localStorage.");
assert.ok(!brandDashboard.includes("sessionStorage"), "Brand workspace switch must not use sessionStorage.");
assert.ok(!campaignWorkspace.includes("localStorage"), "Campaign workspace switch must not use localStorage.");
assert.ok(!campaignWorkspace.includes("sessionStorage"), "Campaign workspace switch must not use sessionStorage.");

console.log("Sprint 12 workspace context switch verification passed.");
