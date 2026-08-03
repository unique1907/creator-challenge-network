import { NextResponse } from "next/server";
import { clearCreatorSession } from "@/services/creator-session.server";
import { resetManualCreatorFixture } from "@/services/submissions/manual-creator-fixture.server";
import { requireInternalDevelopmentRoute, safeRouteError } from "../../../circle/_utils";

export async function POST() {
  const blocked = requireInternalDevelopmentRoute();
  if (blocked) return blocked;

  try {
    const result = await resetManualCreatorFixture();
    await clearCreatorSession();
    return NextResponse.json(result);
  } catch (error) {
    return safeRouteError(error);
  }
}
