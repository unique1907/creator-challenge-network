import { NextResponse } from "next/server";
import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import { requireDraftId } from "@/services/create-challenge/create-challenge-route-guards.server";
import { getCreateChallengePaymentOverview } from "@/services/create-challenge/brand-payment-account.server";
import { reconcileCurrentApprovalAttempts } from "@/services/create-challenge/create-challenge-funding.server";

function safeRouteError(error: unknown) {
  if (error instanceof CircleSpikeError) {
    return NextResponse.json({ error: error.safe }, { status: error.safe.status ?? 400 });
  }
  return NextResponse.json({ error: { message: "Approval recovery request failed." } }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userToken?: unknown;
      draftId?: string;
    };
    const draftId = requireDraftId(body.draftId);
    const recovery = await reconcileCurrentApprovalAttempts(body.userToken, draftId);
    return NextResponse.json({
      recovery,
      paymentOverview: await getCreateChallengePaymentOverview(draftId),
    });
  } catch (error) {
    return safeRouteError(error);
  }
}