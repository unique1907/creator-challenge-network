import { NextResponse } from "next/server";
import { requireCreatorSession } from "@/services/creator-session.server";
import { saveCanonicalCreatorDraft } from "@/services/submissions/canonical-challenge-lifecycle.server";
import { requireInternalDevelopmentRoute, safeRouteError } from "../../circle/_utils";

export async function POST(request: Request) {
  const blocked = requireInternalDevelopmentRoute();
  if (blocked) return blocked;

  try {
    const session = await requireCreatorSession();
    const body = (await request.json()) as Record<string, unknown>;
    const draftId = String(body.draftId ?? "");
    const data = await saveCanonicalCreatorDraft({
      draftId,
      creatorAccountId: session.ccnAccountId,
      creatorWalletAddress: typeof body.creatorWalletAddress === "string" ? body.creatorWalletAddress : undefined,
      draft: {
        title: body.title,
        description: body.description,
        primaryAssetUrl: body.primaryAssetUrl,
        supportingLinks: body.supportingLinks,
      },
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
