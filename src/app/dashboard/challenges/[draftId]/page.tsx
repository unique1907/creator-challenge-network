import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { getBrandAccountControlData } from "@/features/dashboard/brand-account-controls.server";
import { CampaignWorkspace } from "@/features/dashboard/components/campaign-workspace";
import {
  assertCreateChallengeDraftOwner,
  findOnChainVerificationForDraft,
  getCreateChallengeDraft,
  getWinnerFinalizationAttemptForScope,
  listApprovalAttemptsForScope,
  listFundingAttemptsForScope,
} from "@/services/create-challenge/create-challenge-store.server";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";
import { listSubmissionReviewScores } from "@/services/dashboard/review-scores.server";
import { listBlindReviewEntries } from "@/services/submissions/submission-store.server";

type CampaignWorkspacePageProps = {
  params: Promise<{ draftId: string }>;
};

export async function generateMetadata({
  params,
}: CampaignWorkspacePageProps): Promise<Metadata> {
  const { draftId } = await params;
  const draft = await getCreateChallengeDraft(draftId).catch(() => null);

  return {
    title: draft
      ? `${draft.challenge.title || "Campaign"} | Brand Workspace`
      : "Campaign Workspace | Creator Challenge Network",
    robots: { index: false, follow: false },
  };
}

export default async function CampaignWorkspacePage({
  params,
}: CampaignWorkspacePageProps) {
  const { draftId } = await params;
  const context = await getAuthenticatedCcnContext({ workspace: "brand", allowTestContext: true });
  if (!context) redirect("/auth/sign-in");
  if (!context.brandAccess) notFound();
  await assertCreateChallengeDraftOwner(draftId, context.ccnAccountId).catch(() => notFound());
  const draft = await getCreateChallengeDraft(draftId).catch(() => null);
  if (!draft) notFound();
  const accountControls = await getBrandAccountControlData(context);

  const challengeId = draft.challenge.challengeId ?? draft.deployment.challengeId;
  const fundingIntentId = draft.funding.fundingIntentId;
  const scope = {
    ccnAccountId: context.ccnAccountId,
    walletId: draft.funding.walletId,
    draftId: draft.challenge.id ?? draftId,
    challengeId,
    fundingIntentId,
  };

  const [approvalAttempts, fundingAttempts, verification, blindEntries, winnerAttempt, reviewScores] =
    await Promise.all([
      listApprovalAttemptsForScope(scope),
      listFundingAttemptsForScope(scope),
      findOnChainVerificationForDraft({
        draftId: scope.draftId,
        challengeId,
        fundingIntentId,
      }),
      listBlindReviewEntries(challengeId).catch(() => []),
      process.env.CCN_PAYOUT_ACCOUNT_ID
        ? getWinnerFinalizationAttemptForScope({
            ccnAccountId: process.env.CCN_PAYOUT_ACCOUNT_ID,
            draftId: scope.draftId,
            challengeId,
            fundingIntentId,
          }).catch(() => null)
        : Promise.resolve(null),
      listSubmissionReviewScores(challengeId).catch(() => []),
    ]);

  return (
    <CampaignWorkspace
      draft={draft}
      approvalAttempts={approvalAttempts}
      fundingAttempts={fundingAttempts}
      verification={verification}
      blindEntries={blindEntries}
      winnerAttempt={winnerAttempt}
      reviewScores={reviewScores}
      circleAppId={process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? ""}
      accountControls={accountControls}
    />
  );
}
