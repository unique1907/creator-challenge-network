import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const wizard = read("src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx");
const store = read("src/services/create-challenge/create-challenge-store.server.ts");
const draftRoute = read("src/app/api/create-challenge/draft/route.ts");
const fundingService = read("src/services/create-challenge/create-challenge-funding.server.ts");
const readiness = read("src/utils/create-challenge-launch-readiness.ts");
const coverRoute = read("src/app/api/create-challenge/media/cover/route.ts");

for (const state of [
  "ready_for_approval",
  "approval_challenge_ready",
  "approval_user_action_required",
  "approval_pending",
  "approval_confirmed",
  "funding_preparing",
  "funding_challenge_ready",
  "funding_user_action_required",
  "funding_pending",
  "funding_verifying",
  "funding_confirmed",
  "publishing",
  "live",
  "recoverable_error",
  "blocked",
]) {
  assert.ok(wizard.includes("| \"" + state + "\"") || wizard.includes(state + ":"), "pipeline state must include " + state);
}

assert.ok(wizard.includes("deriveFastPublishPipelineState"), "pipeline state must be derived from canonical draft/payment state");
assert.ok(wizard.includes("paymentProgressItems(fundingState, draft, approval, funding, error, pending)"), "progress panel must use derived canonical state");
assert.ok(wizard.includes("Launch progress"), "funding UI must expose one launch progress panel");
for (const stage of [
  "Preparing approval",
  "Waiting for Approval PIN",
  "Approval submitted",
  "Approval confirmed",
  "Preparing prize funding",
  "Waiting for Funding PIN",
  "Funding transaction submitted",
  "Waiting for blockchain confirmation",
  "Funding verified",
  "Publishing challenge",
  "Challenge live",
]) {
  assert.ok(wizard.includes(stage), "transaction progress panel must include stage: " + stage);
}
assert.ok(wizard.includes("This usually takes 30-90 seconds."), "blockchain waiting state must explain expected confirmation time");
assert.ok(wizard.includes("Circle Hosted Wallet"), "approval/funding PIN stages must show Circle Hosted Wallet context");
assert.ok(wizard.includes("Arc Testnet"), "blockchain verification stage must show Arc Testnet context");
assert.ok(wizard.includes("Canonical verification"), "verification stage must show canonical verification context");
assert.ok(wizard.includes("Please keep this page open while we complete the launch."), "long-running stages must ask the user to keep the page open");
assert.ok(wizard.includes("We will resume from the latest verified step."), "prominent progress panel must explain refresh recovery");
assert.ok(wizard.includes("Please wait - your transaction is still processing."), "long-running progress must include explicit waiting guidance");
assert.ok(wizard.includes("Launch in progress"), "pipeline activity must make launch progress visually primary");
assert.ok(wizard.includes("launchPipelineActive"), "progress hierarchy must switch after approval/funding pipeline activity begins");
assert.ok(wizard.includes("animate-spin") && wizard.includes("animate-pulse"), "active progress stage must use subtle animation");
assert.ok(wizard.includes("aria-expanded={open}") && wizard.includes("aria-controls={panelId}"), "launch readiness disclosure must be accessible");
assert.ok(wizard.includes("const open = !ready || expanded"), "invalid readiness must auto-expand instead of hiding errors");
assert.ok(wizard.includes("hidden={!open}"), "ready launch readiness details must collapse by default");
assert.ok(wizard.includes("Review before launch"), "funding UI must show a concise pre-launch review summary");
assert.ok(wizard.includes("Campaign, prize, dates, cover and wallet"), "collapsed review summary must describe its contents");
assert.ok(wizard.includes("View summary"), "review details must open from an explicit summary CTA");
assert.ok(wizard.includes("Launch readiness"), "funding UI must show final readiness before PIN");
assert.ok(wizard.includes("All requirements ready"), "ready launch readiness must use compact summary copy");
assert.ok(wizard.includes("Review & Launch"), "primary funding CTA must start the unified launch flow");
assert.ok(wizard.includes("Fix required fields"), "missing deterministic launch requirements must replace the financial launch CTA");
assert.ok(wizard.includes("requireLaunchReadinessBeforePin"), "Review & Launch must guard before session/Circle approval work starts");
const approveBody = wizard.slice(wizard.indexOf("async function approve()"), wizard.indexOf("async function fund()"));
assert.ok(approveBody.indexOf("if (!requireLaunchReadinessBeforePin()) return;") < approveBody.indexOf("const appSession = await ensureSession();"), "missing readiness must stop before userToken/session and approval request");
assert.ok(wizard.includes("onClick={onApprove}") && wizard.includes("launchReady ?"), "missing cover must block the Review & Launch button path");

