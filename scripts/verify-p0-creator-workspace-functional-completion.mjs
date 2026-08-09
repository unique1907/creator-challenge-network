import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => assert.ok(fs.existsSync(path.join(root, relativePath)), `${relativePath} must exist`);
const includes = (file, text, message) => assert.ok(read(file).includes(text), message);
const excludes = (file, text, message) => assert.ok(!read(file).includes(text), message);

const workspace = "src/features/creator-workspace/components/creator-workspace.tsx";
const nav = "src/features/creator-workspace/components/creator-workspace-nav.tsx";
const service = "src/services/creator-workspace/creator-workspace.server.ts";
const foundation = "src/services/creator-foundation/creator-foundation.server.ts";
const profileRoute = "src/app/api/creator/profile/route.ts";
const notifications = "src/features/creator-workspace/components/creator-notifications-button.tsx";
const profileForm = "src/features/creator-workspace/components/creator-profile-form.tsx";
const walletActions = "src/features/creator-workspace/components/creator-wallet-actions.tsx";
const fixture = "scripts/checkpoint3-canonical-fixture.mjs";
const publicEligibility = "src/services/create-challenge/public-challenge-eligibility.ts";

for (const file of [workspace, nav, service, foundation, profileRoute, notifications, profileForm, walletActions, fixture, publicEligibility]) exists(file);

includes(service, "ARC_TESTNET_USDC_CONTRACT", "Creator wallet balance must query the canonical Arc Testnet USDC token.");
includes(service, "eth_call", "Creator wallet balance must use a read-only RPC call.");
includes(service, "balanceStatus", "Wallet summary must distinguish ready/unavailable/error states.");
includes(service, "Arc balance query failed. Use Refresh balance to try again.", "Balance failure must be honest and retriable.");
includes(service, "getVerifiedCreatorPayoutWallet", "Wallet readiness must use canonical CREATOR_PAYOUT source.");
includes(service, "isPublicLiveEligibleDraft", "Discover eligibility must use the shared public-live helper.");
includes(publicEligibility, "fundingStatus !== \"funded\" && fundingStatus !== \"live\"", "Discover eligibility must accept funded and live canonical states.");
excludes(service, "Demo", "Creator eligibility must not title-filter Demo challenges.");
excludes(service, "Smoke", "Creator eligibility must not title-filter Smoke challenges.");
includes(service, "No open challenges right now", "Overview next action must not contradict an empty Open Challenges section.");
includes(service, "Return to public challenges", "Empty challenge state must provide a useful safe action.");

includes(workspace, "CreatorNotificationsButton", "Top-right notification control must use the bell dropdown component.");
includes(notifications, "aria-haspopup=\"menu\"", "Notification bell must be accessible.");
includes(notifications, "Escape", "Notification menu must close on Escape.");
includes(notifications, "View all", "Notification preview must link to the canonical notifications route.");
includes(nav, "NavIcon", "Sidebar navigation must use icons instead of letter placeholders.");
excludes(nav, "icon: \"H\"", "Overview nav must not use H placeholder.");
excludes(nav, "icon: \"O\"", "Discover nav must not use O placeholder.");
excludes(nav, "icon: \"D\"", "Submissions nav must not use D placeholder.");
excludes(nav, "icon: \"W\"", "Wallet nav must not use W placeholder.");
includes(workspace, "lg:flex", "Desktop sidebar must use a flex column so the account card is not clipped.");
includes(workspace, "lg:hidden", "Creator workspace must expose mobile navigation.");

includes(workspace, "CreatorWalletActions", "Wallet page must expose copy/explorer/refresh actions.");
includes(walletActions, "navigator.clipboard.writeText", "Wallet address copy must be functional.");
includes(walletActions, "View on Explorer", "Wallet page must link to explorer when available.");
includes(walletActions, "Refresh balance", "Wallet page must have a refresh balance action.");
excludes(workspace, "{wallet.available ? \"View wallet\" : \"Set up wallet\"}", "Wallet page must not render a redundant View Wallet button.");
includes(workspace, "Withdraw (Beta)", "Unsupported withdrawal must be visibly disabled as beta, not fake-enabled.");

includes(foundation, "normalizeCreatorUsername", "Creator username must be normalized server-side.");
includes(foundation, "RESERVED_CREATOR_USERNAMES", "Reserved Creator usernames must be blocked.");
includes(foundation, "CREATOR_USERNAME_TAKEN", "Duplicate username attempts must fail safely.");
includes(foundation, "upsert", "Creator profile persistence must be idempotent for the current user.");
includes(profileRoute, "updateCreatorProfile", "Creator profile route must use the server-side profile service.");
includes(profileForm, "Will save as @", "Creator profile UI must show normalized username feedback.");

includes(fixture, "String(title).startsWith(\"Checkpoint 3\")", "Supabase fixture cleanup must remove only stale Checkpoint 3 duplicate challenge rows.");
includes(fixture, "circle_transaction_id", "Supabase fixture cleanup must remove stale fixture on-chain verification rows safely.");
excludes(workspace, "/submit/", "Creator workspace must never reintroduce legacy /submit routes.");

console.log("P0 Creator workspace functional completion verification passed.");
