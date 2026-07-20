import { NextResponse } from "next/server";
import { createApprovalChallenge } from "@/services/circle/escrow-funding.server";
import { requireSpikeAccess, safeRouteError } from "../../_utils";

export async function POST(request: Request) {
  const locked = await requireSpikeAccess();
  if (locked) return locked;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const approval = await createApprovalChallenge(body.userToken);
    return NextResponse.json({ approval });
  } catch (error) {
    return safeRouteError(error);
  }
}
