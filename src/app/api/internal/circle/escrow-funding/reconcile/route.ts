import { NextResponse } from "next/server";
import {
  reconcileEscrowTransaction,
} from "@/services/circle/escrow-funding.server";
import type { EscrowTransactionStage } from "@/types/escrow-funding-spike";
import { requireSpikeAccess, safeRouteError } from "../../_utils";

export async function POST(request: Request) {
  const locked = await requireSpikeAccess();
  if (locked) return locked;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await reconcileEscrowTransaction({
      userToken: body.userToken,
      stage: body.stage as EscrowTransactionStage,
    });
    return NextResponse.json({ result });
  } catch (error) {
    return safeRouteError(error);
  }
}
