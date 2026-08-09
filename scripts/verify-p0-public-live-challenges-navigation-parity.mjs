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

const header = read("src/components/layout/site-header.tsx");
const landing = read("src/features/landing/components/final-landing-page.tsx");
const audience = read("src/features/landing/components/landing-audience-section.tsx");
const packageJson = read("package.json");

includes(header, '{ href: "/challenges", label: "Live Challenges" }', "Header Live Challenges must open /challenges.");
excludes(header, '{ href: "/#live-business-challenges", label: "Live Challenges" }', "Header Live Challenges must not scroll to the homepage preview section.");

includes(landing, '{ href: "/challenges", label: "Explore Live Challenges", variant: "primary" }', "Hero Explore Live Challenges must open /challenges.");
excludes(landing, '{ href: "#live-business-challenges", label: "Explore Live Challenges", variant: "primary" }', "Hero Explore Live Challenges must not scroll to the homepage preview section.");

includes(landing, 'id="live-business-challenges"', "Homepage live preview section must remain mounted.");
includes(landing, 'href="/challenges"', "Live Business Challenges section View all challenges CTA must open /challenges.");
includes(landing, "View all challenges", "Live Business Challenges section CTA label must remain visible.");

includes(audience, 'href="/challenges"', "Lower public Explore Live Challenges CTA must also open /challenges.");
excludes(audience, 'href="#live-business-challenges"', "Lower public Explore Live Challenges CTA must not scroll to the homepage preview section.");

includes(packageJson, "test:p0-public-live-challenges-navigation-parity", "Focused public navigation verifier must be registered.");

console.log("P0 public live challenges navigation parity verifier passed.");
