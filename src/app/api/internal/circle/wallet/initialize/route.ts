import { NextResponse } from "next/server";
import { initializeUserWallet } from "@/services/circle/user-controlled-wallets.server";
import { requireSpikeAccess, safeRouteError } from "../../_utils";

export async function POST(request: Request) {
  const locked = await requireSpikeAccess();
  if (locked) return locked;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const initialized = await initializeUserWallet({
      ccnAccountId: body.ccnAccountId,
      authProvider: body.authProvider,
      userToken: body.userToken,
    });

    if (initialized.alreadyMapped) {
      return NextResponse.json(initialized);
    }

    return NextResponse.json(initialized);
  } catch (error) {
    return safeRouteError(error);
  }
}
