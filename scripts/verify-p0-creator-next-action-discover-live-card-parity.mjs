import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(path, needle, message) {
  assert(read(path).includes(needle), message);
}

function excludes(path, needle, message) {
  assert(!read(path).includes(needle), message);
}

const service = "src/services/creator-workspace/creator-workspace.server.ts";
const workspace = "src/features/creator-workspace/components/creator-workspace.tsx";
const loading = "src/app/dashboard/creator/discover/loading.tsx";
const packageJson = "package.json";

includes(service, "isPublicLiveEligibleDraft", "Creator live source must use shared public-live eligibility.");
includes(service, "explainPublicLiveEligibility", "Creator diagnostics must use the shared public-live eligibility contract.");
includes(service, "listCreatorEligiblePublicDraftsFromDrafts", "Overview and Discover must derive from the same eligible draft collection.");
includes(service, "return drafts.filter(isDiscoverable)", "Unpublished, unfunded, expired, and unverified drafts must be excluded before projection.");
includes(service, "availableChallenges: CreatorChallengeCard[]", "Next Action input must receive the canonical live challenge collection.");
includes(service, "const openChallenge = input.availableChallenges.find((challenge) => challenge.submissionStatus === \"No submission\")", "Next Action must select an eligible open challenge from canonical live cards.");
includes(service, "headline: openChallenge.title", "Next Action must use real selected challenge data, not generic title text.");
includes(service, "challenge: openChallenge", "Next Action must carry the selected live challenge card into the UI.");
excludes(service, "Demo Walmart", "Next Action selection must not hardcode Walmart.");
excludes(service, "demo-walmart", "Next Action selection must not hardcode Walmart slug.");

includes(workspace, "action.kind === \"submit_work\" && action.challenge", "Submit-work Next Action must render a real live challenge card.");
includes(workspace, "<CompactChallengeCard challenge={action.challenge} />", "Next Action must reuse the compact live challenge card presentation.");
excludes(workspace, "Open challenge available", "Generic open-challenge banner copy must not remain in the Creator UI component.");
includes(workspace, "href=\"/dashboard/creator/discover\"", "Overview View all challenges must target Creator Discover.");
includes(workspace, "href={`/dashboard/creator/challenges/${challenge.slug}`}", "Challenge cards must link to their own canonical Creator detail route.");
includes(workspace, "grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", "Discover grid must support four desktop columns with responsive fallbacks.");
includes(workspace, "aspect-[16/6] max-h-[78px]", "Discover cards must use a compact consistent image area.");
includes(workspace, "line-clamp-2 text-[13px]", "Discover card titles must be compact and height-bounded.");
includes(workspace, "text-[10px] font-semibold uppercase", "Discover metadata labels must be compact.");
includes(workspace, "inline-flex h-7", "Discover card CTA must be compact but clickable.");
includes(workspace, "challenge.submissionStatus", "Discover card must preserve Creator participation state.");
includes(workspace, "challenge.prizePool", "Discover card must preserve prize pool.");
includes(workspace, "challenge.submissionDeadline", "Discover card must preserve deadline.");
includes(workspace, "challenge.category", "Discover card must preserve category.");

includes(loading, "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", "Discover loading state must match responsive four-column grid.");
includes(packageJson, "test:p0-creator-next-action-discover-live-card-parity", "Focused Creator parity verifier must be registered.");

console.log("P0 Creator Next Action and Discover live-card parity verifier passed.");
