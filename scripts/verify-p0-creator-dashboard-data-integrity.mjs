import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function includes(file, text, message) {
  assert.ok(read(file).includes(text), message);
}

function excludes(file, text, message) {
  assert.ok(!read(file).includes(text), message);
}

const service = "src/services/creator-workspace/creator-workspace.server.ts";
const component = "src/features/creator-workspace/components/creator-workspace.tsx";
const search = "src/features/creator-workspace/components/creator-workspace-search.tsx";
const discoverRoute = "src/app/dashboard/creator/discover/page.tsx";
const packageJson = "package.json";

includes(service, "paidRewards = input.rewards.filter((reward) => reward.status === \"Paid\")", "Total Earnings must derive from paid reward records.");
includes(service, "listOnChainVerificationsForDraft", "Paid reward projection must inspect scoped on-chain verification records.");
includes(service, "record.eventType === \"ChallengePayout\"", "Paid reward projection must require payout event evidence.");
includes(service, "record.receiptVerified", "Paid reward projection must require receipt verification.");
includes(service, "record.eventVerified", "Paid reward projection must require event verification.");
includes(service, "record.winnersVerified", "Paid reward projection must require winner verification.");
includes(service, "formatUsdcFromUnits(totalPaid)", "Total Earnings must sum verified paid reward units.");
excludes(service, "wallet.balanceLabel", "Creator earnings must not be derived from wallet balance labels.");
excludes(service, "const rewards: CreatorRewardItem[] = []", "Dashboard rewards must not be hardcoded empty.");

includes(service, "submission.status !== \"Draft\"", "Submitted count must come from canonical creator submissions.");
includes(service, "submission.status === \"Winner\" || submission.status === \"Reward Paid\"", "Win rate must count only finalized winner/paid outcomes.");
includes(service, "submission.status === \"Under Review\"", "Under-review state must remain distinct from wins.");

includes(service, "challengeTitle: canonicalChallengeTitle", "Submission rows must resolve challenge title from the submission challengeId relationship.");
includes(service, "challengeId(item).toLowerCase() === submission.challengeId.toLowerCase()", "Submission projection must join drafts by canonical challengeId, not display title.");
excludes(service, "find((item) => item.challenge.title", "Submission projection must not join challenges by title.");

includes(service, "from \"@/services/create-challenge/public-challenge-eligibility\"", "Creator dashboard/discover must reuse the shared public-live eligibility helper.");
includes(service, "isPublicLiveEligibleDraft(draft)", "Creator open challenges must use shared public-live eligibility.");
includes(service, "countSubmittedEntriesForChallenge(challengeId(draft))", "Open challenge cards must use canonical submitted-entry counts.");
includes(service, "submissionCount: submittedCount", "Open challenge cards must pass real submitted-entry counts into the card projection.");
includes(service, "solutionCountLabel(options.submissionCount)", "Open challenge cards must render real solution counts.");
excludes(service, "Submission count available on detail", "Open challenge cards must not show placeholder submission counts.");

includes(service, "featured: false", "Creator cards must not show FEATURED without a real canonical featured flag.");
excludes(service, "featured: Boolean(draft.challenge.coverImageKey)", "Cover image presence must not be treated as a featured flag.");

includes(service, "creatorSubmissionNotificationHeadline", "Notification copy must be projected semantically from existing state.");
includes(service, "Submission under review", "Notifications must expose under-review state when that is the canonical state.");
includes(service, "Selected solution", "Notifications must expose selected-winner state when that is the canonical state.");
includes(service, "Reward paid", "Notifications must expose paid-reward state when verified.");
excludes(service, "headline: submission.status === \"Draft\" ? \"Draft saved\" : \"Submission updated\"", "Notifications must not collapse every non-draft event into generic copy.");

includes(service, "resolveCreatorNextAction", "Next Action selection must remain centralized and deterministic.");
includes(service, "input.availableChallenges.find((challenge) => challenge.submissionStatus === \"No submission\")", "Next Action must select from canonical available challenges.");

includes(component, "2xl:grid-cols-[minmax(0,1fr)_330px]", "Payout Wallet rail must not crowd the top KPI area at normal desktop widths.");
includes(component, "<section className=\"space-y-2\">", "Greeting and KPI grid must stack vertically so the greeting keeps natural width.");
excludes(component, "xl:grid-cols-[minmax(0,1fr)_minmax(0,640px)]", "Greeting and KPI cards must not compete in side-by-side columns.");
includes(component, "grid min-w-0 gap-3 sm:grid-cols-3", "KPI cards must have a non-overflowing compact grid contract.");
includes(component, "break-words text-[15px]", "Long metric values must wrap rather than collide.");
includes(component, "2xl:sticky", "Payout Wallet rail sticky behavior must only apply when the rail is beside the main content.");

includes(search, "form action=\"/dashboard/creator/discover\"", "Creator dashboard search must route to canonical discover.");
includes(search, "name=\"q\"", "Creator dashboard search must submit a query parameter.");
includes(discoverRoute, "listCreatorDiscoverableChallenges(session, query)", "Creator discover must apply the dashboard search query to real creator challenge data.");
includes(packageJson, "test:p0-creator-dashboard-data-integrity", "New Creator dashboard data-integrity verifier must be registered.");

console.log("P0 Creator Dashboard data integrity and parity verifier passed.");
