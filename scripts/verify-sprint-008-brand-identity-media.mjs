import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(path, expected, message) {
  assert.ok(read(path).includes(expected), `${message}: missing ${expected}`);
}

const migration = "supabase/migrations/20260730190000_brand_identity_campaign_media.sql";
const mediaService = "src/services/media/brand-media.server.ts";
const draftTypes = "src/types/create-challenge.ts";
const creatorTypes = "src/types/creator-foundation.ts";
const store = "src/services/create-challenge/create-challenge-store.server.ts";
const funding = "src/services/create-challenge/create-challenge-funding.server.ts";
const coverRoute = "src/app/api/create-challenge/media/cover/route.ts";
const draftRoute = "src/app/api/create-challenge/draft/route.ts";
const identityRoute = "src/app/api/dashboard/identity-media/route.ts";
const profileRoute = "src/app/api/dashboard/profile/route.ts";
const companyRoute = "src/app/api/dashboard/company/route.ts";
const profilePage = "src/app/dashboard/settings/profile/page.tsx";
const companyPage = "src/app/dashboard/settings/company/page.tsx";
const identityForms = "src/features/dashboard/components/brand-identity-forms.tsx";
const wizard = "src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx";
const dashboardViewModel = "src/features/dashboard/brand-dashboard-view-model.ts";
const dashboard = "src/features/dashboard/components/brand-dashboard.tsx";
const campaigns = "src/app/dashboard/campaigns/page.tsx";
const workspace = "src/features/dashboard/components/campaign-workspace.tsx";
const publicProjection = "src/services/create-challenge/published-challenge.server.ts";
const publicCard = "src/features/challenges/components/challenge-card.tsx";
const publicDetail = "src/features/challenges/components/challenge-detail.tsx";
const creatorProjection = "src/services/creator-workspace/creator-workspace.server.ts";
const creatorWorkspace = "src/features/creator-workspace/components/creator-workspace.tsx";

includes(migration, "avatar_image_key", "Migration must add account avatar key");
includes(migration, "brand_logo_image_key", "Migration must add brand logo key");
includes(migration, "cover_image_key", "Migration must add campaign cover key");
includes(migration, "'ccn-media'", "Migration must create the media bucket");
includes(migration, "image/jpeg", "Migration must allow JPG");
includes(migration, "image/png", "Migration must allow PNG");
includes(migration, "image/webp", "Migration must allow WebP");
assert.ok(!read(migration).toLowerCase().includes("drop table"), "Migration must not drop tables");

includes(mediaService, "accounts/${input.accountId}/avatar/${fileId}", "Avatar object path must include account scope");
includes(mediaService, "accounts/${input.accountId}/brand-logo/${fileId}", "Brand logo object path must include account scope");
includes(mediaService, "campaigns/${input.draftId}/cover/${fileId}", "Campaign cover object path must include draft scope");
includes(mediaService, "COVER_MAX_BYTES = 5 * 1024 * 1024", "Campaign cover max size must be 5 MB");
includes(mediaService, "IDENTITY_MAX_BYTES = 3 * 1024 * 1024", "Identity image max size must be 3 MB");
includes(mediaService, "hasValidMagicBytes", "Server media validation must inspect image magic bytes");
includes(mediaService, "UNSUPPORTED_IMAGE_TYPE", "Unsupported media types must be rejected");

includes(draftTypes, "coverImageKey", "Draft type must carry canonical cover object key");
includes(creatorTypes, "avatar_image_key", "Account type must carry avatar key");
includes(creatorTypes, "brand_logo_image_key", "Account type must carry brand logo key");
includes(store, "cover_image_key: draft.challenge.coverImageKey", "Store must persist cover key to Supabase");
includes(store, "coverImageKey: normalized.challenge.coverImageKey", "Draft summaries must expose cover key");
includes(store, "preserveExistingCover", "Draft saves must not erase an existing persisted cover with stale null form state");
includes(store, "coverImageUpdatedAt: current.challenge.coverImageUpdatedAt", "Stale draft saves must preserve existing cover timestamp with the cover key");

includes(draftRoute, "resolveCampaignCover", "Draft route must resolve canonical cover media for reload preview");
includes(draftRoute, "cover: resolveCampaignCover", "Draft route response must include canonical cover media");
includes(coverRoute, "assertCreateChallengeDraftOwner", "Cover route must enforce draft ownership");
includes(coverRoute, "uploadBrandMedia", "Cover route must use canonical media upload service");
includes(coverRoute, "patchCreateChallengeDraft", "Cover route must persist key through canonical draft path");
includes(coverRoute, "persisted.challenge.coverImageKey !== uploaded.objectKey", "Cover route must verify canonical key persistence before success");
includes(coverRoute, "coverImageUpdatedAt: new Date().toISOString()", "Cover route must set updated timestamp only after key persistence is verified");
includes(identityRoute, "getAuthenticatedCcnContext({ workspace: \"brand\" })", "Identity route must require Brand context");
includes(identityRoute, "type !== \"avatar\" && type !== \"brand-logo\"", "Identity route must limit supported media types");

includes(profileRoute, "updateBrandProfile", "Profile route must use canonical profile service");
includes(companyRoute, "updateBrandCompany", "Company route must use canonical company service");
includes(profilePage, "BrandProfileForm", "Profile page must render editable profile form");
includes(companyPage, "BrandCompanyForm", "Company page must render editable company form");
includes(identityForms, "/api/dashboard/identity-media", "Identity forms must use server-owned media upload route");

includes(wizard, "CampaignCoverField", "Wizard must include campaign cover field");
includes(wizard, "Optional while drafting, required before publish", "Cover field must explain draft/publish rule");
includes(wizard, "cover?: CampaignCoverView | null", "Draft response must carry canonical cover media for reload preview");
includes(wizard, "displayCoverUrl = previewUrl ?? cover?.imageUrl", "Wizard must render persisted cover URL after refresh");
includes(wizard, "payload.draft.challenge.coverImageKey !== payload.cover.imageKey", "Wizard must not show saved unless persisted key matches the response key");
includes(wizard, "onCoverChange(payload.cover)", "Wizard must update canonical cover state after upload success");
includes(funding, "assertLaunchReadinessBeforePublish", "Publish path must enforce shared launch readiness before publish");
includes(funding, "validateCreateChallengeLaunchReadiness", "Publish path must use shared launch readiness validation");
includes(funding, "CAMPAIGN_COVER_REQUIRED", "Publish path must return a specific cover-required error");

includes(dashboardViewModel, "resolveCampaignCover", "Dashboard view model must resolve campaign media");
includes(dashboard, "row.media.imageUrl", "Dashboard campaign rows must render cover media");
includes(campaigns, "row.media.imageUrl", "Campaigns page must render cover media");
includes(workspace, "resolveCampaignCover", "Campaign workspace must render cover media");
includes(publicProjection, "coverImageUrl", "Public projection must expose cover URL");
includes(publicCard, "challenge.coverImageUrl", "Public challenge cards must render cover media");
includes(publicDetail, "challenge.coverImageUrl", "Public challenge detail must render cover media");
includes(creatorProjection, "coverImageUrl", "Creator projection must expose cover URL");
includes(creatorWorkspace, "challenge.coverImageUrl", "Creator workspace must render cover media");

assert.ok(!read(coverRoute).includes("releasePayout"), "Cover route must not touch payout");
assert.ok(!read(coverRoute).includes("createProductFundingChallenge"), "Cover route must not touch funding");
assert.ok(!read(identityRoute).includes("createProductFundingChallenge"), "Identity upload route must not touch funding");

console.log("Sprint 008 Brand identity and campaign media verification passed.");
