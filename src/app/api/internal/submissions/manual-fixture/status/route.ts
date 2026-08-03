import { NextResponse } from "next/server";
import { getCreatorSession } from "@/services/creator-session.server";
import { getManualCreatorFixtureStatus } from "@/services/submissions/manual-creator-fixture.server";
import { requireInternalDevelopmentRoute, safeRouteError } from "../../../circle/_utils";

export async function POST() {
  const blocked = requireInternalDevelopmentRoute();
  if (blocked) return blocked;

  try {
    const session = await getCreatorSession();
    const data = await getManualCreatorFixtureStatus(session);
    if (!session) {
      return NextResponse.json({
        ...data,
        error: { message: "Sign in is required to submit your work." },
      }, { status: 401 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return safeRouteError(error);
  }
}
