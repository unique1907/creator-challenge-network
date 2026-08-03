import { NextResponse } from "next/server";
import { requireSpikeAccess, safeRouteError } from "@/app/api/internal/circle/_utils";
import { getScopedWallet } from "@/services/circle/user-controlled-wallets.server";

const CREATOR_ACCOUNT_ID = "ccn-test-creator-001";

export async function POST(request: Request) {
  const locked = await requireSpikeAccess();
  if (locked) return locked;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const wallet = await getScopedWallet({
      ccnAccountId: CREATOR_ACCOUNT_ID,
      authProvider: "email",
      userToken: body.userToken,
      role: "CREATOR",
      purpose: "PAYOUT",
    });
    return NextResponse.json({ wallet });
  } catch (error) {
    return safeRouteError(error);
  }
}
