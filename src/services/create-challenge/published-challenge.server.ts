import "server-only";

import { listCreateChallengeDrafts, getCreateChallengeDraftStrict } from "./create-challenge-store.server";
import type { Challenge } from "@/types/ccn";

export async function getPublishedCreateChallenge(): Promise<Challenge | null> {
  const publishedSummary = (await listCreateChallengeDrafts()).find(
    (item) => item.publicationStatus === "live",
  );
  if (!publishedSummary) return null;
  const draft = await getCreateChallengeDraftStrict(publishedSummary.draftId);
  if (draft.deployment.publicationStatus !== "live") return null;

  return {
    slug: draft.challenge.slug ?? "new-challenge",
    title: draft.challenge.title,
    brand: draft.challenge.brandName,
    category: draft.challenge.category,
    rewardUsdc: draft.prizePool.totalAmount,
    deadline: draft.reviewRules.submissionDeadline.slice(0, 10),
    submissions: 0,
    status: "open",
    usageRights: draft.reviewRules.usageRights,
    escrowStatus: "Arc-funded",
    summary: draft.challenge.summary,
    brief: draft.challenge.description,
    deliverables: [
      draft.challenge.primaryDeliverable,
      ...draft.challenge.supportingDeliverables,
    ].filter(Boolean),
    evaluation: draft.reviewRules.judgingCriteria.filter(Boolean),
    audience: draft.challenge.market || "Open creator audience.",
    accent: "blue",
    winnerModel: `Top ${draft.prizePool.winnerCount}`,
    prizeDistribution: draft.prizePool.prizeDistribution.map(
      (prize) => `${prize.place}: ${prize.amount.toLocaleString()} test USDC`,
    ),
    fundingTransactionHash: draft.funding.transactionHash,
    escrowContractAddress: "0x571470097882848441f8d7FD3D0A37B1b726eBF6",
  };
}

export async function getAllPublicChallenges(baseChallenges: Challenge[]) {
  const published = await getPublishedCreateChallenge();
  return published ? [published, ...baseChallenges] : baseChallenges;
}
