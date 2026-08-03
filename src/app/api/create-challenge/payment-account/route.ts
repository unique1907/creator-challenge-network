import { NextResponse } from "next/server";

import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import { authErrorResponse, CcnAuthError, requireBrandWorkspace } from "@/services/auth/ccn-auth.server";
import { requireSearchDraftId } from "@/services/create-challenge/create-challenge-route-guards.server";
import { getCreateChallengePaymentOverview } from "@/services/create-challenge/brand-payment-account.server";
import { assertCreateChallengeDraftOwner } from "@/services/create-challenge/create-challenge-store.server";

export const dynamic = "force-dynamic";

function safeError(error: unknown) {
  if (error instanceof CircleSpikeError) {
    return NextResponse.json(
      { error: { message: "We couldn't refresh your balance. Please try again." } },
      { status: error.safe.status ?? 400 },
    );
  }
  if (error instanceof CcnAuthError) {
    return authErrorResponse(error);
  }

  return NextResponse.json(
    { error: { message: "We couldn't refresh your balance. Please try again." } },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  try {
    const context = await requireBrandWorkspace({ allowTestContext: true });
    const { searchParams } = new URL(request.url);
    const draftId = requireSearchDraftId(searchParams);
    await assertCreateChallengeDraftOwner(draftId, context.ccnAccountId);
    const paymentOverview = await getCreateChallengePaymentOverview(draftId, undefined, { ccnAccountId: context.ccnAccountId });
    return NextResponse.json({
      paymentAccount: paymentOverview.paymentAccount,
      paymentOverview,
    });
  } catch (error) {
    return safeError(error);
  }
}
