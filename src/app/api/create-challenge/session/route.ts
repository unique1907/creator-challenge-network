import { NextResponse } from "next/server";
import { createOrFetchCircleUser } from "@/services/circle/user-controlled-wallets.server";
import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import { authErrorResponse, CcnAuthError, requireBrandWorkspace } from "@/services/auth/ccn-auth.server";

function safeRouteError(error: unknown) {
  if (error instanceof CircleSpikeError) {
    return NextResponse.json({ error: error.safe }, { status: error.safe.status ?? 400 });
  }
  if (error instanceof CcnAuthError) {
    return authErrorResponse(error);
  }
  return NextResponse.json({ error: { message: "Session request failed." } }, { status: 400 });
}

export async function POST() {
  try {
    const context = await requireBrandWorkspace({ allowTestContext: true });
    const session = await createOrFetchCircleUser({
      ccnAccountId: context.ccnAccountId,
      authProvider: "email",
    });
    return NextResponse.json(session);
  } catch (error) {
    return safeRouteError(error);
  }
}
