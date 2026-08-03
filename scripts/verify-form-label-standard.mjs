import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(path, expected, message) {
  assert.ok(read(path).includes(expected), `${message}: missing ${expected}`);
}

function excludes(path, expected, message) {
  assert.ok(!read(path).includes(expected), `${message}: unexpected ${expected}`);
}

const formLabel = "src/components/ui/form-label.tsx";
const authActions = "src/features/auth/components/auth-actions.tsx";
const signUpEntry = "src/features/auth/components/sign-up-entry.tsx";
const brandOnboarding = "src/features/auth/components/brand-onboarding/brand-onboarding-form.tsx";
const brandIdentity = "src/features/dashboard/components/brand-identity-forms.tsx";
const brandProfilePage = "src/app/dashboard/settings/profile/page.tsx";
const createChallenge = "src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx";
const creatorActions = "src/features/creator-workspace/components/creator-actions.tsx";

includes(formLabel, "required && optional", "FormLabel must reject required and optional together");
includes(formLabel, "text-rose-300", "Required marker must be visibly red");
includes(formLabel, "sr-only", "Required marker must include non-color screen-reader text");
includes(formLabel, "(Optional)", "Optional marker must use locked wording");
includes(formLabel, "Read only", "Read-only marker must use locked wording");

includes(authActions, "<FormLabel required>Email</FormLabel>", "Auth email field must show required label");
includes(authActions, "required", "Auth email/OTP controls must expose native required state");
includes(authActions, 'aria-required="true"', "Auth email/OTP controls must expose aria-required");
includes(signUpEntry, "<FormLabel required>Primary role</FormLabel>", "Sign-up role choice must show required label");

includes(brandOnboarding, "<FormLabel required>Display name</FormLabel>", "Brand onboarding display name must be required");
includes(brandOnboarding, "<FormLabel required>Company / Brand name</FormLabel>", "Brand onboarding company name must be required");
includes(brandOnboarding, "readOnly", "Brand onboarding account email must be read-only");

includes(brandIdentity, "<FormLabel required>Display name</FormLabel>", "Brand profile display name must be required");
includes(brandIdentity, "<Text label=\"Company / Brand name\"", "Company form must use the shared text helper");
includes(brandIdentity, "required />", "Company/Brand name must be marked required");
includes(brandIdentity, "optional />", "Optional company fields must use the optional marker");
includes(brandIdentity, "readOnly", "Brand identity read-only fields must be marked");
includes(brandProfilePage, "<FormLabel readOnly", "Brand profile read-only company identity must be marked");

includes(createChallenge, "<FormLabel required>Category</FormLabel>", "Challenge category must be marked required");
includes(createChallenge, "label=\"Challenge title\" required", "Challenge title must be marked required");
includes(createChallenge, "label=\"Supporting deliverables\" optional", "Supporting deliverables must be marked optional");
includes(createChallenge, "label=\"Reference links\" optional", "Reference links must be marked optional");
includes(createChallenge, "Optional while drafting · Required before publish", "Campaign cover must show draft/publish distinction");
includes(createChallenge, "label=\"Total prize pool in test USDC\"", "Prize pool field must remain present");
includes(createChallenge, "<FormLabel required>Judging criteria</FormLabel>", "Judging criteria must show required-before-publish intent");
includes(createChallenge, "label=\"Usage rights summary\" required", "Usage rights summary must be marked required");

includes(creatorActions, "<FormLabel required>Submission title</FormLabel>", "Creator submission title must be required");
includes(creatorActions, "<FormLabel required>Concept summary</FormLabel>", "Creator concept summary must be required");
includes(creatorActions, "<FormLabel required>Main project link</FormLabel>", "Creator main project link must be required");
includes(creatorActions, "<FormLabel optional>Supporting links</FormLabel>", "Creator supporting links must be optional");

excludes(createChallenge, "Supporting deliverables, optional", "Create Challenge must not use one-off optional label copy");
excludes(createChallenge, "Reference links, optional", "Create Challenge must not use one-off optional label copy");

console.log("Form label standard verification passed.");
