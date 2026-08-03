import { NextResponse } from "next/server";
import { requireCreatorSession } from "@/services/creator-session.server";
import { saveManualCreatorFixtureDraft } from "@/services/submissions/manual-creator-fixture.server";
import { requireInternalDevelopmentRoute, safeRouteError } from "../../../circle/_utils";

export async function POST(request: Request) {
  const blocked = requireInternalDevelopmentRoute();
  if (blocked) return blocked;

  try {
    const session = await requireCreatorSession();
    const body = (await request.json()) as Record<string, unknown>;
    const data = await saveManualCreatorFixtureDraft(session, {
      title: body.title,
      description: body.description,
      primaryAssetUrl: body.primaryAssetUrl,
      supportingLinks: body.supportingLinks,
      assets: body.assets,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message.includes("Sign in is required") ? 401 : 400;
      return NextResponse.json({ error: { message: error.message } }, { status });
    }
    return safeRouteError(error);
  }
}
