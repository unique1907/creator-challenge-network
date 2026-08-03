import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(path, expected, message) {
  assert.ok(read(path).includes(expected), `${message}: missing ${expected}`);
}

function excludes(path, expected, message) {
  assert.ok(!read(path).includes(expected), `${message}: unexpected ${expected}`);
}

const logo = "src/components/ui/ccn-logo.tsx";
const productFiles = [
  "src/components/layout/site-header.tsx",
  "src/components/layout/site-footer.tsx",
  "src/features/dashboard/components/brand-dashboard.tsx",
  "src/features/dashboard/components/campaign-workspace.tsx",
  "src/features/creator-workspace/components/creator-workspace.tsx",
  "src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx",
  "src/features/create-challenge/components/create-challenge-placeholder.tsx",
  "src/app/create-challenge/loading.tsx",
];

assert.ok(existsSync("public/brand/ccn-logo.svg"), "Canonical source SVG must exist.");
assert.ok(existsSync("public/brand/ccn-mark.svg"), "Approved compact mark SVG must exist.");
assert.ok(existsSync("public/brand/exports/ccn-logo-canonical.svg"), "Standalone SVG export must exist.");
assert.ok(existsSync("public/brand/exports/ccn-logo-canonical.png"), "Standalone PNG export must exist.");

includes(logo, 'src: "/brand/ccn-logo.svg"', "Full variant must use the Brand Dashboard source asset.");
includes(logo, 'src: "/brand/ccn-mark.svg"', "Mark variant must use the approved mark asset.");
includes(logo, 'alt: "CCN Creator Challenge Network"', "Full logo must include accessible alt text.");
includes(logo, "object-contain", "Logo must preserve aspect ratio.");
excludes(logo, "object-cover", "Logo must never crop artwork.");

for (const file of productFiles) {
  includes(file, "CCNLogo", `${file} must use the canonical CCNLogo component.`);
  excludes(file, "/brand/ccn-logo.png", `${file} must not use the legacy PNG logo.`);
}

excludes("src/features/dashboard/components/campaign-workspace.tsx", "<span className=\"text-[32px] font-bold tracking-tight\">CCN</span>", "Campaign workspace must not reconstruct the CCN text logo.");
excludes("src/features/creator-workspace/components/creator-workspace.tsx", "<span className=\"text-3xl font-semibold\">CCN</span>", "Creator workspace must not reconstruct the CCN text logo.");

console.log("Canonical CCN logo verification passed.");
