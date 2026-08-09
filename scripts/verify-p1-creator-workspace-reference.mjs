import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => assert.ok(fs.existsSync(path.join(root, relativePath)), `${relativePath} must exist`);
const includes = (file, text, message) => assert.ok(read(file).includes(text), message);
const excludes = (file, text, message) => assert.ok(!read(file).includes(text), message);

const component = "src/features/creator-workspace/components/creator-workspace.tsx";
const nav = "src/features/creator-workspace/components/creator-workspace-nav.tsx";
const search = "src/features/creator-workspace/components/creator-workspace-search.tsx";
const service = "src/services/creator-workspace/creator-workspace.server.ts";
const discoverRoute = "src/app/dashboard/creator/discover/page.tsx";
const notificationsRoute = "src/app/dashboard/creator/notifications/page.tsx";
const profileRoute = "src/app/dashboard/creator/profile/page.tsx";
const walletRoute = "src/app/dashboard/creator/wallet/page.tsx";

for (const file of [component, nav, search, service, discoverRoute, notificationsRoute, profileRoute, walletRoute]) exists(file);

includes(component, "<CCNLogo size=\"xl\" priority />", "Creator shell must reuse the locked canonical CCN logo component.");
includes(nav, 'href: "/dashboard/creator"', "Sidebar must include Overview route.");
includes(nav, 'href: "/dashboard/creator/discover"', "Sidebar must include Discover route.");
includes(nav, 'href: "/dashboard/creator/submissions"', "Sidebar must include My Submissions route.");
includes(nav, 'href: "/dashboard/creator/wallet"', "Sidebar must include Wallet route.");
includes(nav, 'href: "/dashboard/creator/notifications"', "Sidebar must include Notifications route.");
includes(nav, 'href: "/dashboard/creator/profile"', "Sidebar must include Profile route.");
includes(nav, "usePathname", "Active navigation must be route-aware.");
includes(search, "Search challenges, brands, categories...", "Top search placeholder must match the approved reference copy.");
includes(search, 'action="/dashboard/creator/discover"', "Search must submit to the canonical Creator discovery route.");
includes(discoverRoute, "searchParams", "Discover route must read server-side search params.");
includes(discoverRoute, "listCreatorDiscoverableChallenges(session, query)", "Discover route must pass query to the canonical challenge resolver.");
includes(service, "matchesChallengeQuery", "Creator search must filter against canonical challenge data.");
includes(service, "CreatorMetricItem", "Overview must expose compact metric cards.");
includes(service, "buildCreatorMetrics", "Metrics must be derived server-side from real Creator records.");
includes(service, "amountUnits", "Total earnings must be derived from canonical reward units, not mock strings.");
includes(service, "buildCreatorNotifications", "Notifications preview must be event-derived from Creator-owned state.");
includes(component, "NextActionHero", "Overview must render the large state-driven Next Action banner.");
includes(component, "CompactChallengeCard", "Overview must render compact challenge cards.");
includes(component, "WalletRailCard", "Overview must render the right-rail payout wallet card.");
includes(component, "NotificationsPreview", "Overview must render the notifications preview.");
includes(component, "CreatorHelpCard", "Overview must render the truthful help card footprint.");
includes(component, "Withdraw (Beta)", "Unsupported withdrawal must be visibly disabled as beta, not fake-enabled.");
includes(service, "Balance unavailable", "Wallet model must not show a fake live balance when no balance query exists.");
includes(component, "/dashboard/creator/challenges/${challenge.slug}", "Challenge cards must use the canonical Creator challenge route.");
includes(notificationsRoute, "CreatorNotificationsPage", "Notifications nav target must render a real route.");
includes(profileRoute, "CreatorProfilePage", "Profile nav target must render a real route.");
excludes(component, "/submit/", "Creator workspace must not expose legacy /submit routes.");
excludes(component, "12,450", "Creator workspace must not include mock earnings from the reference image.");
excludes(component, "2,850.75", "Creator workspace must not include mock wallet balance from the reference image.");
excludes(component, "37%", "Creator workspace must not include mock win-rate values from the reference image.");

console.log("P1 Creator workspace reference verification passed.");
