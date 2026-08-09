import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const campaignsPage = readFileSync("src/app/dashboard/campaigns/page.tsx", "utf8");
const dashboardList = readFileSync("src/features/dashboard/components/brand-dashboard-challenges.tsx", "utf8");
const sharedFilters = readFileSync("src/features/dashboard/brand-dashboard-filters.ts", "utf8");

const expectedOrder = ['"All"', '"Drafts"', '"Active"', '"Needs Action"', '"Completed"'];
const arrayStart = sharedFilters.indexOf("export const brandDashboardFilters");
const arrayEnd = sharedFilters.indexOf("];", arrayStart);
const filterArray = sharedFilters.slice(arrayStart, arrayEnd);

assert.ok(arrayStart >= 0, "Business Challenge filters must live in a shared canonical source.");
for (const label of expectedOrder) {
  assert.ok(filterArray.includes(label), `Shared filters must include ${label}.`);
}
for (let index = 0; index < expectedOrder.length - 1; index += 1) {
  assert.ok(filterArray.indexOf(expectedOrder[index]) < filterArray.indexOf(expectedOrder[index + 1]), `${expectedOrder[index]} must precede ${expectedOrder[index + 1]}.`);
}
for (const oldLabel of ['"Problem Draft"', '"Funding"', '"Open for Solutions"', '"Evaluation"', '"Selection"']) {
  assert.equal(filterArray.includes(oldLabel), false, `Shared visible filters must not expose ${oldLabel}.`);
}

assert.ok(sharedFilters.includes("return row.bucket === filter;"), "Simplified filters must use the canonical primary bucket.");
assert.equal(sharedFilters.includes("const activeStates"), false, "Active must not be a duplicated overlapping lifecycle state set.");
assert.equal(sharedFilters.includes("const needsActionStates"), false, "Needs Action must not be a duplicated overlapping lifecycle state set.");
assert.equal(sharedFilters.includes('row.status === "draft"'), false, "Drafts must not bypass the canonical bucket mapper.");

assert.ok(campaignsPage.includes("brandDashboardFilters.map"), "Business Challenges page must render the shared filters.");
assert.ok(campaignsPage.includes("brandDashboardFilterMatches(row, filter)"), "Business Challenges page must use the shared filter matcher.");
assert.ok(campaignsPage.includes("normalizeBrandDashboardFilter(params?.filter)"), "Business Challenges page must normalize query filters through the shared helper.");
assert.equal(campaignsPage.includes("const campaignFilters"), false, "Business Challenges page must not keep the old filter array.");

const titleIndex = campaignsPage.indexOf("Your Business Challenges");
const newChallengeIndex = campaignsPage.indexOf("+ New Business Challenge");
const backIndex = campaignsPage.indexOf("Back to dashboard");
assert.ok(titleIndex >= 0 && newChallengeIndex >= 0 && backIndex >= 0, "Header title, create action, and back link must all render.");
assert.ok(newChallengeIndex < backIndex, "Back to dashboard must sit below + New Business Challenge in the action column.");
assert.ok(titleIndex < backIndex, "Back to dashboard must not sit above the page title.");
assert.ok(campaignsPage.includes('href="/dashboard"'), "Back to dashboard route must remain unchanged.");
assert.ok(campaignsPage.includes('href="/create-challenge?new=1" prefetch'), "New Business Challenge route must remain unchanged.");

assert.ok(dashboardList.includes("brandDashboardFilters.map"), "Dashboard and Business Challenges must share the same filter source.");
assert.ok(dashboardList.includes("brandDashboardFilterMatches(row, activeFilter)"), "Dashboard must share the same filter matcher.");
assert.equal(dashboardList.includes("const dashboardFilters"), false, "Dashboard must not maintain duplicate visible filters.");

for (const preserved of ["function CampaignCard", "row.media.imageUrl", "row.rewardLabel", "row.solutionsLabel", "row.deadlineLabel", "row.actionLabel", "href={row.href}"]) {
  assert.ok(campaignsPage.includes(preserved), `Business Challenges card behavior must remain intact: ${preserved}`);
}

console.log("P0 Brand Challenges header/filter consistency verifier passed.");
