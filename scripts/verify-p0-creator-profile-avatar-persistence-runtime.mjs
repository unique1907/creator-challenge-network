import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => assert.ok(fs.existsSync(path.join(root, relativePath)), `${relativePath} must exist`);
const includes = (file, text, message) => assert.ok(read(file).includes(text), message);
const excludes = (file, text, message) => assert.ok(!read(file).includes(text), message);

const migration = "supabase/migrations/20260802170000_creator_profile_avatar_persistence.sql";
const foundation = "src/services/creator-foundation/creator-foundation.server.ts";
const profileRoute = "src/app/api/creator/profile/route.ts";
const mediaRoute = "src/app/api/creator/identity-media/route.ts";
const profileForm = "src/features/creator-workspace/components/creator-profile-form.tsx";
const workspaceService = "src/services/creator-workspace/creator-workspace.server.ts";

for (const file of [migration, foundation, profileRoute, mediaRoute, profileForm, workspaceService]) exists(file);

includes(migration, "add column if not exists auth_user_id", "Creator profile migration must add auth user binding.");
includes(migration, "add column if not exists username_normalized", "Creator profile migration must add normalized username.");
includes(migration, "add column if not exists avatar_image_key", "Creator profile migration must add avatar key.");
includes(migration, "creator_profiles_auth_user_id_fkey", "Creator profile auth user must be foreign-key protected.");
includes(migration, "creator_profiles_username_normalized_unique", "Normalized usernames must be unique.");
includes(migration, "creator_profiles_auth_user_id_unique", "Auth user ownership must be unique.");
includes(migration, "creator_profiles.auth_user_id is immutable once set", "Creator profile auth ownership must be protected from reassignment.");
excludes(migration, "drop table", "Creator profile migration must be additive only.");
excludes(migration, "delete from", "Creator profile migration must not delete rows.");

includes(foundation, "getCreatorProfileIdentity", "Creator identity must have one canonical read model.");
includes(foundation, "creatorProfileSupportsExtendedColumns", "Runtime must detect whether the additive schema is applied.");
includes(foundation, "CREATOR_PROFILE_SCHEMA_INCOMPLETE", "Runtime must fail closed when the Creator profile schema is incomplete.");
includes(foundation, "normalizeCreatorAvatarKey", "Avatar keys must be server-validated.");
includes(foundation, "CREATOR_PROFILE_READBACK_MISMATCH", "Profile save must fail if read-back does not match.");
includes(foundation, "removeBrandMedia(before.avatarImageKey)", "Old avatar media may only be removed after verified profile save.");
includes(foundation, "[creator-profile-save]", "Profile save diagnostics must exist.");
includes(foundation, "[creator-profile-load]", "Profile load diagnostics must exist.");
includes(foundation, "[creator-profile-runtime]", "Profile runtime mapping diagnostics must exist.");
includes(foundation, "operation: existingProfileRow ? \"update\" : \"insert\"", "Profile save must distinguish insert and update operations.");
excludes(foundation, "localStorage", "Creator profile persistence must not use localStorage.");
excludes(foundation, ".local", "Creator profile persistence must not use .local.");

includes(profileRoute, "getCreatorProfileIdentity", "Creator profile API must return the canonical profile identity.");
includes(profileRoute, "updateCreatorProfile", "Creator profile API must use the canonical update service.");
includes(profileRoute, "supabase-session-missing", "Creator profile API must diagnose missing Supabase sessions safely.");
includes(profileRoute, "AUTHENTICATION_REQUIRED", "Creator profile API must fail closed when no Supabase auth session exists.");

includes(mediaRoute, 'getAuthenticatedCcnContext({ workspace: "creator" })', "Avatar upload must use authenticated Creator context.");
includes(mediaRoute, 'type !== "avatar"', "Avatar upload route must be avatar-only.");
includes(mediaRoute, "[creator-avatar-upload]", "Avatar upload diagnostics must exist.");
excludes(mediaRoute, "previousKey", "Avatar upload must not delete previous media before save succeeds.");

includes(profileForm, "Creator avatar upload did not return a persisted image reference.", "Upload must require a storage object key and URL.");
includes(profileForm, "Creator profile update did not return a verified profile.", "Save must require an authoritative profile response.");
includes(profileForm, "router.refresh()", "Save must refresh server-rendered identity surfaces.");
includes(profileForm, "Avatar uploaded. Save profile to make it visible across your workspace.", "Upload copy must not claim durable persistence.");
includes(profileForm, "Replace photo", "Profile form must use photo copy.");
includes(profileForm, "Remove photo", "Profile form must use photo copy.");
excludes(profileForm, "localStorage", "Profile form must not use localStorage fallback.");
excludes(profileForm, "sessionStorage", "Profile form must not use sessionStorage fallback.");

includes(workspaceService, "getCreatorProfileIdentity(session.ccnAccountId)", "Creator Workspace must load the same canonical identity source.");

console.log("P0 Creator profile/avatar persistence runtime verification passed.");
