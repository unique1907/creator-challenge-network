import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const viewModel = readFileSync("src/features/dashboard/brand-dashboard-view-model.ts", "utf8");
const dashboard = readFileSync("src/features/dashboard/components/brand-dashboard.tsx", "utf8");

assert.ok(viewModel.includes("function isHeroActionable"), "Hero actionability helper must exist.");
assert.ok(viewModel.includes('row.status !== "completed" && row.status !== "closed-no-submissions" && row.status !== "closed-not-enough-submissions"'), "Completed and closed challenges must be explicitly excluded from hero selection.");
assert.ok(viewModel.includes(".filter(isHeroActionable).sort(compareBrandDashboardRows"), "Hero focus must filter completed rows before priority sorting.");
assert.ok(dashboard.includes('if (!row) return "You\'re all caught up";'), "No-action hero title must be the locked caught-up copy.");
assert.ok(dashboard.includes("No Business Challenges currently require your attention."), "No-action hero supporting text must be locked copy.");
assert.ok(dashboard.includes('if (!row) return { label: "New Business Challenge"'), "No-action hero CTA must be New Business Challenge.");

for (const cta of ["Continue Draft", "Complete Funding", "Review Solutions", "Finalize Selection", "Approve Payout"]) {
  assert.ok(dashboard.includes(cta), `Hero/action label mapping must preserve ${cta}.`);
}

assert.ok(!dashboard.includes("Review the completed outcome"), "Hero must not present completed outcomes as next actions.");

console.log("P0 Brand Dashboard next-action verifier passed.");
