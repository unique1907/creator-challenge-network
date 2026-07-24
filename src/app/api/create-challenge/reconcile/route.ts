import { NextResponse } from "next/server";
import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import { requireDraftId } from "@/services/create-challenge/create-challenge-route-guards.server";
import { getCreateChallengePaymentOverview } from "@/services/create-challenge/brand-payment-account.server";
import { reconcileProductTransaction } from "@/services/create-challenge/create-challenge-funding.server";
import type { EscrowTransactionStage } from "@/types/escrow-funding-spike";

function safeRouteError(error: unknown) {
  if (error instanceof CircleSpikeError) {
    return NextResponse.json({ error: error.safe }, { status: error.safe.status ?? 400 });
  }
  return NextResponse.json({ error: { message: "Reconcile request failed." } }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userToken?: unknown;
      stage?: EscrowTransactionStage;
      challengeId?: string;
      draftId?: string;
    };
    const draftId = requireDraftId(body.draftId);
    if (!body.stage || !body.challengeId) {
      return NextResponse.json(
        { error: { message: "stage and challengeId are required." } },
        { status: 400 },
      );
    }
    const result = await reconcileProductTransaction({
      userToken: body.userToken,
      stage: body.stage,
      challengeId: body.challengeId,
      draftId,
    });
    return NextResponse.json({
      result,
      paymentOverview: await getCreateChallengePaymentOverview(draftId),
    });
  } catch (error) {
    return safeRouteError(error);
  }
}