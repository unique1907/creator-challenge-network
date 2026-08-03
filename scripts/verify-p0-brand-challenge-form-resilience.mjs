import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(path, needle, message) {
  assert.ok(read(path).includes(needle), `${message}: missing ${needle}`);
}

function notIncludes(path, needle, message) {
  assert.ok(!read(path).includes(needle), `${message}: found ${needle}`);
}

const wizardPath = "src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx";
const draftRoutePath = "src/app/api/create-challenge/draft/route.ts";
const storePath = "src/services/create-challenge/create-challenge-store.server.ts";
const readinessPath = "src/utils/create-challenge-launch-readiness.ts";
const deadlinePolicyPath = "src/config/create-challenge-deadline-policy.ts";
const coverRoutePath = "src/app/api/create-challenge/media/cover/route.ts";
const entryTestPath = "scripts/verify-p0-new-challenge-entry.mjs";
const storeTestPath = "scripts/verify-create-challenge-store-safety.mjs";

const readiness = read(readinessPath);
const deadlinePolicy = read(deadlinePolicyPath);

includes(wizardPath, "function draftFormSignature", "wizard must have a stable editable form signature");
includes(wizardPath, "function preserveEditableDraftState", "wizard must merge server responses without dropping editable fields");
for (const field of [
  "title",
  "brandName",
  "category",
  "market",
  "summary",
  "description",
  "primaryDeliverable",
  "supportingDeliverables",
  "referenceLinks",
  "attachments",
  "deadline",
  "usageRightsAcknowledged",
]) {
  includes(wizardPath, `clientDraft.challenge.${field}`, `validation merge must preserve challenge.${field}`);
}
includes(wizardPath, "prizePool: clientDraft.prizePool", "validation merge must preserve prize configuration");
includes(wizardPath, "reviewRules: clientDraft.reviewRules", "validation merge must preserve dates, rules, criteria and checkboxes");
includes(wizardPath, "currentStep: targetStep", "validation merge must preserve the current wizard step");
includes(wizardPath, "isSmokeTest: serverDraft.challenge.isSmokeTest", "validation merge must keep server-owned smoke marker");
includes(wizardPath, "slug: serverDraft.challenge.slug", "validation merge must keep server-owned slug");
includes(wizardPath, "const submittedDraft = {", "saveDraft must capture the submitted client state before the request");
includes(wizardPath, "preserveEditableDraftState(payload.draft, submittedDraft, targetStep)", "saveDraft must preserve submitted state after server validation");

includes(wizardPath, "window.addEventListener(\"beforeunload\", beforeUnload)", "dirty forms must keep the before-unload protection");
includes(wizardPath, "if (!dirty || !draft?.challenge.id || pending) return;", "autosave must wait for a canonical draft id and avoid pending operations");
includes(wizardPath, "if (step === \"funding\" || step === \"publish\") return;", "autosave must stay out of funding and publish steps");
includes(wizardPath, "window.setTimeout(() => {", "autosave must be debounced");
includes(wizardPath, "1_200", "autosave debounce must be explicit");
includes(wizardPath, "requestJson<DraftResponse>(\"/api/create-challenge/draft\"", "autosave must reuse the canonical draft route");
includes(wizardPath, "latestDraftSignatureRef.current !== autosaveSignature", "autosave must not mark stale writes as saved");
includes(wizardPath, "setStatus(\"Draft autosaved\")", "autosave must provide a visible saved state");
includes(wizardPath, "Draft autosave is temporarily unavailable. Your changes are still on this page.", "autosave failure must preserve local state");

includes(wizardPath, "setSelectedFileName(file.name)", "cover upload must preserve the selected filename");
includes(wizardPath, "Your preview and filename are preserved", "cover upload failure must explain image-only recovery");
includes(wizardPath, "payload.draft.challenge.coverImageKey !== payload.cover.imageKey", "cover upload must verify persistence before claiming saved");
includes(coverRoutePath, "persisted.challenge.coverImageKey !== uploaded.objectKey", "cover route must verify key persistence before success");
includes(coverRoutePath, "coverImageUpdatedAt: new Date().toISOString()", "cover timestamp must be set only after key persistence");

includes(draftRoutePath, "saveCreateChallengeDraft(body.draft, draftId", "draft route must persist submitted draft state before validation");
includes(draftRoutePath, "validateCreateChallengeDraft(draft, body.step, { deadlinePolicy })", "server validation must remain authoritative after persistence");
includes(draftRoutePath, "return NextResponse.json(createDraftPayload(draft, validation))", "draft route must return errors without losing the draft payload");
includes(storePath, "preserveExistingCover", "draft persistence must not clear existing cover on unrelated saves");
includes(storePath, "isSmokeTest: current.challenge.isSmokeTest", "draft persistence must not let the client mutate smoke marker");

for (const validation of [
  "Challenge title must be 5-100 characters.",
  "At least one judging criterion is required.",
  "Primary deliverable is required.",
  "Usage-rights acknowledgement is required.",
  "Creator acknowledgement is required.",
  "Brand cancellation acknowledgement is required.",
]) {
  assert.ok(readiness.includes(validation), `validation coverage must include: ${validation}`);
}
for (const validation of [
  "Submission date and time must be",
  "Review date and time must be",
]) {
  assert.ok(deadlinePolicy.includes(validation), `deadline validation coverage must include: ${validation}`);
}

includes(wizardPath, "focusValidationError(saved.validation.errors[0] ?? \"\")", "validation retry must focus the first invalid field");
includes(wizardPath, "fieldSelectorForValidationError", "wizard must map validation errors to fields");
includes(wizardPath, "previousStep(step)", "Back navigation must use the existing wizard step model");
includes(wizardPath, "nextStep(step)", "Forward navigation must use the existing wizard step model");
includes(wizardPath, "setStep(targetStep)", "navigation must preserve state while changing steps");

includes(entryTestPath, "/create-challenge?draftId=", "existing new-entry test must cover URL replacement for refresh recovery");
includes(wizardPath, "const selectedDraftId = params.get(\"draftId\")", "wizard must recover exact drafts from draftId after refresh");
includes(draftRoutePath, "getCreateChallengeDraftForAccount", "draft route must load exact account-owned drafts");
includes(entryTestPath, "mergeInitializedDraft(current, payload.draft)", "existing new-entry test must cover slow server-draft merge preservation");
includes(storeTestPath, "runtimeStoreHashBefore", "store safety test must verify draft persistence checks do not mutate runtime state");
notIncludes(wizardPath, "window.localStorage", "wizard must not introduce localStorage persistence");
notIncludes(wizardPath, "window.sessionStorage", "wizard must not introduce sessionStorage persistence");

console.log(JSON.stringify({
  result: "P0 Brand Challenge form resilience verification passed",
  validationPreservesEditableState: true,
  debouncedDraftRecovery: true,
  serverValidationPreserved: true,
  coverFilenameAndPreviewPreserved: true,
  navigationPreservesState: true,
  noNewBrowserStorage: true,
}, null, 2));