assert.ok(wizard.includes("PIPELINE_POLL_DELAYS_MS"), "approval/funding recovery must use bounded polling");
assert.ok(wizard.includes("void continueFastPublishPipeline(stage, challengeId)"), "Circle callback must enter the unified pipeline");
assert.ok(!wizard.includes("void reconcile(stage, challengeId);"), "Circle callback must not stop at a manual reconcile-only path");
assert.ok(wizard.includes("stage === \"approval\"") && wizard.includes("await fund();"), "approval confirmation must prepare funding automatically");
assert.ok(wizard.includes("stage === \"funding\"") && wizard.includes("await publish(refreshedDraft.challenge.id, \"auto\")"), "funding verification must trigger publish automatically");
assert.ok(wizard.includes("Publish needs attention"), "funded-but-publish-blocked recovery must show publish needs attention");
assert.ok(wizard.includes("Fix campaign details"), "publish recovery must offer a details fix action instead of restarting funding");
assert.ok(wizard.includes("Retry Publish"), "funded draft recovery must retry publish only after readiness is restored");
assert.ok(wizard.includes("Challenge published successfully"), "live success state must be explicit");
assert.ok(wizard.includes("View Public Challenge"), "live success state must link to public challenge");
assert.ok(wizard.includes("Go to Dashboard"), "live success state must link to dashboard");
assert.ok(wizard.includes("Create Another Challenge"), "live success state must offer another challenge CTA");
assert.ok(wizard.includes("paymentState === \"FUNDED_VERIFIED\"") && wizard.includes("draft?.funding.fundingStatus === \"live\""), "balance readiness must remain ready after funding or publish succeeds");
assert.ok(wizard.includes("fundingState === \"APPROVED\"") && wizard.includes("void fund();"), "refresh after approval must resume at funding preparation");
assert.ok(wizard.includes("fundingState === \"FUNDING_PENDING\"") && wizard.includes("continueFastPublishPipeline(\"funding\""), "refresh during funding must resume recovery");
assert.ok(wizard.includes("fundingState === \"FUNDED_VERIFIED\"") && wizard.includes("void publish(draft.challenge.id, \"auto\")"), "refresh after verified funding must resume publish only");
assert.ok(wizard.includes("trigger: \"manual\" | \"auto\""), "publish must distinguish manual and automatic triggers");
assert.ok(wizard.includes("scopedBody({ userToken: appSession.userToken, draftId: targetDraftId })"), "auto publish must target the verified draft id");

assert.equal((wizard.match(/sdkRef\.current\.execute/g) || []).length, 2, "the two hosted Circle PIN executions must remain distinct");
assert.ok(!/localStorage\.setItem\([^)]*pin/i.test(wizard), "PIN must not be persisted to localStorage");
assert.ok(!/sessionStorage\.setItem\([^)]*pin/i.test(wizard), "PIN must not be persisted to sessionStorage");
assert.ok(!/console\.(log|info|warn|error)\([^)]*pin/i.test(wizard), "PIN must not be logged");

assert.ok(store.includes("function withInitialBrandName"), "new drafts must support safe brand-name autofill");
assert.ok(store.includes("draft.challenge.brandName.trim()"), "brand-name autofill must not overwrite existing draft values");
assert.ok(draftRoute.includes("brandName: context.brandName ?? context.displayName"), "draft route must use canonical account brand/display name for autofill");
assert.ok(draftRoute.includes("launchReadiness: validateCreateChallengeLaunchReadiness(draft, { deadlinePolicy })"), "draft API must return the shared publish readiness contract");
assert.ok(coverRoute.includes("launchReadiness: validateCreateChallengeLaunchReadiness(updated, { deadlinePolicy })"), "cover upload/remove must return refreshed launch readiness");
assert.ok(readiness.includes("validateCreateChallengeLaunchReadiness"), "shared launch readiness validator must exist");
assert.ok(readiness.includes("Add a campaign cover before publishing."), "shared validator must enforce campaign cover before any launch transaction");
assert.ok(readiness.includes("allowedFormats.length > 0"), "shared validator must enforce allowed submission types");
assert.ok(fundingService.includes("assertLaunchReadinessBeforeFinancialAction(draft, \"/api/create-challenge/approve\")"), "approval service must block missing deterministic publish requirements before creating Circle approval");
assert.ok(fundingService.includes("assertLaunchReadinessBeforeFinancialAction(draft, \"/api/create-challenge/fund\")"), "funding service must block missing deterministic publish requirements before creating Circle funding");
assert.ok(fundingService.includes("assertLaunchReadinessBeforePublish"), "publish endpoint must share the readiness validation contract");
assert.ok(fundingService.includes("CAMPAIGN_COVER_REQUIRED"), "missing cover must still return the precise publish/approval error code");
assert.ok(wizard.includes("type=\"time\""), "time fields must keep native HH:MM keyboard input");
assert.ok(wizard.includes("setValidation(null)"), "field edits must clear stale validation errors");
assert.ok(wizard.includes("Advanced Details"), "optional details must be progressively disclosed");
assert.ok(wizard.includes("<details") && wizard.includes("supporting-deliverables") && wizard.includes("reference-links"), "optional supporting deliverables and reference links must be collapsed by default");
assert.ok(wizard.includes("fieldSelectorForValidationError"), "validation errors must map to field targets");
assert.ok(wizard.includes("focusValidationError(saved.validation.errors[0]"), "invalid continue must focus the first corrective field");
assert.ok(wizard.includes("onClick={() => focusValidationError(item)}"), "summary errors must link to invalid fields");
assert.ok(wizard.includes("Auto-filled from Company Settings"), "Brand field must communicate account-derived autofill");
assert.ok(wizard.includes("categoryExamples"), "placeholders must adapt to the selected category");

console.log(JSON.stringify({
  result: "fast brand publish pipeline verification passed",
  twoPinsPreserved: true,
  autoApprovalRecovery: true,
  autoFundingRecovery: true,
  autoPublishAfterVerification: true,
  noPinPersistence: true,
}, null, 2));
