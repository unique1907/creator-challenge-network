import { NextResponse } from "next/server";
import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import { authErrorResponse, CcnAuthError, requireBrandWorkspace } from "@/services/auth/ccn-auth.server";
import { requireDraftId } from "@/services/create-challenge/create-challenge-route-guards.server";
import { getCreateChallengePreflight } from "@/services/create-challenge/create-challenge-funding.server";
import { assertCreateChallengeDraftOwner } from "@/services/create-challenge/create-challenge-store.server";

function safeRouteError(error: unknown) {
  if (error instanceof CircleSpikeError) {
    return NextResponse.json({ error: error.safe }, { status: error.safe.status ?? 400 });
  }
  if (error instanceof CcnAuthError) return authErrorResponse(error);
  return NextResponse.json({ error: { message: "Preflight request failed." } }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const context = await requireBrandWorkspace({ allowTestContext: true });
    const body = (await request.json()) as Record<string, unknown>;
    const draftId = requireDraftId(body.draftId);
    await assertCreateChallengeDraftOwner(draftId, context.ccnAccountId);
    return NextResponse.json({
      preflight: await getCreateChallengePreflight(body.userToken, draftId, { ccnAccountId: context.ccnAccountId }),
    });
  } catch (error) {
    return safeRouteError(error);
  }
}
