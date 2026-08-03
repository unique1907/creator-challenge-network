import "server-only";

import { listCreateChallengeDrafts, getCreateChallengeDraftStrict } from "./create-challenge-store.server";
import { resolveCampaignCover } from "@/services/media/brand-media.server";
import type { CreateChallengeDraftState } from "@/types/create-challenge";
import type { Challenge } from "@/types/ccn";

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production" || process.env.CCN_DEPLOYMENT_ENV === "production";
}

export function includeStaticChallengeMocks() {
  if (isProductionRuntime()) return false;
  return process.env.CCN_INCLUDE_STATIC_CHALLENGE_MOCKS === "true" || process.env.CCN_SMOKE_TEST_MODE === "true";
}

function isPubliclyLiveDraft(draft: CreateChallengeDraftState) {
  const fundingStatus = String(draft.funding.fundingStatus);
  return Boolean(
    draft.deployment.publicationStatus === "live" &&
      (fundingStatus === "funded" || fundingStatus === "live") &&
      draft.funding.escrowStatus === "verified" &&
      draft.funding.eventVerified &&
      draft.funding.transactionHash,
  );
}

function toPublicChallenge(draft: CreateChallengeDraftState): Challenge {
  const cover = resolveCampaignCover({
    coverImageKey: draft.challenge.coverImageKey,
    coverImageAlt: draft.challenge.coverImageAlt,
    title: draft.challenge.title,
    category: draft.challenge.category,
  });
  return {
    source: "canonical",
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
    escrowContractAddress: "0x4DCE98F8a35d09F57ECE7A340B8392Ba0Fb7ba3D",
    submissionClosed: Date.now() >= new Date(draft.reviewRules.submissionDeadline).getTime(),
    coverImageUrl: cover.imageUrl,
    coverImageAlt: cover.alt,
  };
}

async function listLiveCreateChallengeDrafts() {
  const summaries = await listCreateChallengeDrafts();
  const draftRecords = await Promise.all(
    summaries
      .filter((item) => item.publicationStatus === "live")
      .map(async (item) => ({
        draftId: item.draftId,
        draft: await getCreateChallengeDraftStrict(item.draftId),
      })),
  );
  return draftRecords.filter((record) => isPubliclyLiveDraft(record.draft));
}

export async function getPublishedCreateChallengeBySlug(slug: string): Promise<Challenge | null> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;

  const matches = (await listLiveCreateChallengeDrafts()).filter(
    (record) => record.draft.challenge.slug === normalizedSlug,
  );

  if (matches.length !== 1) return null;
  return toPublicChallenge(matches[0].draft);
}

export async function getPublishedCreateChallengeDraftBySlug(slug: string) {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;

  const matches = (await listLiveCreateChallengeDrafts()).filter(
    (record) => record.draft.challenge.slug === normalizedSlug,
  );

  if (matches.length !== 1) return null;
  return {
    draftId: matches[0].draftId,
    draft: matches[0].draft,
    challenge: toPublicChallenge(matches[0].draft),
  };
}
export async function listPublishedCreateChallenges(): Promise<Challenge[]> {
  const seen = new Set<string>();
  const published: Challenge[] = [];

  for (const { draft } of await listLiveCreateChallengeDrafts()) {
    const slug = draft.challenge.slug ?? "new-challenge";
    if (seen.has(slug)) continue;
    seen.add(slug);
    published.push(toPublicChallenge(draft));
  }

  return published;
}

export async function getPublishedCreateChallenge(): Promise<Challenge | null> {
  return (await listPublishedCreateChallenges())[0] ?? null;
}

export async function getAllPublicChallenges(baseChallenges: Challenge[]) {
  const published = await listPublishedCreateChallenges();
  if (!includeStaticChallengeMocks()) return published;
  const canonicalSlugs = new Set(published.map((challenge) => challenge.slug));
  return [
    ...published,
    ...baseChallenges
      .filter((challenge) => !canonicalSlugs.has(challenge.slug))
      .map((challenge) => ({ ...challenge, source: "mock" as const })),
  ];
}
