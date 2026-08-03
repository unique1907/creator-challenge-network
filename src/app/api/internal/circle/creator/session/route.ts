import { NextResponse } from "next/server";
import { requireSpikeAccess, safeRouteError } from "@/app/api/internal/circle/_utils";
import { createOrFetchCircleUser } from "@/services/circle/user-controlled-wallets.server";

const CREATOR_ACCOUNT_ID = "ccn-test-creator-001";

export async function POST() {
  const locked = await requireSpikeAccess();
  if (locked) return locked;

  try {
    const session = await createOrFetchCircleUser({
      ccnAccountId: CREATOR_ACCOUNT_ID,
      authProvider: "email",
    });
    return NextResponse.json(session);
  } catch (error) {
    return safeRouteError(error);
  }
}
