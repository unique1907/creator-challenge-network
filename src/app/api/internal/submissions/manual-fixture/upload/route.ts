import { NextResponse } from "next/server";
import { requireCreatorSession } from "@/services/creator-session.server";
import { uploadManualCreatorFixtureAsset } from "@/services/submissions/manual-creator-fixture.server";
import { requireInternalDevelopmentRoute, safeRouteError } from "../../../circle/_utils";

export async function POST(request: Request) {
  const blocked = requireInternalDevelopmentRoute();
  if (blocked) return blocked;

  try {
    await requireCreatorSession();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: { message: "Choose a file to upload." } }, { status: 400 });
    }
    return NextResponse.json(await uploadManualCreatorFixtureAsset(file));
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message.includes("Sign in is required") ? 401 : 400;
      return NextResponse.json({ error: { message: error.message } }, { status });
    }
    return safeRouteError(error);
  }
}
