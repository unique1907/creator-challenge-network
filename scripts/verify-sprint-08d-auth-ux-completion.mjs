import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const userMenu = read("src/components/auth/user-menu.tsx");
assert.ok(userMenu.includes('"use client"'), "user menu must be a client component");
assert.ok(userMenu.includes('aria-haspopup="menu"'), "avatar trigger must expose menu semantics");
assert.ok(userMenu.includes("aria-expanded={open}"), "avatar trigger must expose expanded state");
assert.ok(userMenu.includes('action="/auth/sign-out"'), "user menu must post to the existing sign-out route");
assert.ok(userMenu.includes('method="post"'), "sign-out action must use POST");
assert.ok(userMenu.includes("Escape"), "Escape key must close the menu");
assert.ok(userMenu.includes("mousedown"), "outside click must close the menu");
assert.ok(!userMenu.includes("localStorage"), "auth state must not be stored in localStorage");
assert.ok(!userMenu.includes("sessionStorage"), "auth state must not be stored in sessionStorage");

const brandDashboard = read("src/features/dashboard/components/brand-dashboard.tsx");
assert.ok(brandDashboard.includes("BrandAccountMenu"), "Brand workspace must render the canonical account menu");
assert.ok(brandDashboard.includes('workspaceLabel="Brand Workspace"'), "Brand menu must identify the workspace");
assert.ok(brandDashboard.includes("email={user.email}"), "Brand menu must receive safe email when available");

const dashboardRoute = read("src/app/dashboard/page.tsx");
assert.ok(dashboardRoute.includes("getAuthenticatedCcnContext"), "Brand dashboard must require auth context");
assert.ok(dashboardRoute.includes("redirect(\"/auth/sign-in\")"), "Brand dashboard must redirect when unauthenticated");
assert.ok(dashboardRoute.includes("displayName: context.displayName"), "Brand dashboard must pass server-derived display name to the menu");
assert.ok(dashboardRoute.includes("email: context.email"), "Brand dashboard must pass server-derived email to the menu");

const creatorWorkspace = read("src/features/creator-workspace/components/creator-workspace.tsx");
assert.ok(creatorWorkspace.includes("UserMenu"), "Creator workspace must render the user menu");
assert.ok(creatorWorkspace.includes('workspaceLabel="Creator Workspace"'), "Creator menu must identify the workspace");
assert.ok(userMenu.includes("Creator Workspace"), "Creator menu must include Creator Workspace");
assert.ok(userMenu.includes("Creator Profile"), "Creator menu must include Creator Profile");
assert.ok(userMenu.includes("Payout Settings"), "Creator menu must include Payout Settings");
assert.ok(!creatorWorkspace.includes("Brand Workspace"), "Creator workspace must not expose Brand workspace switching");
assert.ok(!creatorWorkspace.includes("localStorage"), "Creator workspace must not introduce localStorage auth fallback");
assert.ok(!creatorWorkspace.includes("sessionStorage"), "Creator workspace must not introduce sessionStorage auth fallback");

const creatorRoute = read("src/app/dashboard/creator/page.tsx");
assert.ok(creatorRoute.includes("getCreatorSession()"), "Creator dashboard must derive session server-side");
assert.ok(creatorRoute.includes("CreatorAuthGate"), "Creator dashboard must deny unauthenticated access safely");

const createChallengeRoute = read("src/app/create-challenge/page.tsx");
assert.ok(createChallengeRoute.includes("getAuthenticatedCcnContext"), "Create Challenge must require auth context");
assert.ok(createChallengeRoute.includes("redirect(\"/auth/sign-in\")"), "Create Challenge must redirect when unauthenticated");

const signOutRoute = read("src/app/auth/sign-out/route.ts");
assert.ok(signOutRoute.includes("supabase.auth.signOut()"), "sign-out route must invalidate Supabase auth session");
assert.ok(signOutRoute.includes("clearCreatorSession()"), "sign-out route must clear development Creator session cookie too");
assert.ok(signOutRoute.includes("/auth/sign-in"), "sign-out route must redirect to the existing sign-in page");
assert.ok(!signOutRoute.includes("localStorage"), "sign-out must not be fake client-side logout");
assert.ok(!signOutRoute.includes("sessionStorage"), "sign-out must not be fake client-side logout");

console.log(JSON.stringify({
  result: "Sprint 8D auth UX completion static verification passed",
  brandUserMenu: true,
  creatorUserMenu: true,
  signOutRoute: "/auth/sign-out",
  postLogoutProtection: ["/dashboard", "/dashboard/creator", "/create-challenge"],
  browserStorageFallback: false,
}, null, 2));
