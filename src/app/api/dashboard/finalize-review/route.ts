import { NextResponse } from "next/server";
import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import { authErrorResponse, CcnAuthError, requireBrandWorkspace } from "@/services/auth/ccn-auth.server";
import { assertCreateChallengeDraftOwner, getCreateChallengeDraftStrict } from "@/services/create-challenge/create-challenge-store.server";
import { finalizeWinnerSelection } from "@/services/create-challenge/winner-finalization.server";
import { listSubmissionReviewScores } from "@/services/dashboard/review-scores.server";
import { resolveCanonicalWinnerSelection } from "@/services/submissions/canonical-challenge-lifecycle.server";
import { listBlindReviewEntries } from "@/services/submissions/submission-store.server";

function maskValue(value?: string | null) {
  if (!value) return "not-available";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function traceFinalizeReview(event: string, details: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "production") return;
  console.info("[ccn-finalize-review:server]", { event, ...details });
}

function safeRouteError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error && typeof error.message === "string"
      ? error.message
      : "Review could not be finalized.";
  traceFinalizeReview("error", {
    type: error instanceof Error ? error.name : typeof error,
    message,
  });
  if (error instanceof CircleSpikeError) {
    return NextResponse.json({ error: error.safe }, { status: error.safe.status ?? 400 });
  }
  if (error instanceof CcnAuthError) return authErrorResponse(error);
  return NextResponse.json({ error: { message } }, { status: 400 });
}

function scoreFor(review: Awaited<ReturnType<typeof listSubmissionReviewScores>>[number]) {
  const values = [review.creativity, review.brandFit, review.execution].filter((value): value is number => typeof value === "number");
  if (!values.length) return -1;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export async function POST(request: Request) {
  try {
    traceFinalizeReview("route-entry");
    const context = await requireBrandWorkspace({ allowTestContext: true });
    traceFinalizeReview("authenticated-brand", {
      ccnAccountId: maskValue(context.ccnAccountId),
      brandAccess: context.brandAccess,
    });
    const body = (await request.json()) as Record<string, unknown>;
    const draftId = typeof body.draftId === "string" ? body.draftId : "";
    if (!draftId) {
      return NextResponse.json({ error: { message: "Draft is required." } }, { status: 400 });
    }

    await assertCreateChallengeDraftOwner(draftId, context.ccnAccountId);
    traceFinalizeReview("draft-ownership-ok", { draftId });
    const draft = await getCreateChallengeDraftStrict(draftId);
    const challengeId = draft.challenge.challengeId ?? draft.deployment.challengeId;
    const entries = await listBlindReviewEntries(challengeId);
    traceFinalizeReview("blind-entries", {
      draftId,
      challengeId,
      count: entries.length,
    });
    if (!entries.length) {
      return NextResponse.json({ error: { message: "No anonymous submissions are available for review." } }, { status: 409 });
    }

    const reviews = await listSubmissionReviewScores(challengeId);
    const reviewBySubmission = new Map(reviews.map((review) => [review.submissionId, review]));
    const incomplete = entries.filter((entry) => reviewBySubmission.get(entry.blindEntryId)?.status !== "COMPLETED");
    traceFinalizeReview("completed-reviews", {
      draftId,
      completedCount: entries.length - incomplete.length,
      totalCount: entries.length,
    });
    if (incomplete.length) {
      return NextResponse.json({ error: { message: "Every anonymous submission must be reviewed before finalization." } }, { status: 409 });
    }

    const selectedBlindEntryIds = [...entries]
      .sort((left, right) => {
        const rightScore = scoreFor(reviewBySubmission.get(right.blindEntryId)!);
        const leftScore = scoreFor(reviewBySubmission.get(left.blindEntryId)!);
        if (rightScore !== leftScore) return rightScore - leftScore;
        return left.anonymousEntryCode.localeCompare(right.anonymousEntryCode);
      })
      .slice(0, draft.prizePool.winnerCount)
      .map((entry) => entry.blindEntryId);
    const selectedAnonymousEntryCodes = selectedBlindEntryIds.map((id) => {
      const entry = entries.find((item) => item.blindEntryId === id);
      return entry?.anonymousEntryCode ?? id;
    });
    traceFinalizeReview("selected-winner", {
      draftId,
      selectedAnonymousEntryCodes,
    });

    const selectedWinners = await resolveCanonicalWinnerSelection({
      draftId,
      selectedBlindEntryIds,
    });
    if (selectedWinners.some((winner) => winner.creatorAccountId === context.ccnAccountId)) {
      return NextResponse.json({ error: { message: "Challenge owners cannot select their own submission as a winner." } }, { status: 403 });
    }
    traceFinalizeReview("finalizeWinnerSelection-start", {
      draftId,
      selectedCount: selectedWinners.length,
    });
    const winner = await finalizeWinnerSelection({
      draftId,
      authority: "BRAND",
      selectedWinners,
    });
    traceFinalizeReview("finalizeWinnerSelection-result", {
      draftId,
      state: winner.state,
      finalizedAt: winner.finalizedAt,
      selectedAnonymousEntryCodes,
    });

    return NextResponse.json({
      winner: {
        draftId: winner.draftId,
        state: winner.state,
        finalizedAt: winner.finalizedAt,
        selectedBlindEntryIds,
        selectedAnonymousEntryCodes,
      },
    });
  } catch (error) {
    return safeRouteError(error);
  }
}
