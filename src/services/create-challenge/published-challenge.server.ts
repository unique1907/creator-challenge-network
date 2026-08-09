import "server-only";

import {
  getCreateChallengeDraftStrict,
  listCreateChallengeDrafts,
  listWinnerFinalizationAttempts,
  type WinnerFinalizationAttemptRecord,
} from "./create-challenge-store.server";
import { classifyCreateChallengeDraftLifecycle, isPublicLiveEligibleDraft } from "./public-challenge-eligibility";
import { resolveCampaignCover } from "@/services/media/brand-media.server";
import { countSubmittedEntriesForChallenge } from "@/services/submissions/submission-store.server";
import type { CreateChallengeDraftState } from "@/types/create-challenge";
import type { Challenge } from "@/types/ccn";
import { parseChallengeDeadline } from "@/utils/challenge-deadlines";

export const HOMEPAGE_LIVE_CHALLENGE_LIMIT = 12;

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

function isInternalTestTitle(title: string) {
  return /^deneme\s*\d*$/i.test(title.trim());
}

function homepageRank(challenge: Challenge) {
  if (challenge.status === "open") return 0;
  if (challenge.status === "reviewing" || challenge.status === "selection") return 1;
  if (challenge.status === "settlement") return 2;
  return 3;
}

async function toPublicChallenge(draft: CreateChallengeDraftState, winnerAttempt: WinnerFinalizationAttemptRecord | null): Promise<Challenge> {
  const submissionDeadline = parseChallengeDeadline(draft.reviewRules.submissionDeadline);
  const challengeId = draft.challenge.challengeId ?? draft.deployment.challengeId;
  const submissions = challengeId ? await countSubmittedEntriesForChallenge(challengeId).catch(() => 0) : 0;
  const classification = classifyCreateChallengeDraftLifecycle({ draft, submittedCount: submissions, winnerAttempt });
  const status = classification.publicStatus ?? "closed";
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
    deadline: submissionDeadline?.iso ?? draft.reviewRules.submissionDeadline,
    submissions,
    status,
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
    payoutTransactionHash: status === "completed" && winnerAttempt?.transactionHash ? winnerAttempt.transactionHash : undefined,
    escrowContractAddress: "0x4DCE98F8a35d09F57ECE7A340B8392Ba0Fb7ba3D",
    publishedAt: draft.deployment.publishedAt ?? draft.updatedAt,
    submissionClosed: !classification.acceptsSubmissions || Boolean(submissionDeadline && Date.now() >= submissionDeadline.unix * 1000),
    coverImageUrl: cover.imageUrl,
    coverImageAlt: cover.alt,
    publicStatusLabel: classification.publicStatusLabel,
    publicCtaLabel: classification.publicCtaLabel,
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
  const winnerAttempt = (await listWinnerFinalizationAttempts()).find((attempt) =>
    attempt.draftId === matches[0].draftId &&
    attempt.challengeId.toLowerCase() === (matches[0].draft.challenge.challengeId ?? matches[0].draft.deployment.challengeId).toLowerCase() &&
    attempt.fundingIntentId === matches[0].draft.funding.fundingIntentId
  ) ?? null;
  return toPublicChallenge(matches[0].draft, winnerAttempt);
}

export async function getPublishedCreateChallengeDraftBySlug(slug: string) {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;

  const matches = (await listLiveCreateChallengeDrafts()).filter(
    (record) => record.draft.challenge.slug === normalizedSlug,
  );

  if (matches.length !== 1) return null;
  const winnerAttempt = (await listWinnerFinalizationAttempts()).find((attempt) =>
    attempt.draftId === matches[0].draftId &&
    attempt.challengeId.toLowerCase() === (matches[0].draft.challenge.challengeId ?? matches[0].draft.deployment.challengeId).toLowerCase() &&
    attempt.fundingIntentId === matches[0].draft.funding.fundingIntentId
  ) ?? null;
  return {
    draftId: matches[0].draftId,
    draft: matches[0].draft,
    challenge: await toPublicChallenge(matches[0].draft, winnerAttempt),
  };
}
export async function listPublishedCreateChallenges(): Promise<Challenge[]> {
  const seen = new Set<string>();
  const published: Challenge[] = [];
  const winnerAttempts = await listWinnerFinalizationAttempts().catch(() => []);

  for (const { draft } of await listLiveCreateChallengeDrafts()) {
    const slug = draft.challenge.slug ?? "new-challenge";
    if (seen.has(slug)) continue;
    seen.add(slug);
    const challengeId = draft.challenge.challengeId ?? draft.deployment.challengeId;
    const winnerAttempt = winnerAttempts.find((attempt) =>
      attempt.draftId === (draft.challenge.id ?? "") &&
      attempt.challengeId.toLowerCase() === challengeId.toLowerCase() &&
      attempt.fundingIntentId === draft.funding.fundingIntentId
    ) ?? null;
    published.push(await toPublicChallenge(draft, winnerAttempt));
  }

  return published;
}

export async function listFeaturedHomepageChallenges() {
  const published = await listLiveHomepageChallenges();
  return published
    .filter((challenge) => !isInternalTestTitle(challenge.title))
    .sort((a, b) => homepageRank(a) - homepageRank(b))
    .slice(0, 3);
}

export async function listLiveHomepageChallenges() {
  const liveDrafts = (await listLiveCreateChallengeDrafts())
    .filter((record) => isPublicLiveEligibleDraft(record.draft));
  const winnerAttempts = await listWinnerFinalizationAttempts().catch(() => []);
  const published = await Promise.all(liveDrafts.map(({ draft }) => {
    const challengeId = draft.challenge.challengeId ?? draft.deployment.challengeId;
    const winnerAttempt = winnerAttempts.find((attempt) =>
      attempt.draftId === (draft.challenge.id ?? "") &&
      attempt.challengeId.toLowerCase() === challengeId.toLowerCase() &&
      attempt.fundingIntentId === draft.funding.fundingIntentId
    ) ?? null;
    return toPublicChallenge(draft, winnerAttempt);
  }));
  return published
    .filter((challenge) =>
      challenge.status === "open" &&
      !challenge.submissionClosed &&
      !isInternalTestTitle(challenge.title)
    )
    .sort((a, b) => {
      const publishedOrder = (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
      if (publishedOrder !== 0) return publishedOrder;
      return b.slug.localeCompare(a.slug);
    })
    .slice(0, HOMEPAGE_LIVE_CHALLENGE_LIMIT);
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
