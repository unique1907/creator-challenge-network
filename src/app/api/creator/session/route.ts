import { NextResponse } from "next/server";
import {
  clearCreatorSession,
  createCreatorSession,
  getCreatorSession,
  isCreatorTestAuthAvailable,
  listApprovedTestCreators,
} from "@/services/creator-session.server";

async function sessionResponse() {
  const session = await getCreatorSession();
  return NextResponse.json({
    authenticated: Boolean(session),
    session,
    authModel: isCreatorTestAuthAvailable()
      ? "development-test-creator"
      : "production-auth-not-configured",
    testOnly: isCreatorTestAuthAvailable(),
    approvedCreators: isCreatorTestAuthAvailable() ? listApprovedTestCreators() : [],
  });
}

export async function GET() {
  return sessionResponse();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    await createCreatorSession(body.ccnAccountId, { checkpointFixture: body.checkpointFixture === "checkpoint3" });
    return sessionResponse();
  } catch (error) {
    return NextResponse.json(
      {
        authenticated: false,
        error: {
          message: error instanceof Error ? error.message : "Sign in failed.",
        },
      },
      { status: 401 },
    );
  }
}

export async function DELETE() {
  await clearCreatorSession();
  return sessionResponse();
}
