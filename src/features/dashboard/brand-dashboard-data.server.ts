import "server-only";

import type { CreateChallengeDraftSummary } from "@/services/create-challenge/create-challenge-store.server";
import { listSubmissionNotificationEntries } from "@/services/submissions/submission-store.server";
import type { BrandDashboardSubmissionNotification } from "./brand-dashboard-view-model";

export async function getBrandDashboardSubmissionNotifications(
  drafts: CreateChallengeDraftSummary[],
): Promise<BrandDashboardSubmissionNotification[]> {
  const entriesByDraft = await Promise.all(
    drafts.map(async (draft) => ({
      draft,
      entries: draft.challengeId ? await listSubmissionNotificationEntries(draft.challengeId).catch(() => []) : [],
    })),
  );

  return entriesByDraft.flatMap(({ draft, entries }) =>
    entries.map((entry) => ({
      draftId: draft.draftId,
      campaignName: draft.title || "Untitled business challenge",
      anonymousEntryCode: entry.anonymousEntryCode,
      creatorDisplayName: entry.creatorDisplayName,
      submittedAt: entry.submittedAt,
    })),
  );
}
