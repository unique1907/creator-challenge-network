import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

function excludes(source, needle, message) {
  assert.equal(source.includes(needle), false, message);
}

const processStrip = read("src/features/landing/components/process-strip.tsx");
const landingData = read("src/features/landing/data/landing-page.ts");
const landing = read("src/features/landing/components/final-landing-page.tsx");
const packageJson = read("package.json");

includes(processStrip, ">How It Works<", "Eyebrow must be exactly HOW IT WORKS when rendered.");
includes(processStrip, "From Business Problem to Verified Settlement", "Heading must use the locked compact text.");
includes(processStrip, "Five simple steps from funding to settlement on Arc.", "Supporting line must use the locked compact text.");
excludes(processStrip, "How CCN works", "Old eyebrow must be removed.");
excludes(processStrip, "One funded challenge, one blind review path, one verified payout.", "Old long headline must be removed.");
excludes(processStrip, "CCN keeps the creative workflow simple while preserving the financial guarantees the jury will inspect.", "Old jury-facing paragraph must be removed.");
excludes(processStrip.toLowerCase(), "jury", "How It Works section must not mention the jury.");
excludes(processStrip.toLowerCase(), "creative workflow", "How It Works section must not mention creative workflow.");

const steps = [...landingData.matchAll(/label: "([^"]+)",\n    description: "([^"]+)",\n    icon: "([^"]+)"/g)].slice(-5);
assert.equal(steps.length, 5, "Exactly five process steps must remain.");
assert.deepEqual(
  steps.map((step) => step[1]),
  [
    "Define the Business Problem",
    "Fund the Reward in USDC",
    "Receive Solution Proposals",
    "Evaluate and Select",
    "Settle the Reward on Arc",
  ],
  "Step order and titles must remain locked.",
);
assert.deepEqual(
  steps.map((step) => step[2]),
  [
    "Turn a real business need into a structured challenge.",
    "Lock the reward before the challenge goes live.",
    "Creators submit solutions before the deadline.",
    "Review anonymous proposals and choose the best outcome.",
    "Release the reward after winner finalization.",
  ],
  "Step supporting copy must match locked concise copy.",
);

includes(processStrip, "pt-12", "Section top spacing must be reduced.");
includes(processStrip, "mb-7", "Header-to-card spacing must be compact.");
includes(processStrip, "px-5 py-6", "Process card padding must be compact.");
includes(processStrip, "lg:px-8", "Desktop card horizontal padding must remain compact.");
excludes(processStrip, "bg-white p-5", "Process card must not retain the old broad padding shorthand.");
excludes(processStrip, "h-11 w-11", "Icon tiles must not retain the previous larger size.");
includes(processStrip, "h-10 w-10", "Icon tiles must use compact 40px sizing.");
includes(processStrip, "text-[10.5px]", "Step label typography must use compact scale.");
includes(processStrip, "text-[15px] font-semibold", "Step title typography must use compact scale.");
includes(processStrip, "text-[12px] leading-[1.45]", "Step description typography must use compact scale.");
includes(processStrip, "lg:grid-cols-5", "Desktop layout must remain a five-column flow.");
includes(processStrip, "sm:grid-cols-2", "Tablet layout must remain responsive.");
includes(processStrip, "grid gap-5", "Mobile layout must remain a compact single-column grid by default.");
includes(processStrip, "absolute right-4 top-3 hidden h-4 w-4", "Connectors must remain subtle and compact on desktop.");
excludes(processStrip, "min-h-", "Process card must not introduce a large fixed min-height.");

includes(landing, "<ProcessStrip />", "Homepage must keep the same How It Works integration point.");
includes(packageJson, "test:p0-public-homepage-how-it-works-compact", "Focused How It Works verifier must be registered.");

console.log("P0 public homepage How It Works compact verifier passed.");
