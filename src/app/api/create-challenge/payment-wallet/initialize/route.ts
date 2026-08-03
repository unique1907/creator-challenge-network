import { NextResponse } from "next/server";

import { CircleSpikeError, initializeScopedUserWallet } from "@/services/circle/user-controlled-wallets.server";
import { authErrorResponse, CcnAuthError, requireBrandWorkspace } from "@/services/auth/ccn-auth.server";

function safeRouteError(error: unknown) {
  if (error instanceof CircleSpikeError) {
    return NextResponse.json({ error: error.safe }, { status: error.safe.status ?? 400 });
  }
  if (error instanceof CcnAuthError) {
    return authErrorResponse(error);
  }
  return NextResponse.json({ error: { message: "Payment wallet setup failed." } }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const context = await requireBrandWorkspace({ allowTestContext: true });
    const body = (await request.json()) as Record<string, unknown>;
    const initialized = await initializeScopedUserWallet({
      ccnAccountId: context.ccnAccountId,
      authProvider: "email",
      userToken: body.userToken,
      role: "BRAND",
      purpose: "PAYMENT",
    });
    return NextResponse.json({ initialized });
  } catch (error) {
    return safeRouteError(error);
  }
}
