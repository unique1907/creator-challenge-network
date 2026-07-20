import { NextResponse } from "next/server";
import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import { hasSpikeAccess } from "@/services/internal-spike-auth.server";

export async function requireSpikeAccess() {
  if (!(await hasSpikeAccess())) {
    return NextResponse.json(
      { error: "Internal wallet spike is locked." },
      { status: 401 },
    );
  }
  return null;
}

export function safeRouteError(error: unknown) {
  if (error instanceof CircleSpikeError) {
    return NextResponse.json(
      { error: error.safe },
      { status: error.safe.status ?? 400 },
    );
  }

  return NextResponse.json(
    { error: { message: "Internal spike request failed." } },
    { status: 500 },
  );
}
