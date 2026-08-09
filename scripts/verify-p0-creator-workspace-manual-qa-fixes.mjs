import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => assert.ok(fs.existsSync(path.join(root, relativePath)), `${relativePath} must exist`);
const includes = (file, text, message) => assert.ok(read(file).includes(text), message);
const excludes = (file, text, message) => assert.ok(!read(file).includes(text), message);

const workspace = "src/features/creator-workspace/components/creator-workspace.tsx";
const profileForm = "src/features/creator-workspace/components/creator-profile-form.tsx";
const userMenu = "src/components/auth/user-menu.tsx";
const service = "src/services/creator-workspace/creator-workspace.server.ts";
const foundation = "src/services/creator-foundation/creator-foundation.server.ts";
const profileRoute = "src/app/api/creator/profile/route.ts";
const mediaRoute = "src/app/api/creator/identity-media/route.ts";
const publicEligibility = "src/services/create-challenge/public-challenge-eligibility.ts";
const loadingFiles = [
  "src/app/dashboard/creator/loading.tsx",
  "src/app/dashboard/creator/discover/loading.tsx",
  "src/app/dashboard/creator/challenges/[slug]/loading.tsx",
  "src/app/dashboard/creator/submissions/loading.tsx",
  "src/app/dashboard/creator/submissions/[submissionId]/loading.tsx",
  "src/app/dashboard/creator/wallet/loading.tsx",
  "src/app/dashboard/creator/profile/loading.tsx",
  "src/app/dashboard/creator/notifications/loading.tsx",
  "src/app/dashboard/creator/rewards/loading.tsx",
];

for (const file of [workspace, profileForm, userMenu, service, foundation, profileRoute, mediaRoute, publicEligibility, ...loadingFiles]) exists(file);

for (const file of loadingFiles) {
  excludes(file, "Loading this section", `${file} must not use the generic route loading copy.`);
  includes(file, "aria-label=\"Preparing", `${file} must expose a route-aware loading label.`);
  includes(file, "motion-safe:animate-pulse", `${file} must render skeleton placeholders without replacing the shell.`);
}

includes(service, "explainCreatorEligibility", "Creator discovery must use a shared eligibility explanation.");
includes(service, "[creator-challenge-eligibility]", "Creator discovery must provide safe development diagnostics.");
includes(service, "exclusionReasons", "Creator eligibility diagnostics must report exclusion reasons.");
includes(service, "isPublicLiveEligibleDraft", "Creator discovery must use the shared public-live helper.");
includes(publicEligibility, 'fundingStatus !== "funded" && fundingStatus !== "live"', "Creator discovery must accept funded and live states.");
excludes(service, "markers.includes", "Creator discovery must not title-filter demo/test challenges.");
excludes(service, "draft.challenge.title.includes", "Creator discovery must not title-filter by title.");

includes(foundation, "getCreatorProfileIdentity", "Creator profile summary must use the canonical profile identity resolver.");
includes(foundation, "avatar_image_key", "Creator profile updates must persist avatar keys on the canonical account row.");
includes(foundation, "CREATOR_PROFILE_READBACK_MISMATCH", "Creator profile saves must verify a canonical read-back before reporting success.");
includes(foundation, "[creator-profile-save]", "Creator profile saves must include safe development diagnostics.");
includes(foundation, "[creator-profile-load]", "Creator profile loads must include safe development diagnostics.");
includes(foundation, "CREATOR_PROFILE_UPDATED", "Creator profile saves must remain audited.");
includes(profileRoute, "avatarImageKey: body.avatarImageKey", "Creator profile route must persist avatar image keys server-side.");
includes(profileRoute, "getCreatorProfileIdentity", "Creator profile route must return the canonical identity snapshot.");

includes(mediaRoute, 'getAuthenticatedCcnContext({ workspace: "creator" })', "Creator media route must authenticate Creator context server-side.");
includes(mediaRoute, 'type !== "avatar"', "Creator media route must be avatar-only.");
includes(mediaRoute, 'kind: "avatar"', "Creator media route must reuse the existing avatar media kind.");
includes(mediaRoute, "uploadBrandMedia", "Creator media route must reuse the approved media upload architecture.");
includes(mediaRoute, "[creator-avatar-upload]", "Creator avatar uploads must include safe development diagnostics.");
excludes(mediaRoute, "brand-logo", "Creator media route must not upload brand logos.");
excludes(mediaRoute, "campaign-cover", "Creator media route must not upload campaign covers.");
excludes(mediaRoute, "previousKey", "Creator avatar upload route must not delete prior media before profile save succeeds.");

includes(profileForm, "/api/creator/identity-media", "Creator profile form must upload avatars through the Creator media route.");
includes(profileForm, "Avatar uploaded. Save profile to make it visible across your workspace.", "Avatar upload must not claim profile persistence before save.");
includes(profileForm, "Avatar removed. Save profile to update your workspace.", "Avatar removal must require a canonical profile save.");
includes(profileForm, "router.refresh()", "Creator profile save must refresh server-rendered identity surfaces.");
includes(profileForm, "Replace photo", "Creator avatar replacement copy must use photo language.");
includes(profileForm, "avatarImageKey", "Creator profile form must submit the canonical avatar key.");
includes(profileForm, "image/jpeg,image/png,image/webp", "Creator avatar chooser must restrict supported image types.");
excludes(profileForm, "Avatar, bio and social-profile fields require", "Old fake-unavailable avatar copy must be removed.");

includes(workspace, "avatarImageUrl", "Creator shell/profile surfaces must render persisted avatar URLs.");
includes(userMenu, "avatarUrl", "User menu must accept avatar URLs.");
includes(userMenu, 'href="/dashboard/creator/profile"', "Creator user menu must expose Profile.");
includes(workspace, "Withdraw (Beta)", "Wallet rail must use the requested Withdraw beta wording.");
excludes(workspace, "Transfers coming later", "Old transfer placeholder copy must be removed.");

console.log("P0 Creator workspace manual QA fixes verification passed.");
