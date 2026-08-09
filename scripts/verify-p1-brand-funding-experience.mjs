import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wizardPath = path.join(
  root,
  "src",
  "features",
  "create-challenge",
  "components",
  "real-flow",
  "create-challenge-wizard.tsx",
);
const source = fs.readFileSync(wizardPath, "utf8");

function requireText(text, message) {
  assert.ok(source.includes(text), message);
}

requireText("type BrandFundingStage =", "Brand-facing funding stage type must exist.");
for (const stage of ["approval", "funding", "confirmation", "publish", "live", "failed"]) {
  requireText(`| "${stage}"`, `Brand stage must include ${stage}.`);
}
requireText("type BrandFundingPresentation", "Funding presentation mapping must be typed.");
requireText("function deriveBrandFundingPresentation", "Internal state must map through one presentation function.");

for (const [state, stage] of [
  ["APPROVAL_PENDING", "approval"],
  ["READY_FOR_APPROVAL", "approval"],
  ["APPROVED", "funding"],
  ["FUNDING_PENDING", "funding"],
  ["RECONCILING", "confirmation"],
  ["FUNDED_VERIFIED", "publish"],
  ["PUBLISHED", "live"],
  ["RECOVERABLE_ERROR", "failed"],
  ["FATAL_ERROR", "failed"],
  ["INSUFFICIENT_BALANCE", "failed"],
]) {
  assert.ok(
    source.includes(`state === "${state}"`) && source.includes(`stage: "${stage}"`),
    `${state} must map to Brand stage ${stage}.`,
  );
}

for (const headline of [
  "Preparing your prize pool",
  "Approval required",
  "Funding in progress",
  "Confirming on Arc",
  "Funding complete",
  "Publishing your challenge",
  "Challenge is live",
  "Action required",
  "Funding failed",
]) {
  requireText(headline, `Brand status headline missing: ${headline}`);
}

for (const label of [
  "Prize pool",
  "Platform fee",
  "Total required",
  "Available balance",
  "Estimated balance after funding",
  "Network fee handling",
  "Network",
]) {
  requireText(`label="${label}"`, `Funding details must keep ${label} available.`);
}

requireText("max-w-[760px]", "Funding content must use the approved compact content width.");
requireText("aria-live=\"polite\"", "Status card must expose semantic changing status.");
requireText("<summary className=\"cursor-pointer font-bold text-white\">Funding details</summary>", "Funding summary details must use the existing summary disclosure pattern.");
requireText("<div className=\"mt-4 grid gap-4 sm:grid-cols-2\">", "Funding details must reveal the existing responsive summary grid when expanded.");
requireText("open={brandPresentation.autoExpandTechnicalDetails || undefined}", "Technical details must auto-expand only when presentation says so.");
requireText("<summary className=\"cursor-pointer font-bold text-white\">Technical details</summary>", "Technical details accordion must exist.");
requireText("<PaymentProgressPanel steps={steps} prominent={launchPipelineActive} />", "Full internal progress must remain accessible inside details.");
assert.equal(
  (source.match(/<PaymentProgressPanel steps=\{steps\}/g) || []).length,
  1,
  "Internal progress log must not be rendered as a second default Brand panel.",
);
assert.ok(!source.includes("Advanced launch progress"), "Separate advanced progress accordion must not compete with Technical details.");

const fundingStart = source.indexOf("function FundingStep");
const publishStart = source.indexOf("function PublishStep");
const fundingSegment = source.slice(fundingStart, publishStart);
assert.ok(fundingSegment.includes("Development funding scope"), "Development funding scope must still exist for dev observability.");
assert.ok(fundingSegment.includes("showDiagnostic ? ("), "Development console must be gated by the existing dev condition.");
assert.ok(source.includes("const showDiagnostic = process.env.NODE_ENV !== \"production\""), "Development console must not be controlled by browser state.");

for (const action of [
  "Check Payment Account",
  "Review & Launch",
  "Check Approval Status",
  "Fund Prize Pool",
  "Check prize pool status",
  "Continue to Publish",
]) {
  requireText(action, `Existing underlying action must remain present: ${action}`);
}
for (const handler of [
  "onPreflight",
  "onApprove",
  "onRecoverApproval",
  "onFund",
  "onVerify",
  "onReconcile",
  "onContinueToPublish",
]) {
  assert.ok(fundingSegment.includes(handler), `Funding action handler must remain wired: ${handler}`);
}

requireText("break-all font-mono", "Wallet/hash strings must remain overflow-safe in technical details.");
requireText("Protected funds are locked for this challenge", "Trust reassurance must remain visible.");

console.log("P1 Brand funding experience verifier passed.");
