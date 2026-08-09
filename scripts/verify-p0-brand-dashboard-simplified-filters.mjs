import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const filters = readFileSync("src/features/dashboard/brand-dashboard-filters.ts", "utf8");
const dashboardList = readFileSync("src/features/dashboard/components/brand-dashboard-challenges.tsx", "utf8");
const viewModel = readFileSync("src/features/dashboard/brand-dashboard-view-model.ts", "utf8");
const workspace = readFileSync("src/features/dashboard/components/campaign-workspace.tsx", "utf8");

const expectedLabels = ['"All"', '"Drafts"', '"Active"', '"Needs Action"', '"Completed"'];
const forbiddenLabels = ['"Problem Draft"', '"Funding"', '"Open for Solutions"', '"Evaluation"', '"Selection"'];
const arrayStart = filters.indexOf("export const brandDashboardFilters");
const arrayEnd = filters.indexOf("];", arrayStart);
const dashboardFilterArray = filters.slice(arrayStart, arrayEnd);

for (const label of expectedLabels) {
  assert.ok(dashboardFilterArray.includes(label), `Dashboard filters must include ${label}.`);
}
for (const label of forbiddenLabels) {
  assert.ok(!dashboardFilterArray.includes(label), `Dashboard filters must not expose ${label}.`);
}

assert.ok(dashboardFilterArray.indexOf('"All"') < dashboardFilterArray.indexOf('"Drafts"'), "All must precede Drafts.");
assert.ok(dashboardFilterArray.indexOf('"Drafts"') < dashboardFilterArray.indexOf('"Active"'), "Drafts must precede Active.");
assert.ok(dashboardFilterArray.indexOf('"Active"') < dashboardFilterArray.indexOf('"Needs Action"'), "Active must precede Needs Action.");
assert.ok(dashboardFilterArray.indexOf('"Needs Action"') < dashboardFilterArray.indexOf('"Completed"'), "Needs Action must precede Completed.");

assert.ok(viewModel.includes("export type BrandDashboardSimplifiedBucket"), "View model must expose the simplified bucket type.");
assert.ok(viewModel.includes("simplifiedBucketFromDraft"), "View model must centralize canonical lifecycle to simplified bucket mapping.");
assert.ok(viewModel.includes('return "Drafts";'), "Drafts bucket fallback must remain explicit.");
assert.ok(viewModel.includes('return "Active";'), "Active bucket must remain explicit.");
assert.ok(viewModel.includes('return "Needs Action";'), "Needs Action bucket must remain explicit.");
assert.ok(viewModel.includes('return "Completed";'), "Completed bucket must remain explicit.");
assert.ok(filters.includes('if (filter === "All") return true;'), "All must include every owned row.");
assert.ok(filters.includes("return row.bucket === filter;"), "Primary filters must use the row's single simplified bucket.");
assert.ok(!filters.includes("const activeStates"), "Filters must not duplicate active lifecycle-state sets.");
assert.ok(!filters.includes("const needsActionStates"), "Filters must not duplicate needs-action lifecycle-state sets.");
assert.ok(dashboardList.includes("brandDashboardFilters.map"), "Dashboard list must render filters from the shared canonical source.");
assert.ok(dashboardList.includes("brandDashboardFilterMatches(row, activeFilter)"), "Dashboard list must use the shared canonical filter matcher.");
assert.ok(!dashboardList.includes("const dashboardFilters"), "Dashboard list must not maintain a second local filter set.");

for (const canonical of ["Problem Draft", "Open for Solutions", "Evaluation", "Selection", "Settlement"]) {
  assert.ok(viewModel.includes(canonical) || workspace.includes(canonical), `Canonical lifecycle label must remain unchanged: ${canonical}.`);
}

console.log("P0 Brand Dashboard simplified-filter verifier passed.");
