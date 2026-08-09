import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const wizard = read("src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx");
const readiness = read("src/utils/create-challenge-launch-readiness.ts");
const store = read("src/services/create-challenge/create-challenge-store.server.ts");
const publicProjection = read("src/services/create-challenge/published-challenge.server.ts");
const creatorProjection = read("src/services/creator-workspace/creator-workspace.server.ts");
const brandViewModel = read("src/features/dashboard/brand-dashboard-view-model.ts");
const packageJson = JSON.parse(read("package.json"));

assert.ok(wizard.includes('const OTHER_BUSINESS_DOMAIN_OPTION = "Other"'), "Other must remain the select sentinel.");
assert.ok(wizard.includes('CUSTOM_BUSINESS_DOMAIN_PLACEHOLDER = "e.g. Payments, Fintech, Developer Tools, AI Infrastructure"'), "Custom domain placeholder must match the product copy.");
assert.ok(wizard.includes('selectedBusinessDomainOption(draft.challenge.category)'), "Saved custom values must restore the select as Other.");
assert.ok(wizard.includes('customBusinessDomainValue(draft.challenge.category)'), "Saved custom values must restore into the custom input.");
assert.ok(wizard.includes('value={selectedBusinessDomain}'), "The select must use the derived option, not raw custom category strings.");
assert.ok(wizard.includes('id="challenge-category-other"'), "Other must reveal a focused custom input.");
assert.ok(wizard.includes('label="Specify category"'), "Custom input label must match the requested copy.");
assert.ok(wizard.includes('placeholder={CUSTOM_BUSINESS_DOMAIN_PLACEHOLDER}'), "Custom input placeholder must match the requested copy.");
assert.ok(wizard.includes('businessDomainFromCustomValue(value)'), "Empty custom domain input must return to the Other sentinel for validation.");
assert.ok(wizard.includes('selectedBusinessDomain === OTHER_BUSINESS_DOMAIN_OPTION'), "Custom input must only render for Other.");

assert.ok(readiness.includes('businessDomain.toLowerCase() === "other"'), "Generic Other must be invalid at the shared validator.");
assert.ok(readiness.includes('Specify category is required when Challenge Category is Other.'), "Validator must provide a visible custom-domain error.");
assert.ok(wizard.includes('lower.includes("specify category")') && wizard.includes('"#challenge-category-other"'), "Custom-domain validation must focus the custom field.");

assert.ok(store.includes('category: normalized.challenge.category || "Creative"'), "Brand summaries must still project the canonical stored category string.");
assert.ok(publicProjection.includes('category: draft.challenge.category'), "Public projection must use the canonical stored category string.");
assert.ok(creatorProjection.includes('category: draft.challenge.category'), "Creator projection must use the canonical stored category string.");
assert.ok(brandViewModel.includes('category: draft.category'), "Brand dashboard view model must use the shared draft summary category.");
assert.ok(!wizard.includes('businessDomain = "Other"'), "The implementation must not force persisted custom domains back to Other.");
assert.equal(packageJson.scripts["test:p0-business-domain-other-custom-value"], "node scripts/verify-p0-business-domain-other-custom-value.mjs", "Focused test script must be registered.");

console.log(JSON.stringify({
  result: "P0 business-domain Other custom value verification passed",
  predefinedDomainFlowPreserved: true,
  otherCustomInput: true,
  genericOtherBlocked: true,
  canonicalProjectionUsesStoredDomain: true
}, null, 2));
