import { NextResponse } from "next/server";
import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import { requireDraftId } from "@/services/create-challenge/create-challenge-route-guards.server";
import { verifyProductFunding } from "@/services/create-challenge/create-challenge-funding.server";

function safeRouteError(error: unknown) {
  if (error instanceof CircleSpikeError) {
    return NextResponse.json({ error: error.safe }, { status: error.safe.status ?? 400 });
  }
  return NextResponse.json({ error: { message: "Funding verification failed." } }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const draftId = requireDraftId(body.draftId);
    return NextResponse.json({
      verification: await verifyProductFunding(body.userToken, draftId),
    });
  } catch (error) {
    return safeRouteError(error);
  }
}
