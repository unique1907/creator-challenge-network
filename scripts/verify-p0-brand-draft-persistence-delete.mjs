import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

const store = read("src/services/create-challenge/create-challenge-store.server.ts");
const route = read("src/app/api/create-challenge/draft/route.ts");
const wizard = read("src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx");
const types = read("src/types/create-challenge.ts");

assert.ok(
  types.includes('draftPersistenceStatus?: "transient" | "intentional"'),
  "Draft type must distinguish transient and intentionally persisted drafts.",
);

assert.ok(
  store.includes('withDraftPersistenceStatus(withInitialBrandName(createCleanDraft(), input.brandName), "transient")'),
  "New production drafts must start as transient server-reserved drafts.",
);
assert.ok(
  store.includes('withDraftPersistenceStatus(withInitialBrandName(createCleanSmokeTestDraft(), input.brandName), "transient")'),
  "Smoke drafts must also start as transient until explicitly saved.",
);
assert.ok(
  store.includes(".filter((draft) => !isTransientCreateChallengeDraft(draft))"),
  "Saved draft list projections must exclude transient drafts.",
);
assert.ok(
  store.includes("intentionalPersistence?: boolean") &&
    store.includes('draftPersistenceStatus: input.intentionalPersistence') &&
    store.includes('? "intentional"'),
  "saveCreateChallengeDraft must promote drafts only when intentionalPersistence is true.",
);
assert.ok(
  store.includes("const reservation = isTransientCreateChallengeDraft(merged)") &&
    store.includes("? { store, draft: merged }") &&
    store.includes(": await reservePublicSlug(store, merged)"),
  "Transient autosaves must not reserve public slugs.",
);

for (const guard of [
  "Only unpublished draft challenges can be deleted.",
  "Draft cannot be deleted after prize pool escrow starts.",
  "Draft cannot be deleted after payment approval or funding starts.",
  "Draft cannot be deleted because payment evidence exists.",
  "Draft cannot be deleted because payment attempts exist.",
  "Draft cannot be deleted because winner selection evidence exists.",
  "Draft cannot be deleted because on-chain verification evidence exists.",
  "Draft cannot be deleted because creator submissions exist.",
]) {
  assert.ok(store.includes(guard), `Delete guard missing: ${guard}`);
}

assert.ok(
  store.includes('from("ccn_challenge_drafts").delete().eq("draft_id", input.draftId)') &&
    store.includes('from("ccn_challenge_funding_records")') &&
    store.includes('from("ccn_public_slug_reservations").delete().eq("draft_id", input.draftId)'),
  "Supabase deletion must remove only the guarded draft, funding scope, and slug reservation rows.",
);

assert.ok(route.includes("export async function DELETE(request: Request)"), "Draft API must expose guarded DELETE.");
assert.ok(route.includes("deleteCreateChallengeDraft(draftId, { ccnAccountId: context.ccnAccountId })"), "DELETE must enforce Brand ownership.");
assert.ok(route.includes("DraftDeletionError"), "DELETE failures must use safe route errors.");

assert.ok(wizard.includes("async function deleteCurrentDraft"), "Wizard must expose an explicit Delete Draft action.");
assert.ok(wizard.includes("window.confirm(\"Delete this draft?"), "Delete Draft must require confirmation.");
assert.ok(wizard.includes("deletePending") && wizard.includes("Deleting..."), "Delete Draft must prevent duplicate delete clicks.");
assert.ok(wizard.includes("intentionalPersistence: true"), "Save/Continue must intentionally persist drafts.");
assert.ok(
  wizard.includes('setStatus("Draft autosaved")') &&
    !/setStatus\("Draft autosaved"[\s\S]{0,500}intentionalPersistence:\s*true/.test(wizard),
  "Autosave must not promote a transient draft to intentional persistence.",
);
assert.ok(
  wizard.includes("draftIsTransient") &&
    wizard.includes("exitToDashboard") &&
    wizard.includes("transientOnly: true"),
  "In-app Exit/New flows must clean up transient drafts without deleting saved drafts.",
);

console.log("P0 Brand draft persistence/delete verifier passed.");
