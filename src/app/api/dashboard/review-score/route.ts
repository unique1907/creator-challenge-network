import { NextResponse } from "next/server";
import { authErrorResponse, CcnAuthError, requireBrandWorkspace } from "@/services/auth/ccn-auth.server";
import { assertCreateChallengeDraftOwner, getCreateChallengeDraftStrict, getWinnerFinalizationAttemptForScope } from "@/services/create-challenge/create-challenge-store.server";
import { saveSubmissionReviewScore } from "@/services/dashboard/review-scores.server";
import { listBlindReviewEntries, resolveSubmittedSelections } from "@/services/submissions/submission-store.server";

export async function POST(request: Request) {
  try {
    const context = await requireBrandWorkspace({ allowTestContext: true });
    const body = (await request.json()) as Record<string, unknown>;
    const draftId = typeof body.draftId === "string" ? body.draftId : "";
    const submissionId = typeof body.submissionId === "string" ? body.submissionId : "";
    if (!draftId || !submissionId) {
      return NextResponse.json({ error: { message: "Draft and anonymous submission are required." } }, { status: 400 });
    }

    await assertCreateChallengeDraftOwner(draftId, context.ccnAccountId);
    const draft = await getCreateChallengeDraftStrict(draftId);
    const challengeId = draft.challenge.challengeId ?? draft.deployment.challengeId;
    if (process.env.CCN_PAYOUT_ACCOUNT_ID) {
      const winnerAttempt = await getWinnerFinalizationAttemptForScope({
        ccnAccountId: process.env.CCN_PAYOUT_ACCOUNT_ID,
        draftId,
        challengeId,
        fundingIntentId: draft.funding.fundingIntentId,
      });
      if (winnerAttempt?.finalizedAt) {
        return NextResponse.json({ error: { message: "Review is locked after winner finalization." } }, { status: 409 });
      }
    }

    const entries = await listBlindReviewEntries(challengeId);
    const entry = entries.find((item) => item.blindEntryId === submissionId);
    if (!entry) {
      return NextResponse.json({ error: { message: "Anonymous submission was not found for this campaign." } }, { status: 404 });
    }
    const [submitted] = await resolveSubmittedSelections({ challengeId, blindEntryIds: [submissionId] });
    if (submitted?.creatorAccountId === context.ccnAccountId) {
      return NextResponse.json({ error: { message: "Submission owners cannot review their own work." } }, { status: 403 });
    }

    const review = await saveSubmissionReviewScore({
      challengeId,
      submissionId,
      reviewerAccountId: context.ccnAccountId,
      creativity: body.creativity,
      brandFit: body.brandFit,
      execution: body.execution,
      notes: body.notes,
    });

    return NextResponse.json({ review });
  } catch (error) {
    if (error instanceof CcnAuthError) return authErrorResponse(error);
    const message = error instanceof Error ? error.message : "Review could not be saved.";
    return NextResponse.json({ error: { message } }, { status: 400 });
  }
}
