import { NextResponse } from "next/server";
import { createOrFetchCircleUser } from "@/services/circle/user-controlled-wallets.server";
import { CREATE_CHALLENGE_BRAND_ACCOUNT_ID } from "@/services/create-challenge/create-challenge-store.server";
import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";

function safeRouteError(error: unknown) {
  if (error instanceof CircleSpikeError) {
    return NextResponse.json({ error: error.safe }, { status: error.safe.status ?? 400 });
  }
  return NextResponse.json({ error: { message: "Session request failed." } }, { status: 400 });
}

export async function POST() {
  try {
    const session = await createOrFetchCircleUser({
      ccnAccountId: CREATE_CHALLENGE_BRAND_ACCOUNT_ID,
      authProvider: "email",
    });
    return NextResponse.json(session);
  } catch (error) {
    return safeRouteError(error);
  }
}
