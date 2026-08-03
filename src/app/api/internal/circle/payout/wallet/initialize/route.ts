import { NextResponse } from "next/server";
import { requireSpikeAccess, safeRouteError } from "@/app/api/internal/circle/_utils";
import { initializeScopedUserWallet } from "@/services/circle/user-controlled-wallets.server";

function payoutAccountId() {
  const value = process.env.CCN_PAYOUT_ACCOUNT_ID;
  if (!value || !/^[A-Za-z0-9._:-]{5,50}$/.test(value)) {
    throw new Error("CCN_PAYOUT_ACCOUNT_ID is not configured.");
  }
  return value;
}

export async function POST(request: Request) {
  const locked = await requireSpikeAccess();
  if (locked) return locked;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const initialized = await initializeScopedUserWallet({
      ccnAccountId: payoutAccountId(),
      authProvider: "email",
      userToken: body.userToken,
      role: "BRAND",
      purpose: "PAYOUT",
    });
    return NextResponse.json(initialized);
  } catch (error) {
    return safeRouteError(error);
  }
}
