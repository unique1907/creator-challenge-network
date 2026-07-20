import { NextResponse } from "next/server";
import { getWalletBalances } from "@/services/circle/user-controlled-wallets.server";
import { requireSpikeAccess, safeRouteError } from "../../_utils";

export async function POST(request: Request) {
  const locked = await requireSpikeAccess();
  if (locked) return locked;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const balances = await getWalletBalances({
      ccnAccountId: body.ccnAccountId,
      authProvider: body.authProvider,
      userToken: body.userToken,
    });
    return NextResponse.json({ balances });
  } catch (error) {
    return safeRouteError(error);
  }
}
