import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, token, message) {
  assert.ok(source.includes(token), `${message}: missing ${token}`);
}

function excludes(source, token, message) {
  assert.ok(!source.includes(token), `${message}: found ${token}`);
}

const brandFiles = [
  "src/app/dashboard/page.tsx",
  "src/app/dashboard/campaigns/page.tsx",
  "src/app/dashboard/challenges/[draftId]/page.tsx",
  "src/app/dashboard/wallet/page.tsx",
  "src/app/dashboard/payments/page.tsx",
  "src/app/dashboard/settings/page.tsx",
  "src/app/dashboard/settings/profile/page.tsx",
  "src/app/dashboard/settings/company/page.tsx",
  "src/app/dashboard/about-arc/page.tsx",
  "src/features/dashboard/components/brand-dashboard.tsx",
  "src/features/dashboard/components/brand-dashboard-challenges.tsx",
  "src/features/dashboard/components/brand-workspace-navigation.tsx",
  "src/features/dashboard/components/brand-identity-forms.tsx",
  "src/features/dashboard/components/campaign-workspace.tsx",
  "src/features/dashboard/components/campaign-workspace-tabs.tsx",
];

const brandSource = brandFiles.map((file) => read(file)).join("\n");
const dashboard = read("src/features/dashboard/components/brand-dashboard.tsx");
const navigation = read("src/features/dashboard/components/brand-workspace-navigation.tsx");
const wallet = read("src/app/dashboard/wallet/page.tsx");
const campaigns = read("src/app/dashboard/campaigns/page.tsx");
const payments = read("src/app/dashboard/payments/page.tsx");
const settings = read("src/app/dashboard/settings/page.tsx");
const profile = read("src/app/dashboard/settings/profile/page.tsx");
const company = read("src/app/dashboard/settings/company/page.tsx");
const workspace = read("src/features/dashboard/components/campaign-workspace.tsx");
const workspaceTabs = read("src/features/dashboard/components/campaign-workspace-tabs.tsx");

for (const forbidden of ["text-3xl", "text-4xl", "text-5xl", "font-black", "tracking-wide", "tracking-wider", "tracking-widest"]) {
  excludes(brandSource, forbidden, "Brand operational UI must use the compact typography scale");
}

for (const forbiddenTracking of ["tracking-[0.1em]", "tracking-[0.12em]", "tracking-[0.14em]", "tracking-[0.16em]", "tracking-[0.18em]", "tracking-[0.2em]", "tracking-[0.22em]", "tracking-[0.24em]"]) {
  excludes(brandSource, forbiddenTracking, "Uppercase Brand labels must use compact tracking");
}

for (const source of [campaigns, wallet, payments, settings, profile, company, workspace]) {
  includes(source, "text-[24px] font-semibold", "Brand page title must use the approved desktop/tablet scale");
  includes(source, "md:text-[28px]", "Brand page title must cap at 28px");
}

includes(dashboard, "text-[24px] font-semibold leading-[1.18] tracking-normal text-white md:text-[28px]", "Dashboard greeting must cap at 28px");
includes(dashboard, "text-[24px] font-semibold leading-[1.18] tracking-normal text-white md:text-[30px]", "Dashboard hero title must cap at 30px");
includes(dashboard, "mt-8 space-y-1 text-[13px] font-medium", "Sidebar labels must use compact navigation typography");
includes(dashboard, "text-[13px] font-semibold uppercase tracking-[0.07em]", "Dashboard section labels must use compact scale and tracking");
includes(dashboard, "text-[13px] font-semibold text-white", "Dashboard row/card titles must use compact semibold typography");

includes(wallet, "text-[24px] font-semibold leading-tight", "Wallet balance must stay within the 22-26px maximum");
includes(wallet, "text-[11px] font-semibold uppercase tracking-[0.07em]", "Wallet labels must use compact uppercase typography");
excludes(wallet, "text-3xl", "Wallet balance must not use 30px+ typography");

includes(navigation, "w-[min(384px,calc(100vw-1.5rem))]", "Action Center must keep compact width");
includes(navigation, "text-base font-semibold leading-5 text-white", "Action Center title must remain 15-16px and semibold");
includes(navigation, "text-[13px] font-semibold leading-4", "Action Center item title must remain 13-14px");
includes(navigation, "text-[11px] font-semibold uppercase tracking-[0.06em]", "Action Center CTA labels must stay compact");
includes(navigation, "text-[10px] font-semibold uppercase tracking-[0.06em]", "Action Center badges must stay compact");

includes(workspaceTabs, "text-[13px] font-semibold transition", "Challenge Detail tabs must use compact labels");
includes(workspaceTabs, "text-xl font-semibold", "Challenge Detail modal/review headings must not exceed compact card-title scale");
includes(workspaceTabs, "text-[11px] font-semibold uppercase tracking-[0.07em]", "Challenge Detail uppercase labels must use compact tracking");

const changedFiles = execFileSync("git", ["diff", "--name-only"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);
for (const file of changedFiles) {
  assert.ok(!file.startsWith("src/features/creator-workspace/"), `Creator workspace typography file changed: ${file}`);
  assert.ok(!file.startsWith("src/app/dashboard/creator/"), `Creator dashboard typography file changed: ${file}`);
}

console.log("P0 Brand typography-density verification passed.");
