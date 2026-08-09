import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

function excludes(source, needle, message) {
  assert.equal(source.includes(needle), false, message);
}

function count(source, needle) {
  return source.split(needle).length - 1;
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const output = [];
  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) output.push(...listFiles(fullPath));
    else output.push(fullPath);
  }
  return output;
}

const navigation = read("src/features/dashboard/components/brand-workspace-navigation.tsx");
const serverHelper = read("src/features/dashboard/brand-account-controls.server.ts");
const dashboard = read("src/features/dashboard/components/brand-dashboard.tsx");
const dashboardPage = read("src/app/dashboard/page.tsx");
const campaigns = read("src/app/dashboard/campaigns/page.tsx");
const challengePage = read("src/app/dashboard/challenges/[draftId]/page.tsx");
const challengeWorkspace = read("src/features/dashboard/components/campaign-workspace.tsx");
const wallet = read("src/app/dashboard/wallet/page.tsx");
const payments = read("src/app/dashboard/payments/page.tsx");
const settings = read("src/app/dashboard/settings/page.tsx");
const profile = read("src/app/dashboard/settings/profile/page.tsx");
const company = read("src/app/dashboard/settings/company/page.tsx");
const aboutArc = read("src/app/dashboard/about-arc/page.tsx");

includes(navigation, "export function BrandAccountControls", "Shared BrandAccountControls component must exist.");
includes(navigation, "data-brand-account-controls", "Shared controls must expose a stable verifier marker.");
includes(navigation, "<BrandNotifications", "Shared controls must own the notification bell.");
includes(navigation, "<BrandAccountMenu", "Shared controls must own the avatar/dropdown menu.");
includes(navigation, "NOTIFICATION_READ_STORAGE_KEY", "Notification read state persistence must remain in the shared navigation source.");
includes(navigation, "notificationStorageKey(accountKey)", "Notification read state must remain account-scoped.");
includes(navigation, "useSyncExternalStore", "Notification read state must subscribe across page navigation.");
includes(navigation, "avatarImageUrl", "Shared account menu must preserve uploaded avatar support.");

includes(serverHelper, "getBrandAccountControlData", "Non-Dashboard Brand pages must use one server data helper.");
includes(serverHelper, "context.brandName ?? null", "Brand account controls must use the canonical Brand/company profile source.");
includes(serverHelper, "context.avatarImageUrl", "Brand account controls must use the canonical uploaded avatar source.");
includes(serverHelper, "getBrandDashboardSubmissionNotifications(drafts)", "Shared controls must reuse the Dashboard notification source.");
excludes(serverHelper, "brandDisplayName ?? context.brandName", "Account identity must not prefer challenge-derived view-model identity.");

includes(dashboard, "<BrandAccountControls", "Dashboard must use the shared Brand account controls.");
assert.equal(count(dashboard, "<BrandAccountControls"), 1, "Dashboard must not render duplicate Brand account controls.");
includes(dashboardPage, "brandName: context.brandName", "Dashboard must pass canonical Brand identity to shared controls.");

includes(campaigns, "<BrandAccountControls", "Business Challenges must render the shared Brand account controls.");
includes(campaigns, "notifications={viewModel.notifications}", "Business Challenges must reuse its existing Dashboard notification view model.");
includes(campaigns, "brandName={context.brandName}", "Business Challenges account identity must come from canonical Brand context.");

for (const [label, source] of [
  ["Wallet", wallet],
  ["Payments", payments],
  ["Settings", settings],
  ["Brand Profile", profile],
  ["Company Settings", company],
  ["Arc Integration", aboutArc],
]) {
  includes(source, "getBrandAccountControlData(context)", `${label} must load shared Brand account-control data.`);
  includes(source, "<BrandAccountControls", `${label} must render the shared Brand account controls.`);
}

includes(challengePage, "getBrandAccountControlData(context)", "Challenge Detail route must load shared Brand account-control data.");
includes(challengePage, "accountControls={accountControls}", "Challenge Detail route must pass shared controls into the workspace.");
includes(challengeWorkspace, "accountControls: BrandAccountControlsProps", "Challenge Detail workspace must receive the shared controls contract.");
includes(challengeWorkspace, "<BrandAccountControls {...accountControls}", "Challenge Detail header must render the shared Brand account controls.");
excludes(challengeWorkspace, ">N</div>", "Challenge Detail must not keep the placeholder notification box.");
excludes(challengeWorkspace, ">FK</div>", "Challenge Detail must not keep the placeholder top-right avatar.");

assert.equal(existsSync("src/app/dashboard/ai-templates/page.tsx"), false, "AI Templates has no standalone route in the current MVP.");
assert.equal(existsSync("src/app/dashboard/analytics/page.tsx"), false, "Analytics has no standalone route in the current MVP.");
includes(navigation, "AiTemplatesBetaButton", "AI Templates remains the existing shared Brand sidebar popover.");

const creatorFiles = listFiles("src/app/dashboard/creator")
  .filter((file) => file.endsWith(".tsx") || file.endsWith(".ts"))
  .map((file) => [file, read(file)]);
for (const [file, source] of creatorFiles) {
  excludes(source, "BrandAccountControls", `Creator page must not import or render Brand controls: ${file}`);
  excludes(source, "brand-account-controls.server", `Creator page must not load Brand account-control data: ${file}`);
}

includes(campaigns, "+ New Business Challenge", "Business Challenges primary action must remain.");
includes(wallet, "View Business Challenges", "Wallet page actions must remain.");
includes(wallet, "View Payments", "Wallet page actions must remain.");
includes(payments, "View challenges", "Payments page action must remain.");
includes(settings, "Edit profile", "Settings page profile action must remain.");
includes(profile, "<BrandProfileForm", "Brand Profile form must remain.");
includes(company, "<BrandCompanyForm", "Company Settings form must remain.");

console.log("P0 Brand shared header account-controls verifier passed.");
