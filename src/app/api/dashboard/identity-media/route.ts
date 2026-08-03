import { NextResponse } from "next/server";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";
import { BrandMediaError, removeBrandMedia, uploadBrandMedia } from "@/services/media/brand-media.server";

function errorResponse(error: unknown) {
  if (error instanceof BrandMediaError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }
  return NextResponse.json({ error: { message: "Identity image request failed safely." } }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const context = await getAuthenticatedCcnContext({ workspace: "brand" });
    if (!context?.brandAccess) {
      return NextResponse.json({ error: { message: "Brand workspace access is required." } }, { status: 403 });
    }
    const form = await request.formData();
    const type = String(form.get("type") ?? "");
    const previousKey = String(form.get("previousKey") ?? "") || null;
    const file = form.get("file");
    if (type !== "avatar" && type !== "brand-logo") {
      return NextResponse.json({ error: { message: "Identity image type is required." } }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: { message: "Choose an image." } }, { status: 400 });
    }
    const uploaded = await uploadBrandMedia({
      file,
      kind: type,
      accountId: context.ccnAccountId,
    });
    if (previousKey && previousKey !== uploaded.objectKey) {
      await removeBrandMedia(previousKey).catch(() => undefined);
    }
    return NextResponse.json({
      image: {
        imageKey: uploaded.objectKey,
        imageUrl: uploaded.publicUrl,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
