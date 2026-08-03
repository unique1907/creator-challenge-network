import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const submissionStore = read("src/services/submissions/submission-store.server.ts");
const dashboardPage = read("src/app/dashboard/page.tsx");
const campaignsPage = read("src/app/dashboard/campaigns/page.tsx");
const dashboardViewModel = read("src/features/dashboard/brand-dashboard-view-model.ts");
const notifications = read("src/features/dashboard/components/brand-workspace-navigation.tsx");
const dashboard = read("src/features/dashboard/components/brand-dashboard.tsx");
const campaignWorkspace = read("src/features/dashboard/components/campaign-workspace.tsx");
const campaignTabs = read("src/features/dashboard/components/campaign-workspace-tabs.tsx");

assert.ok(
  submissionStore.includes("submission.status === \"SUBMITTED\""),
  "Blind review queue must filter canonical submitted entries.",
);
assert.ok(
  submissionStore.includes("creatorAccountId") &&
    submissionStore.includes("creatorWalletAddress") &&
    submissionStore.includes("assertBlindReviewProjectionIsAnonymous"),
  "Blind review privacy guard must preserve identity-field checks.",
);
assert.ok(
  dashboardPage.includes("listSubmissionNotificationEntries") &&
    dashboardPage.includes("getSubmissionNotifications(drafts)") &&
    dashboardPage.includes("submissionNotifications"),
  "Brand dashboard must derive submission notifications from canonical submitted entries without using the blind review projection for identity copy.",
);
assert.ok(
  dashboardPage.includes("creatorDisplayName: entry.creatorDisplayName") &&
    submissionStore.includes("select(\"id,display_name\")") &&
    !submissionStore.includes("select(\"id,display_name,email\")"),
  "Submission notification copy must use accounts.display_name without email or wallet fields.",
);
assert.ok(
  dashboardViewModel.includes("submitted work for") &&
    dashboardViewModel.includes("\"A creator\"") &&
    dashboardViewModel.includes("anonymousEntryCode") &&
    dashboardViewModel.includes('campaignHref(item.draftId, "review")'),
  "Submission notifications must include creator/fallback copy, anonymous entry code and route to the workspace Review tab.",
);
assert.ok(
  notifications.includes("item.metadata") &&
    notifications.includes("key={item.id}") &&
    !notifications.includes("item.id ??") &&
    !notifications.includes("`${item.title}-${item.campaignName}`"),
  "Action Center must render stable notification ids without title/campaign fallback keys.",
);
assert.ok(
  dashboardViewModel.includes("id: `draft:${row.draftId}:completion`") &&
    dashboardViewModel.includes("id: `funding:${row.draftId}:required`") &&
    dashboardViewModel.includes("id: `review:${row.draftId}:submissions`") &&
    dashboardViewModel.includes("id: `submission:${item.draftId}:${item.anonymousEntryCode}`"),
  "Derived notifications must use stable composite ids based on canonical draft/submission identifiers.",
);
assert.ok(
  dashboardViewModel.includes("campaignSortScore") &&
    dashboardViewModel.includes("submissionDraftIds.has(row.draftId)") &&
    dashboardViewModel.includes("const sortedRows = campaignRows(drafts).sort") &&
    dashboardViewModel.includes("sortedRows.slice(0, 6)") &&
    !dashboardViewModel.includes("drafts.slice(0, 6).map"),
  "Dashboard campaigns must sort by operational priority before applying the display limit.",
);
assert.ok(
  dashboardViewModel.includes("primaryTitle: submissionDraftIds.has") &&
    dashboard.includes('viewModel.primaryTitle === "New submission received"') &&
    dashboard.includes("Open Blind Review to evaluate anonymous submissions."),
  "Hero must prioritize new-submission review actions over stale draft continuation.",
);assert.ok(
  dashboardViewModel.includes("function submissionRecencyByDraft") &&
    dashboardViewModel.includes("submissionRecency.get(left.draftId)") &&
    dashboardViewModel.includes("rightSubmissionAt - leftSubmissionAt"),
  "Dashboard hero must choose the newest submitted entry before falling back to draft updatedAt ordering.",
);

