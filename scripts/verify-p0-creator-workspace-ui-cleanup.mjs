import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const componentPath = "src/features/creator-workspace/components/creator-workspace.tsx";
const navPath = "src/features/creator-workspace/components/creator-workspace-nav.tsx";
const logoPath = "src/components/ui/ccn-logo.tsx";

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function includes(source, text, message) {
  assert.ok(source.includes(text), message);
}

function excludes(source, text, message) {
  assert.ok(!source.includes(text), message);
}

const component = read(componentPath);
const nav = read(navPath);
const logo = read(logoPath);

includes(component, "<CCNLogo size=\"xl\" priority />", "Creator shell must render the larger canonical CCN logo.");
includes(logo, "src: \"/brand/ccn-logo.svg\"", "Creator shell must continue using the canonical SVG logo asset.");
excludes(component, "<CCNLogo size=\"lg\" priority />", "Creator shell must not keep the previous smaller logo size.");

includes(component, "Welcome Back {overview.profile.displayName}", "Creator overview greeting must use the locked Welcome Back copy.");
excludes(component, "Good afternoon", "Creator overview must not keep the time-of-day greeting.");

includes(component, "rounded-lg border border-white/10 bg-white/[0.045] p-2", "KPI cards must use compact padding.");
includes(component, "grid h-7 w-7", "KPI icon tiles must use the compact size.");
includes(component, "text-[15px] font-semibold", "KPI values must remain prominent while using the compact value size.");
includes(component, "text-[10px] leading-3 text-slate-500", "KPI helper text must use the compact muted style.");

excludes(component, "mt-auto rounded-2xl border border-white/10 bg-white/[0.04] p-4", "Bottom-left persistent profile panel must be removed.");
excludes(component, "identity.username ? `@${identity.username}` : \"Creator account\"", "Creator shell must not render the removed bottom username panel.");
includes(nav, '{ label: "Profile", href: "/dashboard/creator/profile"', "Profile navigation item must remain.");

includes(component, "CreatorWorkspaceSearch", "Creator search must remain present.");
includes(component, "CreatorNotificationsButton", "Creator notifications must remain present.");
includes(component, "UserMenu", "Top account menu must remain present.");

console.log("P0 Creator Workspace UI cleanup verifier passed.");
