import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  assert.ok(fs.existsSync(path.join(root, relativePath)), `${relativePath} must exist`);
}

function includes(file, text, message) {
  assert.ok(read(file).includes(text), message);
}

function excludes(file, text, message) {
  assert.ok(!read(file).includes(text), message);
}

const routes = [
  "src/app/dashboard/creator/page.tsx",
  "src/app/dashboard/creator/discover/page.tsx",
  "src/app/dashboard/creator/challenges/[slug]/page.tsx",
  "src/app/dashboard/creator/submissions/page.tsx",
  "src/app/dashboard/creator/submissions/[submissionId]/page.tsx",
  "src/app/dashboard/creator/rewards/page.tsx",
  "src/app/dashboard/creator/wallet/page.tsx",
];

for (const route of routes) exists(route);

const service = "src/services/creator-workspace/creator-workspace.server.ts";
const component = "src/features/creator-workspace/components/creator-workspace.tsx";
const navComponent = "src/features/creator-workspace/components/creator-workspace-nav.tsx";
const layout = "src/app/dashboard/creator/layout.tsx";
const loading = "src/app/dashboard/creator/loading.tsx";
const actions = "src/features/creator-workspace/components/creator-actions.tsx";
const session = "src/services/creator-session.server.ts";
const submissions = "src/services/submissions/submission-store.server.ts";
const lifecycle = "src/services/submissions/canonical-challenge-lifecycle.server.ts";
const store = "src/services/create-challenge/create-challenge-store.server.ts";

for (const file of [service, component, navComponent, layout, loading, actions, session, submissions, lifecycle, store]) exists(file);

includes(service, "getVerifiedCreatorPayoutWallet", "creator wallet page must derive from canonical Creator Foundation payout wallet");
includes(service, 'mappingStatus: "CREATOR_PAYOUT"', "creator wallet lookup must use CREATOR_PAYOUT scope");
includes(service, 'purpose: "PAYOUT"', "creator wallet summary must preserve payout purpose");
includes(service, "listCreateChallengeDraftStates", "discover must use canonical challenge draft state without per-record draft reloads");
includes(service, 'publicationStatus !== "live"', "discover must require live publication status");
includes(service, 'fundingStatus !== "funded" && fundingStatus !== "live"', "discover must accept canonical funded/live states");
includes(service, "eventVerified !== true", "discover must require verified funding event");
includes(service, "Date.now() < deadline.getTime()", "discover must respect active submission window");
includes(service, "listOnChainVerificationsForDraft", "rewards must inspect on-chain verification records");
includes(service, 'record.eventType === "ChallengePayout"', "paid rewards must require payout evidence");
includes(service, "record.receiptVerified", "paid rewards must require receipt verification");
includes(service, "record.eventVerified", "paid rewards must require event verification");
includes(service, "record.winnersVerified", "paid rewards must require winner verification");

includes(component, "CreatorWorkspaceShell", "creator pages must reuse one dashboard shell");
includes(navComponent, "/dashboard/creator/discover", "creator shell navigation must include Discover route.");
includes(layout, "CreatorWorkspaceShell", "creator layout must keep the shell mounted across route transitions.");
includes(layout, "CreatorAuthGate", "creator layout must render a gated unauthenticated state.");
includes(loading, "Preparing Creator overview", "creator route loading must be route-aware and content-shaped.");
excludes(component, "Brand Workspace", "Creator workspace must not expose Brand workspace switching under role isolation.");
includes(component, "Creator Workspace", "creator workspace label must be visible");
includes(component, "<CCNLogo size=\"lg\" priority />", "creator shell must reuse the canonical CCN logo component");
includes(component, "anonymousEntryCode", "submission detail/list must use anonymous entry code");
excludes(component, "creatorAccountId", "creator UI must not render raw creator account IDs");
excludes(component, "creatorWalletAddress", "creator UI must not render full raw wallet addresses");

includes(actions, "/api/creator/submissions/draft", "submission form must use canonical product draft route");
includes(actions, "/api/creator/submissions/finalize", "submission form must use canonical product finalize route");
excludes(actions, "creatorWalletAddress", "client must not send arbitrary creator wallet address");
excludes(actions, "creatorAccountId", "client must not send arbitrary creator account ID");

for (const route of routes) {
  includes(route, "getCreatorSession", `${route} must resolve authenticated creator server-side`);
  includes(route, 'dynamic = "force-dynamic"', `${route} must not prerender cookie-gated creator state`);
}
includes("src/app/dashboard/creator/challenges/[slug]/page.tsx", "redirect(creatorSignUpPath(returnTo))", "challenge detail must preserve canonical challenge return path through auth");

includes(submissions, "listCreatorSubmissions", "submission store must expose creator-owned listing");
includes(submissions, "getCreatorSubmissionById", "submission detail must enforce owner lookup");
includes(submissions, "creatorAccountId === input.creatorAccountId", "submission detail lookup must be account-scoped");
includes(submissions, "assertBlindReviewProjectionIsAnonymous", "blind review anonymity guard must remain present");

includes(lifecycle, "getVerifiedCreatorPayoutMapping(input.creatorAccountId)", "submission writes must derive creator payout wallet server-side");
includes(lifecycle, "creatorAccountId: input.creatorAccountId", "submission writes must use server-derived creator identity");
includes(lifecycle, "Client-supplied creator wallet does not match the verified payout mapping.", "client wallet override must be rejected");

includes(store, "listWinnerFinalizationAttempts", "creator rewards must have read-only winner attempt access");
includes(store, "listOnChainVerificationsForDraft", "creator rewards must have scoped on-chain evidence access");

console.log("Sprint 06 Creator Workspace foundation verification passed.");
