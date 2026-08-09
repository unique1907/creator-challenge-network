import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, expected, message) {
  assert.ok(source.includes(expected), `${message}: missing ${expected}`);
}

function excludes(source, forbidden, message) {
  assert.ok(!source.includes(forbidden), `${message}: found ${forbidden}`);
}

function sliceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.ok(start >= 0, `Missing start token: ${startToken}`);
  const end = source.indexOf(endToken, start);
  assert.ok(end > start, `Missing end token: ${endToken}`);
  return source.slice(start, end);
}

const dashboard = read("src/features/dashboard/components/brand-dashboard.tsx");
const hero = sliceBetween(dashboard, "function NextActionHero", "function DashboardJourney");
const imageArea = sliceBetween(hero, '<div className="relative min-h-[190px] overflow-hidden md:min-h-full">', "</section>");

includes(hero, "md:grid md:min-h-[280px] md:grid-cols-2", "Hero must retain exact desktop 50/50 split");
includes(hero, "relative min-h-[190px] overflow-hidden md:min-h-full", "Right image viewport must remain relative and hide overflow");
includes(hero, "row?.media.imageUrl", "Hero must use the selected challenge cover source");
includes(hero, "<img src={row.media.imageUrl}", "Hero must render the real selected challenge image");
includes(hero, "absolute inset-0 h-full w-full", "Image must fill the entire viewport dimensions");
includes(hero, "object-cover", "Image must use object-fit cover");
includes(hero, "object-center", "Image must use centered object positioning");
includes(hero, "origin-center", "Image transform origin must stay centered");
includes(hero, "scale-[1.15]", "Image must use the selected 1.15 controlled zoom");
includes(hero, "linear-gradient(90deg,#0b1020_0%,rgba(11,16,32,0.72)_12%,rgba(11,16,32,0.18)_30%,rgba(11,16,32,0)_54%)", "Subtle center transition gradient must remain");

excludes(imageArea, "object-contain", "Image must not be contained as a small poster");
excludes(imageArea, "max-w", "Image viewport must not constrain image with max-width");
excludes(imageArea, "max-h", "Image viewport must not constrain image with max-height");
excludes(imageArea, "blur-xl", "Image area must not use dual-layer blurred artwork");
excludes(imageArea, "opacity-55", "Image area must not leave a dim blurred background layer");
excludes(imageArea, "drop-shadow", "Image area must not render a floating foreground poster");
excludes(imageArea, "p-6", "Image must not use padding that creates empty margins");
excludes(imageArea, "md:p-8", "Image must not use desktop padding that creates empty margins");
excludes(hero, "w-[48%]", "Hero must not return to the previous approximate image width");
excludes(hero, "absolute inset-y-0 right-0", "Hero image viewport must not use the previous overlay positioning");

includes(dashboard, "New Draft", "No other hero content should be removed");
includes(dashboard, "YOUR NEXT ACTION", "Hero eyebrow must remain unchanged");
includes(dashboard, "No Business Challenges currently require your attention.", "Caught-up copy must remain unchanged");

console.log("P0 Brand Dashboard hero image-fill verifier passed.");
