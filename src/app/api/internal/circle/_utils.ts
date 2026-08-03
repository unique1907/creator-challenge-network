import { NextResponse } from "next/server";
import { CircleSpikeError } from "@/services/circle/user-controlled-wallets.server";
import { hasSpikeAccess, isSpikeAllowedInEnvironment } from "@/services/internal-spike-auth.server";

export async function requireSpikeAccess() {
  if (!isSpikeAllowedInEnvironment()) {
    return new NextResponse(null, { status: 404 });
  }

  if (!(await hasSpikeAccess())) {
    return NextResponse.json(
      { error: "Internal wallet spike is locked." },
      { status: 401 },
    );
  }
  return null;
}

export function requireInternalDevelopmentRoute() {
  if (!isSpikeAllowedInEnvironment()) {
    return new NextResponse(null, { status: 404 });
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

  if (
    error &&
    typeof error === "object" &&
    "safe" in error &&
    error.safe &&
    typeof error.safe === "object" &&
    "message" in error.safe
  ) {
    const safe = error.safe as { message: string; status?: number };
    return NextResponse.json(
      { error: safe },
      { status: safe.status ?? 400 },
    );
  }

  return NextResponse.json(
    { error: { message: "Internal spike request failed." } },
    { status: 500 },
  );
}
