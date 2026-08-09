import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync("src/features/dashboard/components/brand-dashboard.tsx", "utf8");
const heroStart = dashboard.indexOf("function NextActionHero");
const heroEnd = dashboard.indexOf("function DashboardJourney");
assert.ok(heroStart >= 0 && heroEnd > heroStart, "NextActionHero section must exist.");
const hero = dashboard.slice(heroStart, heroEnd);

const primaryRouteIndex = hero.indexOf("href={cta.href}");
const newDraftRouteIndex = hero.indexOf("href={NEW_DRAFT_HREF}");
const primaryStyle = "inline-flex h-10 items-center justify-center rounded-lg bg-violet-600 px-4 text-[12px] font-semibold text-white transition hover:bg-violet-500";
const secondaryStyle = "inline-flex h-9 items-center justify-center rounded-lg border border-white/12 bg-slate-950/30 px-4 text-[12px] font-semibold text-violet-100 transition hover:border-violet-300/35 hover:bg-white/[0.05]";

assert.ok(primaryRouteIndex >= 0, "Hero primary lifecycle action route must remain cta.href.");
assert.ok(newDraftRouteIndex >= 0, "New Draft route must remain NEW_DRAFT_HREF.");
assert.ok(primaryRouteIndex < newDraftRouteIndex, "Button order must remain lifecycle action first, New Draft second.");
assert.ok(hero.includes(`href={cta.href}\n            className="${secondaryStyle}"`), "Lifecycle action must use the previous New Draft outlined style.");
assert.ok(hero.includes(`href={NEW_DRAFT_HREF}\n              className="${primaryStyle}"`), "New Draft must use the previous lifecycle action purple filled style.");
assert.ok(hero.includes("{cta.label} <span className=\"ml-2\">-&gt;</span>"), "Lifecycle button label and arrow must remain unchanged.");
assert.ok(hero.includes("New Draft"), "New Draft label must remain unchanged.");
assert.ok(dashboard.includes('const NEW_DRAFT_HREF = "/create-challenge?new=1";'), "New Draft route constant must remain unchanged.");
for (const cta of ["Continue Draft", "Complete Funding", "Review Solutions", "Finalize Selection", "Approve Payout"]) {
  assert.ok(dashboard.includes(`return "${cta}";`), `Lifecycle CTA must remain available: ${cta}`);
}

console.log("P0 Brand Dashboard hero button style-swap verifier passed.");
