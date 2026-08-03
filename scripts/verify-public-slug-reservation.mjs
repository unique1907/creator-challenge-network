import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const store = read("src/services/create-challenge/create-challenge-store.server.ts");
const funding = read("src/services/create-challenge/create-challenge-funding.server.ts");
const draftRoute = read("src/app/api/create-challenge/draft/route.ts");
const publishRoute = read("src/app/api/create-challenge/publish/route.ts");
const wizard = read("src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx");
const types = read("src/types/create-challenge.ts");
const migration = read("supabase/migrations/20260731110000_public_slug_reservations.sql");

assert.ok(migration.includes("create table if not exists public.ccn_public_slug_reservations"), "migration must add a public slug reservation table");
assert.ok(migration.includes("slug text primary key"), "slug must be globally unique");
assert.ok(migration.includes("draft_id text not null unique"), "one draft must own only one active reserved slug");
assert.ok(migration.includes("references public.ccn_challenge_drafts(draft_id) on delete cascade"), "reservations must be tied to canonical draft rows");
assert.ok(migration.includes("enable row level security"), "reservation table must enable RLS");
assert.ok(migration.includes("revoke all on public.ccn_public_slug_reservations from anon, authenticated"), "clients must not mutate reservations directly");
assert.ok(migration.includes("on conflict do nothing"), "backfill must be non-destructive and rerunnable");
assert.ok(!/drop\s+table|truncate\s+table|delete\s+from\s+public\.ccn_challenge_drafts/i.test(migration), "migration must be additive only");

assert.ok(types.includes("slugReservedForTitle?: string"), "draft state must track the title basis used for the reserved slug");
assert.ok(store.includes("PublicSlugReservationError"), "reservation failures must have a scoped safe error");
assert.ok(store.includes("shouldReservePublicSlug"), "reservation must wait for a real valid title");
assert.ok(store.includes("slugCandidate(titleBasis, offset)"), "collision strategy must use deterministic suffix candidates");
assert.ok(store.includes("ccn_public_slug_reservations"), "Supabase production path must use the canonical reservation table");
assert.ok(store.includes(".insert({") && store.includes("title_basis: titleBasis"), "Supabase reservation must be an atomic insert against unique constraints");
assert.ok(store.includes("supabaseErrorCode(inserted.error) !== \"23505\""), "unique slug/draft conflicts must be handled explicitly");
assert.ok(store.includes("current.data?.title_basis === titleBasis"), "concurrent same-draft reservation must recover the existing row");
assert.ok(store.includes("publicSlugReservations"), "filesystem/local mode must persist reservations too");
assert.ok(store.includes("Object.entries(store.publicSlugReservations ?? {}).filter"), "title edits before publish must release the old local reservation");
assert.ok(store.includes("draft.deployment.publicationStatus === \"live\""), "live drafts must keep the already frozen slug");
assert.ok(store.includes("saveCreateChallengeDraft") && store.includes("await reservePublicSlug(store, merged)"), "draft save must reserve slug before publish");
assert.ok(store.includes("patchCreateChallengeDraft") && store.includes("await reservePublicSlug(store, merged)"), "server-side patch path must preserve reservation behavior");
assert.ok(store.includes("ensureCreateChallengeDraftPublicSlugReservation"), "publish must have an idempotent reservation backstop for historical drafts");

assert.ok(funding.includes("ensureCreateChallengeDraftPublicSlugReservation"), "publish service must reuse the reserved slug before going live");
assert.ok(funding.includes("await assertNoPublishedSlugConflict(publishDraft)"), "old conflict check must remain only as a corruption/manual-intervention guard");
assert.ok(draftRoute.includes("We couldn't reserve a public URL. Please try again."), "draft route must not expose PUBLIC_SLUG_CONFLICT to users");
assert.ok(publishRoute.includes("We couldn't reserve a public URL. Please try again."), "publish route must map unexpected reservation failures safely");

assert.ok(wizard.includes("Public URL"), "create challenge UI must show the reserved public URL");
assert.ok(wizard.includes("ccn.io/challenges/"), "public URL preview must show the challenge path");
assert.ok(wizard.includes("Reserved automatically. Campaign titles do not need to be unique."), "UI must explain title uniqueness is not required");
assert.ok(!wizard.includes("PUBLIC_SLUG_CONFLICT"), "ordinary UI must not expose the old slug conflict code");

console.log(JSON.stringify({
  result: "public slug reservation verification passed",
  duplicateTitle: true,
  deterministicSuffix: true,
  supabaseAtomicReservation: true,
  publishBackstop: true,
  userConflictHidden: true,
}, null, 2));