assert.ok(
  dashboardViewModel.includes("function addFundsAction") &&
    dashboardViewModel.includes('campaignHref(fundable[0]!.draftId, "funding")') &&
    dashboardViewModel.includes('href: "/dashboard/campaigns?filter=funding"') &&
    dashboardViewModel.includes("No campaigns need funding"),
  "Add Funds must route to a fundable campaign Funding tab or a filtered campaign selection instead of an arbitrary workspace overview.",
);
assert.ok(
    campaignsPage.includes("campaignLimit: null") &&
    campaignsPage.includes("filterCampaignRows") &&
    campaignsPage.includes("searchParams") &&
    campaignsPage.includes("?filter=${filter.toLowerCase()}") &&
    campaignsPage.includes("visibleRows.map"),
  "Campaigns page must use the full canonical campaign set with filter-aware visibility.",
);
assert.ok(
  dashboardViewModel.includes("unread: true") &&
    notifications.includes("NOTIFICATION_READ_STORAGE_KEY") &&
    notifications.includes("useSyncExternalStore") &&
    notifications.includes("subscribeNotificationReadStore") &&
    notifications.includes("window.localStorage.getItem") &&
    notifications.includes("window.localStorage.setItem") &&
    notifications.includes("window.setTimeout(() => window.dispatchEvent") &&
    notifications.includes("bg-red-500") &&
    notifications.includes("Unread") &&
    notifications.includes("markNotificationRead(item.id)"),
  "Submission notifications must render one unread badge and persist read state after click/refresh.",
);
assert.ok(
  dashboardViewModel.includes('ctaLabel: "Open Blind Review"') &&
    notifications.includes("item.ctaLabel") &&
    dashboardViewModel.includes('href: campaignHref(item.draftId, "review")'),
  "Submission notifications must expose an Open Blind Review CTA that routes to the Review tab hash.",
);
assert.ok(
  notifications.includes("Open Action Center") &&
    notifications.includes("<svg aria-hidden=\"true\"") &&
    !notifications.includes('className="text-xl">!</span>'),
  "Notification control must use accessible action-center semantics and not the ambiguous exclamation mark.",
);
assert.ok(
  dashboardViewModel.includes("id: string;"),
  "Notification ids must be required so new derived notifications cannot silently fall back to unstable keys.",
);
assert.ok(
  campaignWorkspace.includes('actions.push({ label: "Open Blind Review", href: "#review", primary: true })'),
  "Campaign workspace Open Blind Review action must open the in-workspace Review tab.",
);
assert.ok(
  campaignTabs.includes('window.addEventListener("hashchange", syncTabFromHash)') &&
    campaignTabs.includes('window.addEventListener("popstate", syncTabFromHash)') &&
    campaignTabs.includes('window.addEventListener("click", syncAfterAnchorClick, true)') &&
    campaignTabs.includes("effectiveSelectedSubmissionId") &&
    campaignTabs.includes("props.blindEntries[0]?.blindEntryId ?? \"\""),
  "Campaign workspace tabs must react to initial, changed, same-route and back/forward review hash navigation.",
);
assert.ok(
  campaignTabs.includes("selectedEntry.title") &&
    campaignTabs.includes("selectedEntry.description") &&
    campaignTabs.includes("<ExternalUrlInfo label=\"Primary asset\"") &&
    campaignTabs.includes("<SupportingLinksInfo links={selectedEntry.supportingLinks}"),
  "Review detail must render submitted title, concept summary and safe external link components.",
);
assert.ok(
  campaignTabs.includes('url.protocol === "http:" || url.protocol === "https:"') &&
    campaignTabs.includes('target="_blank"') &&
    campaignTabs.includes('rel="noopener noreferrer"') &&
    campaignTabs.includes("Open main project") &&
    campaignTabs.includes("Open supporting link"),
  "Review detail must render only http/https submission URLs as safe external links.",
);
assert.ok(
  campaignWorkspace.includes("reviewCriteria={draft.reviewRules.judgingCriteria}") &&
    campaignTabs.includes("reviewCriteria: string[]") &&
    campaignTabs.includes("normalizedReviewCriteria") &&
    campaignTabs.includes("Judging Criteria") &&
    campaignTabs.includes("reviewCriteria.map"),
  "Persisted judging criteria must flow from the draft into the Blind Review detail.",
);
assert.ok(
  campaignTabs.includes("<ScoreControl label=\"Creativity\"") &&
    campaignTabs.includes("<ScoreControl label=\"Brand Fit\"") &&
    campaignTabs.includes("<ScoreControl label=\"Execution\"") &&
    campaignTabs.includes("Save Review") &&
    campaignTabs.includes("Finalize Review"),
  "Evaluation controls, review notes, save and complete actions must remain visible.",
);
assert.ok(
  !dashboardViewModel.includes("creatorAccountId") &&
    !dashboardViewModel.includes("creatorWalletAddress"),
  "Dashboard notification projection must not expose Creator identity fields.",
);

console.log("P0 submission propagation verification passed.");
