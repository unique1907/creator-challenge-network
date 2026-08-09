import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(source, text, message) {
  assert.ok(source.includes(text), message);
}

function excludes(source, text, message) {
  assert.ok(!source.includes(text), message);
}

const brandDashboard = read("src/features/dashboard/components/brand-dashboard.tsx");
const brandList = read("src/features/dashboard/components/brand-dashboard-challenges.tsx");
const brandCampaigns = read("src/app/dashboard/campaigns/page.tsx");
const campaignWorkspace = read("src/features/dashboard/components/campaign-workspace.tsx");
const campaignTabs = read("src/features/dashboard/components/campaign-workspace-tabs.tsx");
const wizard = read("src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx");
const creatorWorkspace = read("src/features/creator-workspace/components/creator-workspace.tsx");
const creatorActions = read("src/features/creator-workspace/components/creator-actions.tsx");
const brandSettings = read("src/app/dashboard/settings/page.tsx");
const brandIdentityForms = read("src/features/dashboard/components/brand-identity-forms.tsx");
const brandGuide = read("src/app/dashboard/guide/page.tsx");
const creatorGuide = read("src/app/dashboard/creator/guide/page.tsx");
const publicHome = read("src/features/landing/components/final-landing-page.tsx");
const authSignIn = read("src/app/auth/sign-in/page.tsx");

includes(brandDashboard, "md:min-h-[150px]", "Brand Dashboard hero must use aggressive compact height.");
includes(brandDashboard, "flex min-h-[48px]", "Brand Dashboard header must use aggressive compact height.");
includes(brandDashboard, "gap-2.5 px-3 py-2.5", "Brand Dashboard page chrome must use aggressive compact padding.");
includes(brandDashboard, "px-3 py-2", "Brand Dashboard journey must use tighter vertical padding.");
includes(brandDashboard, "rounded-xl border border-slate-700/75 bg-[#0b1220] p-2.5", "Brand right-rail cards must use aggressive compact padding.");

includes(brandList, "md:min-h-[50px]", "Brand Dashboard challenge rows must be aggressively dense.");
includes(brandList, "h-6 rounded-md", "Brand Dashboard filters must use smaller controls.");
includes(brandList, "inline-flex h-7 items-center justify-center", "Brand Dashboard row actions must be compact but usable.");

includes(brandCampaigns, "text-xl font-black", "Business Challenges page title must be reduced from oversized heading scale.");
includes(brandCampaigns, "aspect-[16/5] max-h-[120px]", "Business Challenge cards must use shorter media surfaces.");
includes(brandCampaigns, "<div className=\"p-2.5\">", "Business Challenge cards must use aggressive compact card padding.");

includes(campaignWorkspace, "px-3 py-3 md:px-5", "Brand challenge detail workspace must use compact page padding.");
includes(campaignWorkspace, "max-h-[150px]", "Brand challenge detail cover must have an aggressive compact height.");
includes(campaignWorkspace, "text-[17px] font-semibold", "Brand challenge detail title must be compact.");
includes(campaignWorkspace, "p-2", "Brand challenge detail stat/activity cards must be compact.");
includes(campaignTabs, "mt-2.5 space-y-2.5", "Brand workspace tabs must use dense section rhythm.");
includes(campaignTabs, "rows={3}", "Brand evaluation notes textarea must be reduced.");
includes(campaignTabs, "rounded-xl border border-white/10 bg-[#0a1020]/90 p-2.5", "Brand workspace tab sections must be compact.");

includes(wizard, "gap-2.5 px-3 py-3", "Create Challenge shell must use aggressive compact page rhythm.");
includes(wizard, "lg:grid-cols-[240px_1fr]", "Create Challenge sidebar width must be reduced without changing flow.");
includes(wizard, "text-xl font-bold tracking-tight", "Create Challenge page heading must not be hero-sized.");
includes(wizard, "h-8 w-full", "Create Challenge inputs must use compact control height.");
includes(wizard, "min-h-20", "Business Challenge cover upload area must be shorter.");
includes(wizard, "space-y-2.5", "Prize/Funding steps must use compact vertical spacing.");
includes(wizard, "text-base font-bold", "Funding headings/status cards must use compact heading scale.");

includes(creatorWorkspace, "px-3 py-2.5", "Creator workspace shell must use aggressive compact page padding.");
includes(creatorWorkspace, "mb-3 flex", "Creator workspace header spacing must be reduced.");
includes(creatorWorkspace, "text-xl font-semibold", "Creator page titles must use compact heading scale.");
includes(creatorWorkspace, "max-h-[140px]", "Creator challenge detail cover must be bounded.");
includes(creatorWorkspace, "space-y-2", "Creator detail text sections must be tighter.");
includes(creatorWorkspace, "rounded-lg border border-white/10 bg-white/[0.045] p-2", "Creator cards must use aggressive compact card padding.");

includes(creatorActions, "rounded-xl border border-white/10 bg-white/[0.04] p-2.5", "Creator submission form must use aggressive compact card padding.");
includes(creatorActions, "rows={2}", "Creator textareas must be shorter.");
includes(creatorActions, "h-8 rounded-md", "Creator submission inputs must use compact control height.");
includes(creatorActions, "mt-2.5 flex flex-wrap gap-2", "Creator submission action row must be tighter.");

includes(brandSettings, "text-lg font-semibold", "Brand settings title scale must be compact.");
includes(brandSettings, "mt-3 grid gap-2", "Brand settings card grid must be tighter.");
includes(brandIdentityForms, "mt-3 rounded-xl", "Brand profile/company forms must start closer to the page header.");
includes(brandIdentityForms, "h-16 w-16", "Brand avatar editor must use a compact avatar preview.");
includes(brandIdentityForms, "h-8 w-full", "Brand identity form inputs must use compact control height.");
includes(brandGuide, "px-3 py-3", "Brand guide must use workspace compact page chrome.");
includes(creatorGuide, "space-y-2.5", "Creator guide must use compact vertical rhythm.");

excludes(publicHome, "md:min-h-[150px]", "Public homepage must not receive Brand Dashboard aggressive hero classes.");
excludes(publicHome, "lg:grid-cols-[240px_1fr]", "Public homepage must not receive wizard density classes.");
excludes(authSignIn, "h-8 rounded-md", "Auth sign-in form must not receive Creator workspace form-density classes.");
excludes(authSignIn, "md:min-h-[150px]", "Auth pages must not receive workspace hero-density classes.");

console.log("P0 Brand + Creator workspace aggressive density verifier passed.");
