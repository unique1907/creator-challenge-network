import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function includes(file, text, message) {
  assert.ok(read(file).includes(text), message);
}

function excludes(file, text, message) {
  assert.ok(!read(file).includes(text), message);
}

function includesText(source, text, message) {
  assert.ok(source.includes(text), message);
}

function excludesText(source, text, message) {
  assert.ok(!source.includes(text), message);
}

function section(file, startText, endText) {
  const text = read(file);
  const start = text.indexOf(startText);
  assert.notEqual(start, -1, `${startText} must exist in ${file}`);
  const end = endText ? text.indexOf(endText, start) : text.length;
  return text.slice(start, end === -1 ? text.length : end);
}

const service = "src/services/creator-workspace/creator-workspace.server.ts";
const component = "src/features/creator-workspace/components/creator-workspace.tsx";
const userMenu = "src/components/auth/user-menu.tsx";
const loading = "src/app/dashboard/creator/loading.tsx";

for (const file of [service, component, userMenu, loading]) {
  assert.ok(fs.existsSync(path.join(root, file)), `${file} must exist`);
}

includes(service, "export type CreatorNextAction", "Creator overview must expose a typed next action.");
includes(service, "resolveCreatorNextAction", "Creator next action resolver must exist.");
includes(service, 'kind: "wallet_setup"', "Wallet setup must be the first next-action branch.");
includes(service, 'kind: "continue_draft"', "Draft continuation next-action branch must exist.");
includes(service, 'kind: "submit_work"', "Eligible challenge next-action branch must exist.");
includes(service, 'kind: "submission_under_review"', "Finalized/pending-review next-action branch must exist.");
includes(service, 'kind: "reward_available"', "Reward next-action branch must exist.");
includes(service, 'kind: "explore"', "No-active-work fallback next-action branch must exist.");

const resolver = section(service, "export function resolveCreatorNextAction", "export async function getCreatorWorkspaceOverview");
assert.ok(resolver.indexOf('!input.wallet.available') < resolver.indexOf('item.status === "Draft"'), "Wallet readiness must outrank draft continuation.");
assert.ok(resolver.indexOf('item.status === "Draft"') < resolver.indexOf('challenge.submissionStatus === "No submission"'), "Draft continuation must outrank open challenge discovery.");
assert.ok(resolver.indexOf('challenge.submissionStatus === "No submission"') < resolver.indexOf('item.status === "Submitted"'), "Open challenge must outrank review-pending submission.");
assert.ok(resolver.indexOf('item.status === "Submitted"') < resolver.indexOf('item.status === "Paid"'), "Review-pending submission must outrank reward.");

includes(service, "getVerifiedCreatorPayoutWallet", "Wallet readiness must use canonical Creator Foundation payout wallet.");
excludes(service, "getPublishedCreateChallengeDraftBySlug", "Open challenges must not perform per-record public resolution during Creator discovery.");
includes(service, "listCreatorEligiblePublicDrafts", "Open challenges must pass through a single eligible public draft filter.");
includes(service, "isSubmissionOpen(draft)", "Open challenges must use canonical submission-window eligibility.");
includes(service, "draft.funding.transactionHash", "Open challenges must require canonical launch/funding evidence.");
excludes(service, "markers.includes", "Creator challenge eligibility must not filter by demo/test/deneme title text.");
excludes(service, "draft.challenge.isSmokeTest === true", "Creator challenge eligibility must not hide smoke challenges by flag when canonical state is valid.");
includes(service, 'publicationStatus !== "live"', "Creator discoverability must require live publication.");
includes(service, 'fundingStatus !== "funded" && fundingStatus !== "live"', "Creator discoverability must preserve funded/live funding semantics.");
includes(service, 'draft.funding.escrowStatus !== "verified"', "Creator discoverability must require escrow verification.");
includes(service, 'draft.funding.eventVerified !== true', "Creator discoverability must require event verification.");
includes(service, "isSubmissionOpen(draft)", "Creator discoverability must require an open submission window.");
excludes(service, '"/submit/', "Creator service must not route submissions through legacy /submit paths.");

const navComponent = read("src/features/creator-workspace/components/creator-workspace-nav.tsx");
includes(component, "Next Action", "Creator dashboard must render the Next Action section.");
includes(component, "Open Challenges", "Creator dashboard must render Open Challenges.");
includes(component, "My Submission", "Creator dashboard must render one submission area.");
includes(component, "Wallet Readiness", "Creator dashboard must render Wallet Readiness.");
includesText(navComponent, 'href: "/dashboard/creator"', "Sidebar must link Overview.");
includesText(navComponent, 'href: "/dashboard/creator/discover"', "Sidebar must link Discover.");
includesText(navComponent, 'href: "/dashboard/creator/submissions"', "Sidebar must link My Submissions.");
includesText(navComponent, 'href: "/dashboard/creator/wallet"', "Sidebar must link Wallet.");
excludesText(navComponent, "Rewards", "Sidebar must not expose Rewards unless it is a real contextual action.");
includes(component, '<Link href="/" className="flex items-center gap-3">', "Creator sidebar logo must link to public landing.");
includes(component, "/dashboard/creator/challenges/${challenge.slug}", "Challenge cards must route through canonical creator detail pages.");
excludes(component, "/submit/", "Creator UI must not expose legacy /submit routes.");
includes(component, "Cover unavailable", "Missing challenge covers must use honest placeholder instead of unrelated fallback images.");
includes(component, "Set up your payout wallet before submitting.", "Wallet readiness must explain missing setup without technical mapping jargon.");

includes(userMenu, "Creator Dashboard", "Profile menu must include Creator Dashboard.");
includes(userMenu, "Wallet", "Profile menu must include Wallet.");
includes(userMenu, 'href="/dashboard/creator/wallet"', "Profile menu wallet action must route to Creator wallet.");
includes(userMenu, "Sign out", "Profile menu must include Sign out.");
includes(userMenu, "onClick={() => setOpen(false)}", "Profile menu selections should close the menu.");
includes(userMenu, "Escape", "Profile menu must retain Escape close behavior.");
includes(userMenu, "mousedown", "Profile menu must retain outside-click close behavior.");
excludes(userMenu, "Creator Profile", "Profile menu should not expose extra Creator Profile entry.");
excludes(userMenu, "Payout Settings", "Profile menu should use plain Wallet label.");
includes(userMenu, 'action="/auth/sign-out"', "Sign-out must use the existing route.");

includes(loading, "Preparing Creator overview", "Creator route loading must be route-aware and content-shaped.");
includes(loading, 'aria-label="Preparing Creator overview"', "Creator loading must preserve the persistent shell expectation without generic text.");

console.log("Creator dashboard one-journey verification passed.");
