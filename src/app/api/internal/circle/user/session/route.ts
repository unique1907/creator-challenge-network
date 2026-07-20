import { NextResponse } from "next/server";
import { createOrFetchCircleUser } from "@/services/circle/user-controlled-wallets.server";
import { requireSpikeAccess, safeRouteError } from "../../_utils";

export async function POST(request: Request) {
  const locked = await requireSpikeAccess();
  if (locked) return locked;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const session = await createOrFetchCircleUser({
      ccnAccountId: body.ccnAccountId,
      authProvider: body.authProvider,
    });
    return NextResponse.json(session);
  } catch (error) {
    return safeRouteError(error);
  }
}
