import { NextResponse } from "next/server";
import { getCreatorSession } from "@/services/creator-session.server";
import { getCanonicalSubmissionStatus } from "@/services/submissions/canonical-challenge-lifecycle.server";
import { safeRouteError } from "@/app/api/internal/circle/_utils";

export async function POST(request: Request) {
  try {
    const session = await getCreatorSession();
    if (!session) {
      return NextResponse.json(
        {
          authenticated: false,
          error: { message: "Sign in is required to submit your work." },
        },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({
      authenticated: true,
      session: {
        displayName: session.displayName,
        authProvider: session.authProvider,
        testOnly: session.testOnly,
      },
      ...(await getCanonicalSubmissionStatus({
        draftId: String(body.draftId ?? ""),
        creatorAccountId: session.ccnAccountId,
      })),
    });
  } catch (error) {
    return safeRouteError(error);
  }
}
