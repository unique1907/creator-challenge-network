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
const draftRoute = read("src/app/api/create-challenge/draft/route.ts");
const store = read("src/services/create-challenge/create-challenge-store.server.ts");
const readiness = read("src/utils/create-challenge-launch-readiness.ts");
const publicProjection = read("src/services/create-challenge/published-challenge.server.ts");
const profileVerifier = read("scripts/verify-p0-brand-profile-identity-source.mjs");

includes(brandIdentity, "normalizeBrandCompanyName", "Canonical Brand/company identity must be normalized through the shared identity helper.");
includes(brandIdentity, "brandName: normalizeBrandCompanyName(account.brand_name)", "Canonical Brand/company identity must come from accounts.brand_name.");
includes(auth, "const brandIdentity = resolveBrandAccountIdentity(input.account)", "Auth context must resolve Brand identity from the canonical account record.");
includes(auth, "brandName: brandIdentity.brandName", "Auth context Brand name must be the canonical Brand/company value.");

includes(draftRoute, "brandName: context.brandName", "Create Challenge draft route must prefill from canonical Brand/company identity when present.");
excludes(draftRoute, "brandName: context.brandName ?? context.displayName", "Create Challenge draft route must not fall back to personal display name.");
excludes(draftRoute, "brandName: context.brandName ?? context.displayName ??", "Create Challenge draft route must not fall back to personal display name or username chains.");
excludes(draftRoute, "context.displayName", "Create Challenge draft route must not use personal display name as Brand field input.");
excludes(draftRoute, "username", "Create Challenge draft route must not use username as Brand field input.");
excludes(draftRoute, "email.split", "Create Challenge draft route must not derive Brand field from email prefix.");

includes(store, "function withInitialBrandName", "Draft store must centralize initial Brand name autofill.");
includes(store, "if (!cleanBrandName || draft.challenge.brandName.trim()) return draft;", "Missing canonical Brand name must leave the Brand field empty and must not overwrite existing draft values.");
includes(store, "brandName: cleanBrandName", "Existing canonical Brand name must prefill the draft Brand field.");
excludes(store, "updateBrandCompany", "Draft store must not mutate canonical Brand/company profile identity.");
excludes(draftRoute, "updateBrandCompany", "Draft route must not mutate canonical Brand/company profile identity.");
excludes(draftRoute, ".from(\"accounts\")", "Draft route must not write account identity directly.");

includes(readiness, "Brand name is required.", "Missing canonical Brand identity must be caught by existing required Brand-field validation.");
includes(publicProjection, "brand: draft.challenge.brandName", "Public projection must use the Brand identity persisted on the challenge, not account display name.");
excludes(publicProjection, "displayName", "Public projection must not expose personal display name as challenge Brand identity.");
includes(profileVerifier, "Challenge drafts must not fall back from Brand/company identity to personal display name", "Brand profile identity verifier must protect this regression.");
includes(auth, "export async function requireBrandWorkspace", "Brand-only workspace access must remain protected by the shared auth guard.");
includes(draftRoute, "requireBrandWorkspace", "Create Challenge draft route must remain Brand-workspace scoped.");

console.log(JSON.stringify({
  result: "P0 Brand challenge form canonical identity verifier passed",
  canonicalBrandSource: "accounts.brand_name via resolveBrandAccountIdentity",
  missingBrandFallback: "empty form field plus existing Brand name validation",
  personalIdentityFallbackRemoved: true,
  profileMutation: false,
}, null, 2));
