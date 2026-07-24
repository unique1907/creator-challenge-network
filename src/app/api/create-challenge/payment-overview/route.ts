import { NextResponse } from "next/server";

import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import { requireSearchDraftId } from "@/services/create-challenge/create-challenge-route-guards.server";
import { getCreateChallengePaymentOverview } from "@/services/create-challenge/brand-payment-account.server";
import { DraftNotFoundError, StoreCorruptionError } from "@/services/create-challenge/create-challenge-store.server";
import { createChallengeTraceId, logCreateChallengeTrace, type CreateChallengeTraceSource } from "@/utils/create-challenge-payment-trace";

export const dynamic = "force-dynamic";

function safeError(error: unknown) {
  if (error instanceof DraftNotFoundError) {
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 404 },
    );
  }

  if (error instanceof StoreCorruptionError) {
    return NextResponse.json(
      { error: { message: "Create Challenge local store needs manual recovery before continuing." } },
      { status: 503 },
    );
  }

  if (error instanceof CircleSpikeError) {
    return NextResponse.json(
      { error: { message: error.safe.message || "We couldn't refresh your balance. Please try again." } },
      { status: error.safe.status ?? 400 },
    );
  }

  return NextResponse.json(
    { error: { message: "We couldn't refresh your balance. Please try again." } },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestId = request.headers.get("x-ccn-request-id") ?? createChallengeTraceId("payment-overview-route");
  const triggerSource = (request.headers.get("x-ccn-trigger-source") ?? "server") as CreateChallengeTraceSource;
  let draftId: string | undefined;
  try {
    draftId = requireSearchDraftId(searchParams);
    logCreateChallengeTrace({
      requestId,
      route: "/api/create-challenge/payment-overview",
      functionName: "GET",
      draftId,
      triggerSource,
      startedAt: new Date().toISOString(),
      attemptedErrorUpdate: false,
    });
    const paymentOverview = await getCreateChallengePaymentOverview(draftId, { requestId, triggerSource });
    logCreateChallengeTrace({
      requestId,
      route: "/api/create-challenge/payment-overview",
      functionName: "GET",
      draftId,
      triggerSource,
      completedAt: new Date().toISOString(),
      success: true,
      status: 200,
      attemptedErrorUpdate: false,
    });
    return NextResponse.json({ paymentOverview });
  } catch (error) {
    const response = safeError(error);
    logCreateChallengeTrace({
      requestId,
      route: "/api/create-challenge/payment-overview",
      functionName: "GET",
      draftId,
      triggerSource,
      completedAt: new Date().toISOString(),
      success: false,
      status: response.status,
      attemptedErrorUpdate: true,
      message: "safe payment overview failure",
    });
    return response;
  }
}
