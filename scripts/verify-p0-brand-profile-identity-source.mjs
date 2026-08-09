import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, expected, message) {
  assert.ok(source.includes(expected), `${message}: missing ${expected}`);
}

function excludes(source, forbidden, message) {
  assert.ok(!source.includes(forbidden), `${message}: found ${forbidden}`);
}

const auth = read("src/services/auth/ccn-auth.server.ts");
const brandIdentity = read("src/services/auth/brand-identity.server.ts");
const dashboardPage = read("src/app/dashboard/page.tsx");
const profilePage = read("src/app/dashboard/settings/profile/page.tsx");
const companyPage = read("src/app/dashboard/settings/company/page.tsx");
const navigation = read("src/features/dashboard/components/brand-workspace-navigation.tsx");
const dashboard = read("src/features/dashboard/components/brand-dashboard.tsx");
const dashboardViewModel = read("src/features/dashboard/brand-dashboard-view-model.ts");
const draftRoute = read("src/app/api/create-challenge/draft/route.ts");
const profileForms = read("src/features/dashboard/components/brand-identity-forms.tsx");
const roleIsolation = read("scripts/verify-role-isolation.mjs");

includes(brandIdentity, "resolveBrandAccountIdentity", "Brand identity projection must be shared");
includes(brandIdentity, "avatarImageKey", "Shared Brand identity projection must expose avatar key");
includes(brandIdentity, "avatarImageUrl", "Shared Brand identity projection must expose avatar URL");
includes(brandIdentity, "resolveAccountImageUrl(avatarImageKey)", "Uploaded avatar key must resolve through canonical media URL");
includes(brandIdentity, "\"ccn creator challenge network\"", "Platform identity must be reserved");
includes(brandIdentity, "\"creator challenge network\"", "Product identity must be reserved");

includes(auth, "resolveBrandAccountIdentity(input.account)", "Auth context must use shared Brand identity projection");
includes(auth, "avatarImageKey?: string | null", "Auth context must carry Brand avatar key");
includes(auth, "avatarImageUrl?: string | null", "Auth context must carry Brand avatar URL");
includes(auth, "brandName: brandIdentity.brandName", "Auth context must expose normalized Brand/company name");
includes(auth, "avatarImageUrl: brandIdentity.avatarImageUrl", "Auth context must expose resolved uploaded avatar URL");

includes(dashboardPage, "avatarImageUrl: context.avatarImageUrl", "Dashboard header must use canonical context avatar URL");
excludes(dashboardPage, ".eq(\"id\", ccnAccountId)", "Dashboard must not query avatar through the wrong accounts.id field");
excludes(dashboardPage, "getAvatarImageUrl", "Dashboard must not keep a separate hardcoded avatar lookup");

includes(profilePage, "imageKey: context.avatarImageKey ?? null", "Profile page must use canonical context avatar key");
includes(profilePage, "imageUrl: context.avatarImageUrl ?? null", "Profile page must use canonical context avatar URL");
includes(profilePage, "context.brandName ?? \"Company name not set\"", "Profile company label must use only canonical Brand/company identity");
excludes(profilePage, "context.displayName?.trim() ?? \"Company name not set\"", "Profile company label must not derive company identity from personal profile identity");
excludes(profilePage, "getAccountSnapshot", "Profile page must not use a separate avatar snapshot");
excludes(profilePage, "Brand name not set", "Profile company label must use the approved empty state");

includes(profileForms, "avatarState.imageUrl", "Profile form must render uploaded avatar when present");
includes(profileForms, "setAvatarState({ imageKey: null, imageUrl: null })", "Profile form must keep remove-avatar fallback behavior");
includes(profileForms, "body: JSON.stringify({ displayName, avatarImageKey: avatarState.imageKey })", "Profile save must persist the canonical avatar key");

includes(dashboard, "avatarImageUrl={user.avatarImageUrl}", "Profile dropdown must receive the same dashboard avatar URL");
includes(dashboard, "BrandAccountControls", "Dashboard header must render shared account controls");
includes(navigation, "BrandAccountMenu", "Shared account controls must render the profile dropdown");
includes(dashboardViewModel, "brandDisplayName = isMeaningfulBrandName(identity.brandDisplayName)", "Dashboard view model must accept only explicit account identity input");
excludes(dashboardViewModel, "rows.find((row) => isMeaningfulBrandName(row.brandName))", "Dashboard view model must not derive workspace identity from challenge rows");
excludes(dashboardViewModel, "?.brandName.trim() ?? null", "Dashboard view model must not promote challenge Brand names into profile identity");
includes(navigation, "avatarImageUrl ? <img", "Profile dropdown must render uploaded Brand avatar when present");
includes(navigation, "primaryIdentity = realBrandName || safeName", "Profile dropdown must prefer real Brand identity and fall back to account display name");
includes(navigation, "secondaryIdentity = email?.trim() || null", "Profile dropdown secondary identity must be the authenticated email");
excludes(navigation, "CCN Creator Challenge Network", "Profile dropdown must not display product name as Brand identity");
excludes(navigation, "Creator account", "Profile dropdown must not reuse Creator identity");

includes(companyPage, "BrandCompanyForm", "Company Settings must retain the existing company-name editor");
includes(companyPage, "normalizeBrandCompanyName(account?.brand_name)", "Company Settings must normalize persisted company name before display");
excludes(companyPage, "listCreateChallengeDrafts", "Company Settings must not read challenge drafts for workspace identity");
excludes(companyPage, "buildBrandDashboardViewModel", "Company Settings must not derive company name from Dashboard challenge rows");
excludes(companyPage, "context.displayName ?? \"\"", "Company Settings company field must not derive from personal profile identity");

includes(draftRoute, "brandName: context.brandName", "Challenge drafts may only autofill from canonical Brand/company identity");
excludes(draftRoute, "brandName: context.brandName ?? context.displayName", "Challenge drafts must not fall back from Brand/company identity to personal display name");
excludes(draftRoute, "updateBrandCompany", "Challenge draft route must not write canonical Brand/company identity");
excludes(draftRoute, ".from(\"accounts\")", "Challenge draft route must not mutate accounts directly");

excludes(dashboardPage, "getCreatorProfile", "Dashboard must not read Creator profile data for Brand avatar");
excludes(profilePage, "getCreatorProfile", "Profile must not read Creator profile data for Brand avatar");
includes(roleIsolation, "Brand account menu must not link to Creator workspace.", "Existing role-isolation verifier must protect Brand surfaces from Creator workspace links");
includes(roleIsolation, "Brand onboarding must explain Creator-role conflict.", "Existing role-isolation verifier must keep Creator account conflict coverage");

console.log("P0 Brand profile identity source verification passed.");
