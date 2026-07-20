import { NextResponse } from "next/server";
import { getEscrowFundingPreflight } from "@/services/circle/escrow-funding.server";
import { requireSpikeAccess, safeRouteError } from "../../_utils";

export async function POST(request: Request) {
  const locked = await requireSpikeAccess();
  if (locked) return locked;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const preflight = await getEscrowFundingPreflight(body.userToken);
    return NextResponse.json({ preflight });
  } catch (error) {
    return safeRouteError(error);
  }
}
