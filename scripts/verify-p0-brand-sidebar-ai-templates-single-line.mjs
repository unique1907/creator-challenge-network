import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync("src/features/dashboard/components/brand-dashboard.tsx", "utf8");
const navigation = readFileSync("src/features/dashboard/components/brand-workspace-navigation.tsx", "utf8");

assert.ok(dashboard.includes("w-[224px]"), "Sidebar width must remain unchanged.");
assert.ok(dashboard.includes("mt-8 space-y-1 text-[13px] font-medium"), "Sidebar navigation typography context must remain compact.");
assert.ok(dashboard.includes('<AiTemplatesBetaButton variant="compact" />'), "Dashboard sidebar must keep the compact AI Templates control.");
assert.ok(navigation.includes("h-10 rounded-md border border-transparent px-3 text-[13px] font-medium"), "Compact AI Templates row must match standard sidebar row height and compact typography.");
assert.ok(navigation.includes("flex w-full items-center gap-2"), "Compact AI Templates row must use reduced icon/text gap.");
assert.ok(navigation.includes("justify-between gap-1.5 whitespace-nowrap"), "AI Templates label and Beta badge must stay on one line with badge aligned right.");
assert.ok(navigation.includes('<span className="whitespace-nowrap">AI Templates</span>'), "Visible label must remain exactly AI Templates and must not wrap.");
assert.ok(navigation.includes("shrink-0 rounded border border-violet-300/40"), "Beta badge must stay aligned and must not shrink/wrap.");
assert.ok(!navigation.includes("truncate\">AI Templates"), "AI Templates must not be truncated.");
assert.ok(!navigation.includes(">Templates</span>"), "AI Templates must not be renamed or shortened.");

console.log("P0 Brand sidebar AI Templates single-line verifier passed.");
