import { NextResponse } from "next/server";
import {
  getEscrowFundingLinks,
  verifyEscrowFunding,
} from "@/services/circle/escrow-funding.server";
import { requireSpikeAccess, safeRouteError } from "../../_utils";

export async function POST(request: Request) {
  const locked = await requireSpikeAccess();
  if (locked) return locked;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const verification = await verifyEscrowFunding(body.userToken);
    const links = await getEscrowFundingLinks();
    return NextResponse.json({ verification, links });
  } catch (error) {
    return safeRouteError(error);
  }
}
