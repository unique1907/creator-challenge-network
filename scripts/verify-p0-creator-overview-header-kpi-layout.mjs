import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const componentPath = "src/features/creator-workspace/components/creator-workspace.tsx";
const component = fs.readFileSync(path.join(root, componentPath), "utf8");

function includes(text, message) {
  assert.ok(component.includes(text), message);
}

function excludes(text, message) {
  assert.ok(!component.includes(text), message);
}

includes("function MetricCard", "Creator KPI card component must remain present.");
includes("<p className=\"text-[12px] font-semibold text-violet-300\">Creator Workspace</p>", "Creator Workspace eyebrow must remain above the greeting.");
includes("Welcome Back {overview.profile.displayName}", "Greeting must remain dynamic and horizontal.");
includes("Find opportunities, create amazing work, and earn rewards.", "Supporting copy must remain unchanged.");
includes("<section className=\"space-y-2\">", "Overview top section must be a compact vertical greeting/KPI stack.");
includes("<div className=\"grid min-w-0 gap-3 sm:grid-cols-3\">", "KPI cards must sit in a compact row below the greeting.");
includes("<NextActionHero action={overview.nextAction} />", "Next Action must remain below the KPI row.");

excludes("xl:grid-cols-[minmax(0,1fr)_minmax(0,640px)]", "Greeting and KPI cards must not be split into competing desktop columns.");
excludes("xl:items-end", "Top overview section must not align greeting beside KPI cards.");
excludes("Good afternoon", "Time-of-day greeting must not return.");
excludes("Welcome<br", "Greeting must not use manual line breaks.");

includes("rounded-lg border border-white/10 bg-white/[0.045] p-2", "KPI compact refinement must be preserved.");
includes("grid h-7 w-7", "KPI compact icon tile size must be preserved.");
includes("break-words text-[15px]", "KPI compact value size must be preserved.");

console.log("P0 Creator Overview header/KPI layout verifier passed.");
