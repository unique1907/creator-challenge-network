import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, needle, message) {
  assert.ok(source.includes(needle), message);
}

function excludes(source, needle, message) {
  assert.equal(source.includes(needle), false, message);
}

const metrics = read("src/features/landing/components/landing-metrics.tsx");
const data = read("src/features/landing/data/landing-page.ts");
const landing = read("src/features/landing/components/final-landing-page.tsx");
const packageJson = read("package.json");

const values = [...data.matchAll(/value: "([^"]+)"/g)].map((match) => match[1]);
const metricValues = values.slice(values.indexOf("Arc"), values.indexOf("Blind Review") + 1);
assert.deepEqual(metricValues, ["Arc", "Circle Wallets", "USDC", "Blind Review"], "Infrastructure strip must keep exactly four items in locked order.");

includes(data, 'logoSrc: "/brand/partners/arc-logo.png"', "Arc must use the supplied local logo asset path.");
includes(data, 'logoSrc: "/brand/partners/circle-logo.png"', "Circle Wallets must use the supplied local logo asset path.");
assert.equal(existsSync("public/brand/partners/arc-logo.png"), true, "Arc logo asset must exist locally.");
assert.equal(existsSync("public/brand/partners/circle-logo.png"), true, "Circle logo asset must exist locally.");
excludes(data.slice(data.indexOf('value: "Arc"'), data.indexOf('value: "Circle Wallets"')), 'icon: "arc",\n  },', "Arc must not rely on the generic triangle icon only.");
excludes(data.slice(data.indexOf('value: "Circle Wallets"'), data.indexOf('value: "USDC"')), 'icon: "wallet",\n  },', "Circle Wallets must not rely on the generic wallet icon only.");

includes(metrics, "-mt-6", "Infrastructure strip overlap/height must be reduced from the previous large offset.");
includes(metrics, "px-4 py-4", "Infrastructure strip outer padding must be compact.");
excludes(metrics, "p-5", "Infrastructure strip must not keep the previous larger card padding.");
excludes(metrics, "h-11 w-11", "Icon containers must not keep the previous larger size.");
includes(metrics, "h-10 w-10", "Icon containers must use compact 40px sizing.");
includes(metrics, "h-7 w-7 object-contain", "Logo assets must be contained without distortion.");
includes(metrics, "text-[17px] font-semibold", "Title typography must use compact scale.");
includes(metrics, "text-[12.5px] font-semibold", "Descriptor typography must use compact scale.");
includes(metrics, "text-[12px] leading-[1.45]", "Supporting text typography must use compact scale.");
includes(metrics, "lg:grid-cols-4", "Desktop layout must remain four columns.");
includes(metrics, "sm:grid-cols-2", "Tablet layout must remain two columns.");
includes(metrics, "grid gap-4", "Mobile layout must remain one compact column by default.");
includes(metrics, "lg:border-l lg:border-slate-200/80", "Desktop columns must keep subtle dividers.");
excludes(metrics, "min-h-[160px]", "No large min-height may remain.");
excludes(metrics, "min-h-[180px]", "No large min-height may remain.");

includes(landing, "<LandingMetrics />", "Homepage must keep the same infrastructure strip integration point.");
includes(packageJson, "test:p0-public-homepage-infrastructure-strip-compact-logo", "Focused infrastructure-strip verifier must be registered.");

console.log("P0 public homepage infrastructure-strip compact logo verifier passed.");
